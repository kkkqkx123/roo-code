import * as vscode from "vscode"
import EventEmitter from "events"
import fs from "fs/promises"
import path from "path"

import {
	type TaskProviderLike,
	type TaskProviderEvents,
	type ProviderSettings,
	type ProviderSettingsEntry,
	type RooCodeSettings,
	type CodeActionId,
	type CodeActionName,
	type TerminalActionId,
	type TerminalActionPromptType,
	type HistoryItem,
	type CreateTaskOptions,
	type TokenUsage,
	type ToolUsage,
	type GitProperties,
	type TodoItem,
	RooCodeEventName,
	getModelId,
} from "@shared/types"

import { Package } from "@shared/package"
import type { ExtensionMessage, ExtensionState } from "@shared/ExtensionMessage"
import { EMBEDDING_MODEL_PROFILES } from "@shared/config/embedding-models"
import { defaultModeSlug, getModeBySlug } from "@core/modes/mode-utils"
import { t } from "../../i18n"
import { findLast } from "@shared/array"
import { getWorkspaceGitInfo } from "../../utils/git"
import os from "os"

import WorkspaceTracker from "../../integrations/workspace/WorkspaceTracker"
import { McpHub } from "../../services/mcp/McpHub"
import { McpServerManager } from "../../services/mcp/McpServerManager"
import { CodeIndexManager } from "../../services/code-index/manager"
import { Terminal } from "../../integrations/terminal/Terminal"

import { getWorkspacePath } from "../../utils/path"
import { getSettingsDirectoryPath } from "../../utils/storage"

import { ContextProxy } from "../config/ContextProxy"
import { ProviderSettingsManager } from "../config/ProviderSettingsManager"
import { CustomModesManager } from "../config/CustomModesManager"
import { Task } from "../task/Task"

import { TaskManager } from "../task/TaskManager"
import { TaskDelegationCoordinator } from "../task/TaskDelegationCoordinator"
import { WebviewCoordinator } from "./WebviewCoordinator"
import { ProviderCoordinator } from "../providers/ProviderCoordinator"
import { StateCoordinator } from "../state/StateCoordinator"
import { createLogger } from "../../utils/logger"

/**
 * Refactored ClineProvider that delegates responsibilities to specialized coordinators
 */
export class ClineProvider
	extends EventEmitter<TaskProviderEvents>
	implements vscode.WebviewViewProvider, TaskProviderLike {
	public static readonly sideBarId = `${Package.name}.SidebarProvider`
	public static readonly tabPanelId = `${Package.name}.TabPanelProvider`

	private static activeInstances: Set<ClineProvider> = new Set()
	private disposables: vscode.Disposable[] = []

	public readonly context: vscode.ExtensionContext
	private outputChannel: vscode.OutputChannel
	private renderContext: "sidebar" | "editor"
	public readonly contextProxy: ContextProxy
	private logger: ReturnType<typeof createLogger>

	// Webview related
	private webviewDisposables: vscode.Disposable[] = []
	private view?: vscode.WebviewView | vscode.WebviewPanel

	// Task related
	private taskCreationCallback: (task: Task) => void

	// Coordinator instances
	public taskManager!: TaskManager
	public taskDelegationCoordinator!: TaskDelegationCoordinator
	public webviewCoordinator!: WebviewCoordinator
	public providerCoordinator!: ProviderCoordinator
	public stateCoordinator!: StateCoordinator

	// Service instances
	private _workspaceTracker?: WorkspaceTracker
	private mcpHub?: McpHub
	private _providerSettingsManager!: ProviderSettingsManager
	private _customModesManager!: CustomModesManager

	private codeIndexStatusSubscription?: vscode.Disposable
	private configUpgradeStatusSubscription?: vscode.Disposable
	private codeIndexManager?: CodeIndexManager
	private recentTasksCache?: string[]
	private cachedGitProperties: GitProperties | undefined

	// Other properties
	public isViewLaunched = false

	private currentWorkspacePath: string | undefined
	public settingsImportedAt?: number
	public readonly latestAnnouncementId = "" // 禁用更新公告

	constructor(
		context: vscode.ExtensionContext,
		outputChannel: vscode.OutputChannel,
		renderContext: "sidebar" | "editor" = "sidebar",
		contextProxy: ContextProxy,
	) {
		super()

		this.context = context
		this.outputChannel = outputChannel
		this.renderContext = renderContext
		this.contextProxy = contextProxy

		this.logger = createLogger(outputChannel, `ClineProvider(${renderContext})`)
		this.logger.info(`Initializing ClineProvider in ${renderContext} mode`)

		this.currentWorkspacePath = getWorkspacePath()
		this.logger.debug(`Workspace path: ${this.currentWorkspacePath}`)

		ClineProvider.activeInstances.add(this)
		this.logger.debug(`Added to active instances (total: ${ClineProvider.activeInstances.size})`)

		// Initialize task creation callback
		this.taskCreationCallback = (instance: Task) => {
			this.logger.debug(`Task created: ${instance.taskId}`)
			this.emit(RooCodeEventName.TaskCreated, instance)

			// Create named listener functions so we can remove them later.
			const onTaskStarted = () => this.emit(RooCodeEventName.TaskStarted, instance.taskId)
			const onTaskCompleted = (taskId: string, tokenUsage: TokenUsage, toolUsage: ToolUsage) =>
				this.emit(RooCodeEventName.TaskCompleted, taskId, tokenUsage, toolUsage)
			const onTaskAborted = async () => {
				this.emit(RooCodeEventName.TaskAborted, instance.taskId)
			}
			const onTaskFocused = () => this.emit(RooCodeEventName.TaskFocused, instance.taskId)
			const onTaskUnfocused = () => this.emit(RooCodeEventName.TaskUnfocused, instance.taskId)
			const onTaskActive = (taskId: string) => this.emit(RooCodeEventName.TaskActive, taskId)
			const onTaskInteractive = (taskId: string) => this.emit(RooCodeEventName.TaskInteractive, taskId)
			const onTaskResumable = (taskId: string) => this.emit(RooCodeEventName.TaskResumable, taskId)
			const onTaskIdle = (taskId: string) => this.emit(RooCodeEventName.TaskIdle, taskId)
			const onTaskPaused = (taskId: string) => this.emit(RooCodeEventName.TaskPaused, taskId)
			const onTaskUnpaused = (taskId: string) => this.emit(RooCodeEventName.TaskUnpaused, taskId)
			const onTaskSpawned = (taskId: string) => this.emit(RooCodeEventName.TaskSpawned, taskId)
			const onTaskUserMessage = (taskId: string) => this.emit(RooCodeEventName.TaskUserMessage, taskId)
			const onTaskTokenUsageUpdated = (taskId: string, tokenUsage: TokenUsage, toolUsage: ToolUsage) =>
				this.emit(RooCodeEventName.TaskTokenUsageUpdated, taskId, tokenUsage, toolUsage)

			// Attach the listeners.
			instance.on(RooCodeEventName.TaskStarted, onTaskStarted)
			instance.on(RooCodeEventName.TaskCompleted, onTaskCompleted)
			instance.on(RooCodeEventName.TaskAborted, onTaskAborted)
			instance.on(RooCodeEventName.TaskFocused, onTaskFocused)
			instance.on(RooCodeEventName.TaskUnfocused, onTaskUnfocused)
			instance.on(RooCodeEventName.TaskActive, onTaskActive)
			instance.on(RooCodeEventName.TaskInteractive, onTaskInteractive)
			instance.on(RooCodeEventName.TaskResumable, onTaskResumable)
			instance.on(RooCodeEventName.TaskIdle, onTaskIdle)
			instance.on(RooCodeEventName.TaskPaused, onTaskPaused)
			instance.on(RooCodeEventName.TaskUnpaused, onTaskUnpaused)
			instance.on(RooCodeEventName.TaskSpawned, onTaskSpawned)
			instance.on(RooCodeEventName.TaskUserMessage, onTaskUserMessage)
			instance.on(RooCodeEventName.TaskTokenUsageUpdated, onTaskTokenUsageUpdated)
		}

		// Initialize coordinators
		this.initializeCoordinators()

		// Initialize services
		this.initializeServices()

		// Set up event handling
		this.setupEventHandling()
	}

	/**
	 * Initializes terminal settings from state
	 */
	private async initializeTerminalSettings(): Promise<void> {
		await this.stateCoordinator.applyTerminalSettings()
	}

	/**
		* Initializes the coordinator instances
		*/
	private initializeCoordinators(): void {
		this.logger.info("Initializing coordinators...")

		// Initialize StateCoordinator first (without TaskManager to avoid circular dependency)
		this.stateCoordinator = new StateCoordinator(this.contextProxy, this.mcpHub)
		this.logger.debug("StateCoordinator initialized")

		// Initialize TaskManager with task creation callback
		this.taskManager = new TaskManager(
			this.taskCreationCallback,
			this,
			async () => (await this.stateCoordinator.getState()).apiConfiguration,
			() => this.stateCoordinator.getState(),
		)
		this.logger.debug("TaskManager initialized")

		// Set TaskManager in StateCoordinator to enable isBrowserSessionActive check
		this.stateCoordinator.setTaskManager(this.taskManager)
		this.logger.debug("TaskManager set in StateCoordinator")

		// Initialize TaskDelegationCoordinator
		this.taskDelegationCoordinator = new TaskDelegationCoordinator({
			getCurrentTask: () => this.taskManager.getCurrentTask(),
			removeClineFromStack: () => this.taskManager.removeClineFromStack(),
			createTask: (prompt, images, parent, options) => this.taskManager.createTask(prompt, options),
			createTaskWithHistoryItem: (historyItem, options) => this.taskManager.createTaskWithHistoryItem(historyItem, options),
			getTaskWithId: (id) => this.taskManager.getTaskWithId(id),
			updateTaskHistory: (item) => this.updateTaskHistory(item),
			handleModeSwitch: (newMode) => this.handleModeSwitch(newMode),
			log: (message) => this.log(message),
			emit: (event, ...args) => this.emit(event as any, ...(args as any)),
			globalStoragePath: this.contextProxy.globalStorageUri.fsPath,
		})
		this.logger.debug("TaskDelegationCoordinator initialized")

		// Initialize ProviderCoordinator
		this.providerCoordinator = new ProviderCoordinator(this.context, this.contextProxy)
		this.logger.debug("ProviderCoordinator initialized")

		// Set up coordinator event forwarding
		this.taskManager.on(RooCodeEventName.TaskCreated, (task) => {
			this.emit(RooCodeEventName.TaskCreated, task)
		})
		this.logger.debug("Coordinator event forwarding set up")

		this.logger.info("Coordinators initialized successfully")
	}

	/**
	 * Initializes service instances
	 */
	private initializeServices(): void {
		this.logger.info("Initializing services...")

		this._workspaceTracker = new WorkspaceTracker(this)
		this.logger.debug("WorkspaceTracker initialized")

		this._providerSettingsManager = new ProviderSettingsManager(this.context)
		this.logger.debug("ProviderSettingsManager initialized")

		this._customModesManager = new CustomModesManager(this.context, async () => {
			await this.postStateToWebview()
		})
		this.logger.debug("CustomModesManager initialized")

		// Initialize git properties asynchronously
		this.initializeGitProperties().catch((error) => {
			this.logger.warn(`Failed to initialize git properties during startup: ${error}`)
		})

		// Initialize WebviewCoordinator with provider
		this.webviewCoordinator = new WebviewCoordinator(this.context, this.outputChannel, this)
		this.logger.debug("WebviewCoordinator initialized")

		// Initialize MCP Hub
		McpServerManager.getInstance(this.context, this)
			.then((hub) => {
				this.mcpHub = hub
				this.mcpHub.registerClient()
				this.logger.info("MCP Hub initialized and client registered")
			})
			.catch((error) => {
				this.logger.error("Failed to initialize MCP Hub", error)
			})

		// Set codebase index models
		this.stateCoordinator.updateGlobalState("codebaseIndexModels", EMBEDDING_MODEL_PROFILES)
		this.logger.debug("Codebase index models set")

		this.logger.info("Services initialized successfully")
	}

	/**
	 * Sets up event handling
	 */
	private setupEventHandling(): void {
		this.on(RooCodeEventName.TaskUserMessage, async (taskId: string) => {
			this.logger.debug(`[ClineProvider] TaskUserMessage event received for task ${taskId}`)
			await this.postStateToWebview()
		})
	}

	/**
	 * Override EventEmitter's on method to match TaskProviderLike interface
	 */
	override on<K extends keyof TaskProviderEvents>(
		event: K,
		listener: (...args: TaskProviderEvents[K]) => void | Promise<void>,
	): this {
		return super.on(event, listener as any)
	}

	/**
	 * Override EventEmitter's off method to match TaskProviderLike interface
	 */
	override off<K extends keyof TaskProviderEvents>(
		event: K,
		listener: (...args: TaskProviderEvents[K]) => void | Promise<void>,
	): this {
		return super.off(event, listener as any)
	}

	/**
	 * Resolves the webview view
	 */
	public async resolveWebviewView(webviewView: vscode.WebviewView | vscode.WebviewPanel): Promise<void> {
		this.logger.info("Resolving webview view...")
		try {
			await this.webviewCoordinator.resolveWebviewView(webviewView)
			this.logger.debug("WebviewCoordinator resolved webview view")

			// Initialize terminal settings from state
			await this.initializeTerminalSettings()

			this.updateCodeIndexStatusSubscription()

			await this.postStateToWebview()
			this.logger.info("Initial state posted to webview")
		} catch (error) {
			this.logger.error("Failed to resolve webview view", error)
			throw error
		}
	}

	/**
	 * Creates a new task
	 */
	public async createTask(
		text?: string,
		images?: string[],
		parentTask?: Task,
		options: CreateTaskOptions = {},
		configuration: RooCodeSettings = {},
	): Promise<Task> {
		this.logger.debug(`[ClineProvider#createTask] Creating task with text: "${text?.substring(0, 100)}..."`)

		if (configuration) {
			await this.setValues(configuration)
		}

		// Single-open-task invariant: always enforce for user-initiated top-level tasks
		if (!parentTask) {
			try {
				await this.removeClineFromStack()
			} catch {
				// Non-fatal
			}
		}

		const task = await this.taskManager.createTask(text || "", options)
		this.logger.debug(`[ClineProvider#createTask] Task created: ${task.taskId}`)

		return task
	}

	/**
	 * Creates a task with history item
	 */
	public async createTaskWithHistoryItem(
		historyItem: HistoryItem & {
			rootTask?: string
			parentTask?: string
		},
		options?: { startTask?: boolean },
	): Promise<Task> {
		// Check if we're rehydrating the current task to avoid flicker
		const currentTask = this.getCurrentTask()
		const isRehydratingCurrentTask = currentTask && currentTask.taskId === historyItem.id

		if (!isRehydratingCurrentTask) {
			await this.removeClineFromStack()
		}

		// If the history item has a mode, restore it (but only if the mode exists)
		if (historyItem.mode) {
			const { getModeBySlug } = await import("@core/modes/mode-utils")
			const customModes = await this.customModesManager.getCustomModes()
			const modeConfig = getModeBySlug(historyItem.mode, customModes)
			if (modeConfig) {
				try {
					await this.handleModeSwitch(historyItem.mode)
				} catch (error) {
					this.log(`Failed to restore API configuration for mode '${historyItem.mode}': ${error}`)
					// Continue with task restoration even if mode config loading fails
				}
			} else {
				// Mode no longer exists, fall back to default mode
				this.log(`Mode '${historyItem.mode}' from history no longer exists. Falling back to default mode 'code'.`)
				historyItem.mode = "code"
				try {
					await this.handleModeSwitch("code")
				} catch (error) {
					this.log(`Failed to restore API configuration for mode 'code': ${error}`)
					// Continue with task restoration even if mode config loading fails
				}
			}
		}

		return await this.taskManager.createTaskWithHistoryItem(historyItem, options)
	}

	/**
	 * Delegates a parent task to a child task
	 */
	public async delegateParentAndOpenChild(params: {
		parentTaskId: string
		message: string
		initialTodos: TodoItem[]
		mode: string
	}): Promise<Task> {
		return this.taskDelegationCoordinator.delegateParentAndOpenChild(params)
	}

	public async reopenParentFromDelegation(params: {
		parentTaskId: string
		childTaskId: string
		completionResultSummary: string
	}): Promise<void> {
		return this.taskDelegationCoordinator.reopenParentFromDelegation(params)
	}

	/**
	 * Cancels the current task
	 */
	public async cancelTask(): Promise<{ success: boolean; error?: string }> {
		const result = await this.taskManager.cancelTask()
		
		if (!result.success) {
			this.logger.error(`[ClineProvider#cancelTask] Failed to cancel task: ${result.error}`)
		} else {
			this.logger.info(`[ClineProvider#cancelTask] Task cancelled successfully`)
		}
		
		return result
	}

	/**
	 * Clears the current task
	 */
	public async clearTask(): Promise<void> {
		await this.taskManager.clearTask()
	}

	/**
	 * Removes and destroys the top Cline instance (the current finished task),
	 * activating the previous one (resuming the parent task).
	 */
	public async removeClineFromStack(): Promise<void> {
		await this.taskManager.removeClineFromStack()
	}

	/**
	 * Sets a pending edit operation with automatic timeout cleanup
	 */
	public setPendingEditOperation(
		operationId: string,
		editData: {
			messageTs: number
			editedContent: string
			images?: string[]
			messageIndex: number
			apiConversationHistoryIndex: number
		},
	): void {
		this.taskManager.setPendingEditOperation(operationId, editData)
	}

	/**
	 * Resumes a task
	 */
	public resumeTask(taskId: string): void {
		this.taskManager.resumeTask(taskId)
	}

	/**
	 * Gets the current task
	 */
	public getCurrentTask(): Task | undefined {
		return this.taskManager.getCurrentTask()
	}

	/**
	 * Gets recent tasks
	 */
	public getRecentTasks(): string[] {
		return this.taskManager.getRecentTasks()
	}

	/**
	 * Gets the current task stack
	 */
	public getCurrentTaskStack(): string[] {
		return this.taskManager.getCurrentTaskStack()
	}

	/**
	 * Gets task with ID
	 */
	public async getTaskWithId(id: string): Promise<{
		task: Task | undefined
		historyItem: HistoryItem
	}> {
		return await this.taskManager.getTaskWithId(id)
	}

	/**
	 * Shows task with ID
	 */
	public async showTaskWithId(id: string): Promise<void> {
		await this.taskManager.showTaskWithId(id)
	}

	/**
	 * Exports task with ID
	 */
	public async exportTaskWithId(id: string): Promise<void> {
		await this.taskManager.exportTaskWithId(id)
	}

	/**
	 * Condenses task context
	 */
	public async condenseTaskContext(taskId: string): Promise<void> {
		await this.taskManager.condenseTaskContext(taskId)
	}

	/**
	 * Deletes task with ID
	 */
	public async deleteTaskWithId(id: string): Promise<void> {
		await this.taskManager.deleteTaskWithId(id)
	}

	/**
	 * Deletes task from state
	 */
	public async deleteTaskFromState(id: string): Promise<void> {
		await this.taskManager.deleteTaskFromState(id)
	}

	/**
	 * Posts state to webview
	 */
	public async postStateToWebview(): Promise<void> {
		const state = await this.stateCoordinator.getStateToPostToWebview()
		const currentTask = this.getCurrentTask()
		this.logger.debug(`[postStateToWebview] Posting state, currentTask: ${currentTask?.taskId ?? "none"}, clineMessages: ${currentTask?.clineMessages?.length ?? 0}`)
		await this.webviewCoordinator.postMessageToWebview({
			type: "state",
			state,
		})
	}

	/**
	 * Gets the current state to post to webview
	 */
	public async getStateToPostToWebview(): Promise<ExtensionState> {
		return this.stateCoordinator.getStateToPostToWebview()
	}

	/**
	 * Posts message to webview
	 */
	public async postMessageToWebview(message: ExtensionMessage): Promise<void> {
		await this.webviewCoordinator.postMessageToWebview(message)
	}

	/**
	 * Gets modes
	 */
	public async getModes(): Promise<{ slug: string; name: string }[]> {
		const customModes = await this.customModesManager.getCustomModes()
		return [
			{ slug: "code", name: "Code" },
			{ slug: "architect", name: "Architect" },
			{ slug: "ask", name: "Ask" },
			{ slug: "debug", name: "Debug" },
			...customModes.map(mode => ({ slug: mode.slug, name: mode.name }))
		]
	}

	/**
	 * Gets current mode
	 */
	public async getMode(): Promise<string> {
		return this.stateCoordinator.getGlobalState("mode") ?? defaultModeSlug
	}

	/**
	 * Sets mode
	 */
	public async setMode(mode: string): Promise<void> {
		const modeConfig = getModeBySlug(mode)
		if (!modeConfig) {
			throw new Error(t("common:errors.invalid_mode", { mode }))
		}

		await this.stateCoordinator.updateGlobalState("mode", mode)
		await this.providerCoordinator.updateTaskApiHandlerIfNeeded(modeConfig)
		await this.postStateToWebview()
	}

	/**
	 * Gets provider profiles
	 */
	public async getProviderProfiles(): Promise<{ name: string; provider?: string }[]> {
		return await this.providerCoordinator.getProviderProfiles()
	}

	/**
	 * Gets current provider profile
	 */
	public async getProviderProfile(): Promise<string> {
		return await this.providerCoordinator.getProviderProfile()
	}

	/**
	 * Gets provider profile entries
	 */
	public getProviderProfileEntries(): ProviderSettingsEntry[] {
		return this.contextProxy.getValues().listApiConfigMeta || []
	}

	/**
	 * Gets provider profile entry by name
	 */
	public getProviderProfileEntry(name: string): ProviderSettingsEntry | undefined {
		return this.getProviderProfileEntries().find((profile) => profile.name === name)
	}

	/**
	 * Sets provider profile
	 */
	public async setProviderProfile(name: string): Promise<void> {
		await this.providerCoordinator.setProviderProfile(name)
		await this.postStateToWebview()
	}

	/**
	 * Checks if provider profile entry exists
	 */
	public hasProviderProfileEntry(name: string): boolean {
		return this.providerCoordinator.hasProviderProfileEntry(name)
	}

	/**
	 * Upserts provider profile
	 */
	public async upsertProviderProfile(
		name: string,
		providerSettings: ProviderSettings,
		activate: boolean = true,
	): Promise<string | undefined> {
		const result = await this.providerCoordinator.upsertProviderProfile(name, providerSettings, activate)
		// 确保UI状态同步刷新
		await this.postStateToWebview()
		return result
	}

	/**
	 * Deletes provider profile
	 */
	public async deleteProviderProfile(profileToDelete: ProviderSettingsEntry): Promise<void> {
		await this.providerCoordinator.deleteProviderProfile(profileToDelete)
	}

	/**
	 * Activates provider profile
	 */
	public async activateProviderProfile(args: { name: string } | { id: string }): Promise<void> {
		const { name, id, providerSettings } = await this.providerCoordinator.activateProviderProfile(args)

		const { mode } = await this.stateCoordinator.getState()

		if (id) {
			await this._providerSettingsManager.setModeConfig(mode, id)
		}

		// Update the current API config name
		await this.contextProxy.setValue("currentApiConfigName", name)

		this.updateTaskApiHandlerIfNeeded(providerSettings, { forceRebuild: true })

		await this.postStateToWebview()

		if (providerSettings.apiProvider) {
			this.emit(RooCodeEventName.ProviderProfileChanged, { name, provider: providerSettings.apiProvider })
		}
	}

	/**
	 * Gets provider settings manager
	 */
	public get providerSettingsManager(): ProviderSettingsManager {
		return this._providerSettingsManager
	}

	/**
	 * Gets custom modes manager
	 */
	public get customModesManager(): CustomModesManager {
		return this._customModesManager
	}

	/**
	 * Updates custom instructions
	 */
	public async updateCustomInstructions(instructions?: string): Promise<void> {
		await this.stateCoordinator.updateGlobalState("customInstructions", instructions)
		await this.postStateToWebview()
	}

	/**
	 * Updates task API handler if needed based on provider settings
	 */
	private updateTaskApiHandlerIfNeeded(
		providerSettings: ProviderSettings,
		options: { forceRebuild?: boolean } = {},
	): void {
		const task = this.taskManager.getCurrentTask()
		if (!task) return

		const { forceRebuild = false } = options

		const prevConfig = task.apiConfiguration
		const prevProvider = prevConfig?.apiProvider
		const prevModelId = prevConfig ? getModelId(prevConfig) : undefined
		const prevToolProtocol = prevConfig?.toolProtocol
		const newProvider = providerSettings.apiProvider
		const newModelId = getModelId(providerSettings)
		const newToolProtocol = providerSettings.toolProtocol

		const needsRebuild =
			forceRebuild ||
			prevProvider !== newProvider ||
			prevModelId !== newModelId ||
			prevToolProtocol !== newToolProtocol

		if (needsRebuild) {
			task.updateApiConfiguration(providerSettings)
		} else {
			; (task as any).apiConfiguration = providerSettings
		}
	}

	/**
	 * Gets the full state
	 */
	public async getState(): Promise<
		Omit<
			ExtensionState,
			| "clineMessages"
			| "renderContext"
			| "hasOpenedModeSelector"
			| "version"
			| "shouldShowAnnouncement"
			| "hasSystemPromptOverride"
		>
	> {
		return this.stateCoordinator.getState()
	}

	/**
	 * Refreshes workspace
	 */
	public async refreshWorkspace(): Promise<void> {
		await this.postStateToWebview()
	}

	/**
	 * Updates task history
	 */
	public async updateTaskHistory(item: HistoryItem): Promise<HistoryItem[]> {
		const history = await this.stateCoordinator.updateTaskHistory(item)
		this.recentTasksCache = undefined
		return history
	}

	/**
	 * Handles mode switch
	 */
	public async handleModeSwitch(newMode: string): Promise<void> {
		this.logger.info(`Switching to mode: ${newMode}`)

		const task = this.taskManager.getCurrentTask()

		if (task) {
			this.logger.debug(`Task ${task.taskId} is active, updating mode`)
			task.emit(RooCodeEventName.TaskModeSwitched, task.taskId, newMode)

			try {
				const history = this.contextProxy.getValues().taskHistory ?? []
				const taskHistoryItem = history.find((item: HistoryItem) => item.id === task.taskId)

				if (taskHistoryItem) {
					taskHistoryItem.mode = newMode
					await this.updateTaskHistory(taskHistoryItem)
					this.logger.debug(`Updated task history for ${task.taskId}`)
				}

				; (task as any)._taskMode = newMode
			} catch (error) {
				this.logger.error(`Failed to persist mode switch for task ${task.taskId}`, error)
				throw error
			}
		}

		await this.contextProxy.setValue("mode", newMode)

		this.emit(RooCodeEventName.ModeChanged, newMode)

		const savedConfigId = await this._providerSettingsManager.getModeConfigId(newMode)
		const listApiConfig = await this._providerSettingsManager.listConfig()

		await this.contextProxy.setValue("listApiConfigMeta", listApiConfig)

		if (savedConfigId) {
			const profile = listApiConfig.find(({ id }) => id === savedConfigId)

			if (profile?.name) {
				await this.activateProviderProfile({ name: profile.name })
				this.logger.debug(`Activated provider profile: ${profile.name}`)
			}
		} else {
			const currentApiConfigName = this.contextProxy.getValues().currentApiConfigName
			if (currentApiConfigName) {
				// Find the config ID from the config name
				const currentConfig = listApiConfig.find(({ name }) => name === currentApiConfigName)
				if (currentConfig?.id) {
					await this._providerSettingsManager.setModeConfig(newMode, currentConfig.id)
					this.logger.debug(`Set mode config for ${newMode} to ${currentConfig.id}`)
				}
			}
		}

		await this.postStateToWebview()
		this.logger.info(`Mode switch completed: ${newMode}`)
	}

	/**
	 * Adds Cline instance to stack
	 */
	public async addClineToStack(instance: any): Promise<void> {
		await this.taskManager.addClineToStack(instance)
	}

	/**
	 * Gets task stack size
	 */
	public getTaskStackSize(): number {
		return this.taskManager.getTaskStackSize()
	}

	/**
	 * Checks if there's a file-based system prompt override
	 */
	/**
	 * Sets configuration value
	 */
	public async setValue<K extends keyof RooCodeSettings>(key: K, value: RooCodeSettings[K]): Promise<void> {
		await this.stateCoordinator.setValue(key, value)
		await this.postStateToWebview()
	}

	/**
	 * Gets configuration value
	 */
	public getValue<K extends keyof RooCodeSettings>(key: K): RooCodeSettings[K] | undefined {
		return this.stateCoordinator.getValue(key)
	}

	/**
	 * Gets all configuration values
	 */
	public getValues(): RooCodeSettings {
		return this.stateCoordinator.getValues()
	}

	/**
	 * Sets multiple configuration values
	 */
	public async setValues(values: RooCodeSettings): Promise<void> {
		await this.stateCoordinator.setValues(values)
		await this.postStateToWebview()
	}

	/**
	 * Resets state
	 */
	public async resetState(): Promise<void> {
		const answer = await vscode.window.showInformationMessage(
			t("common:confirmation.reset_state"),
			{ modal: true },
			t("common:answers.yes"),
		)

		if (answer !== t("common:answers.yes")) {
			return
		}

		await this.stateCoordinator.resetState()
		await this.providerSettingsManager.resetAllConfigs()
		await this.customModesManager.resetCustomModes()
		await this.taskManager.clearTask()
		await this.postStateToWebview()
		await this.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
	}

	/**
	 * Logs a message
	 */
	public log(message: string): void {
		this.logger.info(message)
	}

	/**
	 * Gets workspace tracker
	 */
	public get workspaceTracker(): WorkspaceTracker | undefined {
		return this._workspaceTracker
	}

	/**
	 * Gets MCP hub
	 */
	public getMcpHub(): McpHub | undefined {
		return this.mcpHub
	}

	/**
	 * Gets current workspace code index manager
	 */
	public getCurrentWorkspaceCodeIndexManager(): CodeIndexManager | undefined {
		const workspacePath = this.currentWorkspacePath
		if (!workspacePath) {
			return undefined
		}
		return CodeIndexManager.getInstance(this.context, workspacePath)
	}

	/**
	 * Updates code index status subscription to listen to the current workspace manager
	 */
	private updateCodeIndexStatusSubscription(): void {
		const currentManager = this.getCurrentWorkspaceCodeIndexManager()

		if (currentManager === this.codeIndexManager) {
			return
		}

		if (this.codeIndexStatusSubscription) {
			this.codeIndexStatusSubscription.dispose()
			this.codeIndexStatusSubscription = undefined
		}

		if (this.configUpgradeStatusSubscription) {
			this.configUpgradeStatusSubscription.dispose()
			this.configUpgradeStatusSubscription = undefined
		}

		this.codeIndexManager = currentManager

		if (currentManager) {
			this.codeIndexStatusSubscription = currentManager.onProgressUpdate((update: any) => {
				if (currentManager === this.getCurrentWorkspaceCodeIndexManager()) {
					const fullStatus = currentManager.getCurrentStatus()
					this.postMessageToWebview({
						type: "indexingStatusUpdate",
						values: fullStatus,
					})
				}
			})

			this.configUpgradeStatusSubscription = currentManager.onConfigUpgradeStatusUpdate((progress: any) => {
				if (currentManager === this.getCurrentWorkspaceCodeIndexManager()) {
					this.postMessageToWebview({
						type: "configUpgradeStatusUpdate",
						values: {
							collectionName: progress.collectionName,
							workspacePath: this.currentWorkspacePath,
							currentPreset: progress.currentPreset,
							targetPreset: progress.targetPreset,
							status: progress.status,
							progress: progress.progress,
							message: progress.message,
							error: progress.error,
							startTime: progress.startTime,
							endTime: progress.endTime,
							steps: progress.steps,
						},
					})
				}
			})

			if (this.view) {
				this.webviewDisposables.push(this.codeIndexStatusSubscription)
				this.webviewDisposables.push(this.configUpgradeStatusSubscription)
			}

			this.postMessageToWebview({
				type: "indexingStatusUpdate",
				values: currentManager.getCurrentStatus(),
			})

			const currentUpgrade = currentManager.getCurrentConfigUpgradeProgress()
			if (currentUpgrade) {
				this.postMessageToWebview({
					type: "configUpgradeStatusUpdate",
					values: {
						collectionName: currentUpgrade.collectionName,
						workspacePath: this.currentWorkspacePath,
						currentPreset: currentUpgrade.currentPreset,
						targetPreset: currentUpgrade.targetPreset,
						status: currentUpgrade.status,
						progress: currentUpgrade.progress,
						message: currentUpgrade.message,
						error: currentUpgrade.error,
						startTime: currentUpgrade.startTime,
						endTime: currentUpgrade.endTime,
						steps: currentUpgrade.steps,
					},
				})
			}
		}
	}

	/**
	 * Updates code index status subscription
	 */
	/**
	 * Gets current CWD
	 */
	public get cwd(): string {
		return this.currentWorkspacePath || ""
	}

	/**
	 * Gets app properties
	 */
	public get appProperties() {
		return {
			extensionVersion: Package.version,
			vscodeVersion: vscode.version,
			locale: vscode.env.language,
			platform: os.platform(),
			architecture: process.arch,
		}
	}

	/**
	 * Converts to webview URI
	 */
	public convertToWebviewUri(filePath: string): string {
		const view = this.webviewCoordinator.getView()
		if (!view) {
			throw new Error("Webview view not available")
		}
		return view.webview.asWebviewUri(vscode.Uri.file(filePath)).toString()
	}

	/**
	 * Gets the current workspace path
	 */
	public getCurrentWorkspacePath(): string | undefined {
		return this.currentWorkspacePath
	}

	/**
	 * Ensures MCP servers directory exists
	 */
	public async ensureMcpServersDirectoryExists(): Promise<string> {
		const settingsDir = await getSettingsDirectoryPath(this.context.globalStorageUri.fsPath)
		const mcpServersDir = path.join(settingsDir, "mcp_servers")
		await fs.mkdir(mcpServersDir, { recursive: true })
		return mcpServersDir
	}

	/**
	 * Ensures settings directory exists
	 */
	public async ensureSettingsDirectoryExists(): Promise<string> {
		return await getSettingsDirectoryPath(this.context.globalStorageUri.fsPath)
	}

	/**
	 * Gets git properties
	 */
	public get gitProperties(): GitProperties | undefined {
		// Return cached git properties if available, otherwise fall back to basic properties
		if (this.cachedGitProperties) {
			return this.cachedGitProperties
		}

		const cwd = this.cwd
		if (!cwd) return undefined

		try {
			// Fallback to basic git properties if cache is not available
			return {
				gitExecutablePath: "git",
				gitDir: cwd,
				workingDirectory: cwd,
			}
		} catch {
			return undefined
		}
	}

	/**
	 * Initializes git properties asynchronously
	 */
	private async initializeGitProperties(): Promise<void> {
		const cwd = this.cwd
		if (!cwd) {
			this.cachedGitProperties = undefined
			return
		}

		try {
			const gitInfo = await getWorkspaceGitInfo()

			// Combine git info with basic properties
			this.cachedGitProperties = {
				gitExecutablePath: gitInfo.repositoryUrl ? "git" : undefined,
				gitVersion: undefined, // Would require executing git --version
				gitDir: cwd,
				workingDirectory: cwd,
				// Add any additional git info if available
				...(gitInfo.repositoryUrl && { repositoryUrl: gitInfo.repositoryUrl }),
				...(gitInfo.repositoryName && { repositoryName: gitInfo.repositoryName }),
				...(gitInfo.defaultBranch && { defaultBranch: gitInfo.defaultBranch }),
			}
		} catch (error) {
			this.logger.warn(`Failed to initialize git properties: ${error}`)
			// Still set basic properties as fallback
			this.cachedGitProperties = {
				gitExecutablePath: "git",
				gitDir: cwd,
				workingDirectory: cwd,
			}
		}
	}

	/**
	 * Gets the visible instance
	 */
	public static getVisibleInstance(): ClineProvider | undefined {
		return findLast(Array.from(this.activeInstances), (instance: ClineProvider) => instance.webviewCoordinator.getView()?.visible === true)
	}

	/**
	 * Static method to get all active instances
	 */
	public static getActiveInstances(): Set<ClineProvider> {
		return this.activeInstances
	}

	/**
	 * Static method to get instance
	 */
	public static async getInstance(): Promise<ClineProvider | undefined> {
		let visibleProvider = ClineProvider.getVisibleInstance()

		if (!visibleProvider) {
			await vscode.commands.executeCommand(`${Package.name}.SidebarProvider.focus`)
			await new Promise(resolve => setTimeout(resolve, 100))
			visibleProvider = ClineProvider.getVisibleInstance()
		}

		return visibleProvider
	}

	/**
	 * Static method to check if there's an active task
	 */
	public static async isActiveTask(): Promise<boolean> {
		const visibleProvider = await ClineProvider.getInstance()
		return visibleProvider ? visibleProvider.getCurrentTask() !== undefined : false
	}

	/**
	 * Static method to handle code action
	 */
	public static async handleCodeAction(
		command: CodeActionId,
		promptType: CodeActionName,
		params: Record<string, string | any[]>,
	): Promise<void> {
		const visibleProvider = await ClineProvider.getInstance()
		if (!visibleProvider) {
			return
		}

		const { supportPrompt } = require("../prompts/support-prompt")
		const { customSupportPrompts } = await visibleProvider.stateCoordinator.getState()

		const prompt = supportPrompt.create(promptType, params, customSupportPrompts)

		if (command === "addToContext") {
			await visibleProvider.postMessageToWebview({
				type: "invoke",
				invoke: "setChatBoxMessage",
				text: `${prompt}\n\n`,
			})
			await visibleProvider.postMessageToWebview({ type: "action", action: "focusInput" })
			return
		}

		try {
			await visibleProvider.createTask(prompt)
		} catch (error) {
			if (error instanceof Error) {
				vscode.window.showErrorMessage(error.message)
			}
		}
	}

	/**
	 * Static method to handle terminal action
	 */
	public static async handleTerminalAction(
		command: TerminalActionId,
		promptType: TerminalActionPromptType,
		params: Record<string, string | any[]>,
	): Promise<void> {
		const visibleProvider = await ClineProvider.getInstance()
		if (!visibleProvider) {
			return
		}

		const { supportPrompt } = require("../prompts/support-prompt")
		const { customSupportPrompts } = await visibleProvider.stateCoordinator.getState()

		const prompt = supportPrompt.create(promptType, params, customSupportPrompts)

		if (command === "terminalAddToContext") {
			await visibleProvider.postMessageToWebview({
				type: "invoke",
				invoke: "setChatBoxMessage",
				text: `${prompt}\n\n`,
			})
			await visibleProvider.postMessageToWebview({ type: "action", action: "focusInput" })
			return
		}

		try {
			await visibleProvider.createTask(prompt)
		} catch (error) {
			if (error instanceof Error) {
				vscode.window.showErrorMessage(error.message)
			}
		}
	}

	/**
	 * Disposes the provider and all its resources
	 */
	public async dispose(): Promise<void> {
		this.logger.info("Disposing ClineProvider...")

		try {
			if (this.codeIndexStatusSubscription) {
				this.codeIndexStatusSubscription.dispose()
				this.codeIndexStatusSubscription = undefined
			}

			if (this.configUpgradeStatusSubscription) {
				this.configUpgradeStatusSubscription.dispose()
				this.configUpgradeStatusSubscription = undefined
			}

			this.codeIndexManager = undefined

			await this.taskManager.dispose()
			this.logger.debug("TaskManager disposed")

			this.webviewCoordinator.dispose()
			this.logger.debug("WebviewCoordinator disposed")

			this.stateCoordinator.dispose()
			this.logger.debug("StateCoordinator disposed")

			this._workspaceTracker?.dispose()
			this.logger.debug("WorkspaceTracker disposed")

			if (this.mcpHub) {
				await this.mcpHub.unregisterClient()
				this.logger.debug("MCP Hub unregistered")
			}

			this.customModesManager.dispose()
			this.logger.debug("CustomModesManager disposed")

			while (this.disposables.length) {
				const x = this.disposables.pop()
				if (x) {
					x.dispose()
				}
			}
			this.logger.debug("All disposables cleared")

			this.removeAllListeners()
			this.logger.debug("All event listeners removed")

			ClineProvider.activeInstances.delete(this)
			this.logger.debug("Removed from active instances")

			McpServerManager.unregisterProvider(this as any)
			this.logger.debug("Unregistered from MCP server manager")

			this.logger.info("ClineProvider disposed successfully")
		} catch (error) {
			this.logger.error("Error during ClineProvider disposal", error)
			throw error
		}
	}
}