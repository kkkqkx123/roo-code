import * as vscode from "vscode"
import EventEmitter from "events"

import {
	type TaskProviderLike,
	type TaskProviderEvents,
	type GlobalState,
	type ProviderName,
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
	type ClineMessage,
	type TodoItem,
	type ModeConfig,
	RooCodeEventName,
	DEFAULT_TERMINAL_OUTPUT_CHARACTER_LIMIT,
	DEFAULT_WRITE_DELAY_MS,
	ORGANIZATION_ALLOW_ALL,
	DEFAULT_MODES,
	DEFAULT_CHECKPOINT_TIMEOUT_SECONDS,
	getModelId,
	requestyDefaultModelId,
	openRouterDefaultModelId,
} from "@roo-code/types"

import { Package } from "../../shared/package"
import { WebviewMessage } from "../../shared/WebviewMessage"
import type { ExtensionMessage, ExtensionState, MarketplaceInstalledMetadata } from "../../shared/ExtensionMessage"
import { EMBEDDING_MODEL_PROFILES } from "../../shared/embeddingModels"
import { Mode, defaultModeSlug, getModeBySlug } from "../../shared/modes"
import { t } from "../../i18n"
import { experimentDefault } from "../../shared/experiments"
import { formatLanguage } from "../../shared/language"
import { findLast } from "../../shared/array"
import os from "os"

import WorkspaceTracker from "../../integrations/workspace/WorkspaceTracker"
import { McpHub } from "../../services/mcp/McpHub"
import { McpServerManager } from "../../services/mcp/McpServerManager"
import { MarketplaceManager } from "../../services/marketplace"
import { ShadowCheckpointService } from "../../services/checkpoints/ShadowCheckpointService"
import { CodeIndexManager } from "../../services/code-index/manager"
import { MdmService } from "../../services/mdm/MdmService"

import { getWorkspacePath } from "../../utils/path"
import { OrganizationAllowListViolationError } from "../../utils/errors"
import { getWorkspaceGitInfo } from "../../utils/git"
import { getTheme } from "../../integrations/theme/getTheme"

import { ContextProxy } from "../config/ContextProxy"
import { ProviderSettingsManager } from "../config/ProviderSettingsManager"
import { CustomModesManager } from "../config/CustomModesManager"
import { Task } from "../task/Task"

import { webviewMessageHandler } from "./webviewMessageHandler"
import { TaskManager } from "../task/TaskManager"
import { WebviewCoordinator } from "./WebviewCoordinator"
import { ProviderCoordinator } from "../providers/ProviderCoordinator"
import { StateCoordinator } from "../state/StateCoordinator"

/**
 * Refactored ClineProvider that delegates responsibilities to specialized coordinators
 */
export class ClineProvider
	extends EventEmitter<TaskProviderEvents>
	implements vscode.WebviewViewProvider, TaskProviderLike
{
	public static readonly sideBarId = `${Package.name}.SidebarProvider`
	public static readonly tabPanelId = `${Package.name}.TabPanelProvider`
	
	private static activeInstances: Set<ClineProvider> = new Set()
	private disposables: vscode.Disposable[] = []
	
	public readonly context: vscode.ExtensionContext
	private outputChannel: vscode.OutputChannel
	private renderContext: "sidebar" | "editor"
	public readonly contextProxy: ContextProxy
	private mdmService?: MdmService
	
	// Webview related
	private webviewDisposables: vscode.Disposable[] = []
	private view?: vscode.WebviewView | vscode.WebviewPanel
	
	// Task related
	private clineStack: Task[] = []
	private taskCreationCallback: (task: Task) => void
	private taskEventListeners: WeakMap<Task, Array<() => void>> = new WeakMap()
	
	// Coordinator instances
	private taskManager!: TaskManager
	private webviewCoordinator!: WebviewCoordinator
	private providerCoordinator!: ProviderCoordinator
	private stateCoordinator!: StateCoordinator
	
	// Service instances
	private _workspaceTracker?: WorkspaceTracker
	private mcpHub?: McpHub
	private marketplaceManager!: MarketplaceManager
	private _providerSettingsManager!: ProviderSettingsManager
	private _customModesManager!: CustomModesManager
	
	private codeIndexStatusSubscription?: vscode.Disposable
	private codeIndexManager?: CodeIndexManager
	
	// Other properties
	private recentTasksCache?: string[]
	private pendingOperations: Map<string, any> = new Map()
	public isViewLaunched = false
	
	private currentWorkspacePath: string | undefined
	public settingsImportedAt?: number
	public readonly latestAnnouncementId = "dec-2025-v3.36.0-context-rewind-roo-provider"

	constructor(
		context: vscode.ExtensionContext,
		outputChannel: vscode.OutputChannel,
		renderContext: "sidebar" | "editor" = "sidebar",
		contextProxy: ContextProxy,
		mdmService?: MdmService,
	) {
		super()
		
		this.context = context
		this.outputChannel = outputChannel
		this.renderContext = renderContext
		this.contextProxy = contextProxy
		this.mdmService = mdmService
		
		this.currentWorkspacePath = getWorkspacePath()
		ClineProvider.activeInstances.add(this)
		
		// Initialize task creation callback
		this.taskCreationCallback = (instance: Task) => {
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

			// Store the cleanup functions for later removal.
			this.taskEventListeners.set(instance, [
				() => instance.off(RooCodeEventName.TaskStarted, onTaskStarted),
				() => instance.off(RooCodeEventName.TaskCompleted, onTaskCompleted),
				() => instance.off(RooCodeEventName.TaskAborted, onTaskAborted),
				() => instance.off(RooCodeEventName.TaskFocused, onTaskFocused),
				() => instance.off(RooCodeEventName.TaskUnfocused, onTaskUnfocused),
				() => instance.off(RooCodeEventName.TaskActive, onTaskActive),
				() => instance.off(RooCodeEventName.TaskInteractive, onTaskInteractive),
				() => instance.off(RooCodeEventName.TaskResumable, onTaskResumable),
				() => instance.off(RooCodeEventName.TaskIdle, onTaskIdle),
				() => instance.off(RooCodeEventName.TaskUserMessage, onTaskUserMessage),
				() => instance.off(RooCodeEventName.TaskPaused, onTaskPaused),
				() => instance.off(RooCodeEventName.TaskUnpaused, onTaskUnpaused),
				() => instance.off(RooCodeEventName.TaskSpawned, onTaskSpawned),
				() => instance.off(RooCodeEventName.TaskTokenUsageUpdated, onTaskTokenUsageUpdated),
			])
		}
		
		// Initialize coordinators
		this.initializeCoordinators()
		
		// Initialize services
		this.initializeServices()
		
		// Set up event handling
		this.setupEventHandling()
	}

	/**
	 * Initializes the coordinator instances
	 */
	private initializeCoordinators(): void {
		// Initialize StateCoordinator first (without TaskManager to avoid circular dependency)
		this.stateCoordinator = new StateCoordinator(this.contextProxy, this.mcpHub)
		
		// Initialize TaskManager with task creation callback
		this.taskManager = new TaskManager(
			this.taskCreationCallback,
			this,
			async () => (await this.stateCoordinator.getState()).apiConfiguration,
			() => this.stateCoordinator.getState(),
		)
		
		// Set TaskManager in StateCoordinator to enable isBrowserSessionActive check
		this.stateCoordinator.setTaskManager(this.taskManager)
		
		// Initialize WebviewCoordinator
		this.webviewCoordinator = new WebviewCoordinator(this.context, this.outputChannel)
		
		// Initialize ProviderCoordinator
		this.providerCoordinator = new ProviderCoordinator(this.context, this.contextProxy)
		
		// Set up coordinator event forwarding
		this.taskManager.on(RooCodeEventName.TaskCreated, (task) => {
			this.emit(RooCodeEventName.TaskCreated, task)
		})
	}

	/**
	 * Initializes service instances
	 */
	private initializeServices(): void {
		this._workspaceTracker = new WorkspaceTracker(this)
		this._providerSettingsManager = new ProviderSettingsManager(this.context)
		this._customModesManager = new CustomModesManager(this.context, async () => {
			await this.postStateToWebview()
		})
		
		// Initialize MCP Hub
		McpServerManager.getInstance(this.context, this)
			.then((hub) => {
				this.mcpHub = hub
				this.mcpHub.registerClient()
			})
			.catch((error) => {
				this.log(`Failed to initialize MCP Hub: ${error}`)
			})
		
		this.marketplaceManager = new MarketplaceManager(this.context, this._customModesManager)
		
		// Set codebase index models
		this.stateCoordinator.updateGlobalState("codebaseIndexModels", EMBEDDING_MODEL_PROFILES)
	}

	/**
	 * Sets up event handling
	 */
	private setupEventHandling(): void {
		// Set up any additional event handling needed
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
		await this.webviewCoordinator.resolveWebviewView(webviewView)
		
		// Post initial state to webview
		await this.postStateToWebview()
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
		if (configuration) {
			await this.setValues(configuration)
		}
		return await this.taskManager.createTask(text || "", options)
	}

	/**
	 * Creates a task with history item
	 */
	public async createTaskWithHistoryItem(historyItem: HistoryItem & {
		rootTask?: string
		parentTask?: string
	}): Promise<Task> {
		return await this.taskManager.createTaskWithHistoryItem(historyItem)
	}

	/**
	 * Cancels the current task
	 */
	public async cancelTask(): Promise<void> {
		await this.taskManager.cancelTask()
	}

	/**
	 * Clears the current task
	 */
	public async clearTask(): Promise<void> {
		await this.taskManager.clearTask()
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
	 * Removes and destroys the top Cline instance (the current finished task),
	 * activating the previous one (resuming the parent task).
	 */
	async removeClineFromStack() {
		if (this.clineStack.length === 0) {
			return
		}

		// Pop the top Cline instance from the stack.
		let task = this.clineStack.pop()

		if (task) {
			task.emit(RooCodeEventName.TaskUnfocused)

			try {
				// Abort the running task and set isAbandoned to true so
				// all running promises will exit as well.
				await task.abortTask(true)
			} catch (e) {
				this.log(
					`[ClineProvider#removeClineFromStack] abortTask() failed ${task.taskId}.${task.instanceId}: ${e.message}`,
				)
			}

			// Remove event listeners before clearing the reference.
			const cleanupFunctions = this.taskEventListeners.get(task)

			if (cleanupFunctions) {
				cleanupFunctions.forEach((cleanup) => cleanup())
				this.taskEventListeners.delete(task)
			}

			// Make sure no reference kept, once promises end it will be
			// garbage collected.
			task = undefined
		}
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
			throw new Error(`Invalid mode: ${mode}`)
		}
		
		await this.stateCoordinator.updateGlobalState("mode", mode)
		await this.providerCoordinator.updateTaskApiHandlerIfNeeded(
			modeConfig,
			await this.hasFileBasedSystemPromptOverride(mode)
		)
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
		return await this.providerCoordinator.upsertProviderProfile(name, providerSettings, activate)
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
			;(task as any).apiConfiguration = providerSettings
		}
	}

	/**
	 * Ensures MCP servers directory exists
	 */
	public async ensureMcpServersDirectoryExists(): Promise<string> {
		const mcpServersPath = vscode.Uri.joinPath(this.context.globalStorageUri, "mcp_servers").fsPath
		await vscode.workspace.fs.createDirectory(vscode.Uri.file(mcpServersPath))
		return mcpServersPath
	}

	/**
	 * Ensures settings directory exists
	 */
	public async ensureSettingsDirectoryExists(): Promise<string> {
		const settingsPath = vscode.Uri.joinPath(this.context.globalStorageUri, "settings").fsPath
		await vscode.workspace.fs.createDirectory(vscode.Uri.file(settingsPath))
		return settingsPath
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
	 * Handles OpenRouter callback
	 */
	public async handleOpenRouterCallback(code: string): Promise<void> {
		await this.providerCoordinator.handleOpenRouterCallback(code)
		await this.postStateToWebview()
	}

	/**
	 * Handles Requesty callback
	 */
	public async handleRequestyCallback(code: string, baseUrl: string | null): Promise<void> {
		await this.providerCoordinator.handleRequestyCallback(code, baseUrl)
		await this.postStateToWebview()
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
		const task = this.taskManager.getCurrentTask()

		if (task) {
			task.emit(RooCodeEventName.TaskModeSwitched, task.taskId, newMode)

			try {
				const history = this.contextProxy.getValues().taskHistory ?? []
				const taskHistoryItem = history.find((item) => item.id === task.taskId)

				if (taskHistoryItem) {
					taskHistoryItem.mode = newMode
					await this.updateTaskHistory(taskHistoryItem)
				}

				;(task as any)._taskMode = newMode
			} catch (error) {
				this.log(
					`Failed to persist mode switch for task ${task.taskId}: ${error instanceof Error ? error.message : String(error)}`,
				)
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
			}
		} else {
			const currentApiConfigName = this.contextProxy.getValues().currentApiConfigName
			if (currentApiConfigName) {
				await this._providerSettingsManager.setModeConfig(newMode, currentApiConfigName)
			}
		}

		await this.postStateToWebview()
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
		this.clearPendingEditOperation(operationId)

		const timeoutId = setTimeout(() => {
			this.clearPendingEditOperation(operationId)
			this.log(`[setPendingEditOperation] Automatically cleared stale pending operation: ${operationId}`)
		}, 300000)

		this.pendingOperations.set(operationId, {
			...editData,
			timeoutId,
			createdAt: Date.now(),
		})

		this.log(`[setPendingEditOperation] Set pending operation: ${operationId}`)
	}

	/**
	 * Clears a specific pending edit operation
	 */
	private clearPendingEditOperation(operationId: string): boolean {
		const operation = this.pendingOperations.get(operationId)
		if (operation) {
			clearTimeout(operation.timeoutId)
			this.pendingOperations.delete(operationId)
			this.log(`[clearPendingEditOperation] Cleared pending operation: ${operationId}`)
			return true
		}
		return false
	}

	/**
	 * Fetches marketplace data
	 */
	public async fetchMarketplaceData(): Promise<void> {
		try {
			await this.marketplaceManager.getMarketplaceItems()
		} catch (error) {
			console.error("Failed to fetch marketplace data:", error)
		}
	}

	/**
	 * Checks if there's a file-based system prompt override
	 */
	public async hasFileBasedSystemPromptOverride(mode: Mode): Promise<boolean> {
		// Implementation would depend on the actual file-based system prompt logic
		return false
	}

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
		await this.stateCoordinator.resetState()
		await this.postStateToWebview()
	}

	/**
	 * Logs a message
	 */
	public log(message: string): void {
		this.outputChannel.appendLine(message)
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
	 * Checks MDM compliance
	 */
	public checkMdmCompliance(): boolean {
		if (!this.mdmService) {
			return true // No MDM service, allow operation
		}
		const compliance = this.mdmService.isCompliant()
		return compliance.compliant
	}

	/**
	 * Enables/disables remote control
	 */
	public async remoteControlEnabled(enabled: boolean): Promise<void> {
		// Remote control functionality removed
	}

	/**
	 * Gets current workspace code index manager
	 */
	public getCurrentWorkspaceCodeIndexManager(): CodeIndexManager | undefined {
		return this.codeIndexManager
	}

	/**
	 * Updates code index status subscription
	 */
	private updateCodeIndexStatusSubscription(): void {
		// Implementation would depend on the actual code index status logic
	}

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
	 * Gets git properties
	 */
	public get gitProperties(): Record<string, string> | undefined {
		// Implementation would depend on the actual git properties logic
		return undefined
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
	 * Static method to get/**
	 * Gets the visible instance
	 */
	public static getVisibleInstance(): ClineProvider | undefined {
		return findLast(Array.from(this.activeInstances), (instance: ClineProvider) => instance.webviewCoordinator.getView()?.visible === true)
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

		const { supportPrompt } = require("../../shared/support-prompt")
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

		await visibleProvider.createTask(prompt)
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

		const { supportPrompt } = require("../../shared/support-prompt")
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
			if (error instanceof OrganizationAllowListViolationError) {
				vscode.window.showErrorMessage(error.message)
			}
		}
	}

	/**
	 * Disposes the provider and all its resources
	 */
	public async dispose(): Promise<void> {
		this.log("Disposing ClineProvider...")

		// Dispose coordinators
		await this.taskManager.dispose()
		this.webviewCoordinator.dispose()
		this.providerCoordinator.dispose()
		this.stateCoordinator.dispose()

		// Dispose services
		this._workspaceTracker?.dispose()
		if (this.mcpHub) {
			await this.mcpHub.unregisterClient()
		}
		this.marketplaceManager.cleanup()
		this.customModesManager.dispose()

		// Clear disposables
		while (this.disposables.length) {
			const x = this.disposables.pop()
			if (x) {
				x.dispose()
			}
		}

		// Remove event listeners
		this.removeAllListeners()
		
		// Remove from active instances
		ClineProvider.activeInstances.delete(this)
		
		// Unregister from MCP server manager
		McpServerManager.unregisterProvider(this as any)
		
		this.log("ClineProvider disposed")
	}
}