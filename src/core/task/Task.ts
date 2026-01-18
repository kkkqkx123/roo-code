import * as path from "path"
import os from "os"
import crypto from "crypto"
import EventEmitter from "events"

import { Anthropic } from "@anthropic-ai/sdk"

import {
	type TaskLike,
	type TaskMetadata,
	type TaskEvents,
	type ProviderSettings,
	type TokenUsage,
	type ToolUsage,
	type ToolName,
	type ContextCondense,
	type ContextTruncation,
	type ClineMessage,
	type ClineSay,
	type ClineAsk,
	type ToolProgressStatus,
	type HistoryItem,
	type CreateTaskOptions,
	type ToolProtocol,
	RooCodeEventName,
	TaskStatus,
	TodoItem,
	isNativeProtocol,
	QueuedMessage,
	DEFAULT_CONSECUTIVE_MISTAKE_LIMIT,
	DEFAULT_CHECKPOINT_TIMEOUT_SECONDS,
	MAX_CHECKPOINT_TIMEOUT_SECONDS,
	MIN_CHECKPOINT_TIMEOUT_SECONDS,
} from "@shared/types"

// api
import { ApiHandler, buildApiHandler } from "../../api"
import { ApiStream } from "../../api/transform/stream"

// shared
import { ClineApiReqCancelReason } from "../../shared/ExtensionMessage"
import { ClineAskResponse } from "../../shared/WebviewMessage"
import { defaultModeSlug } from "../../shared/modes"
import { DiffStrategy, type ToolResponse } from "../../shared/tools"
import { EXPERIMENT_IDS, experiments } from "../../shared/experiments"

// services
import { UrlContentFetcher } from "../../services/browser/UrlContentFetcher"
import { RepoPerTaskCheckpointService } from "../../services/checkpoints"

// integrations
import { DiffViewProvider } from "../../integrations/editor/DiffViewProvider"
import { RooTerminalProcess } from "../../integrations/terminal/types"

// utils
import { getWorkspacePath } from "../../utils/path"

// core modules
import { ToolRepetitionDetector } from "../tools/ToolRepetitionDetector"
import { FileContextTracker } from "../context-tracking/FileContextTracker"
import { RooIgnoreController } from "../ignore/RooIgnoreController"
import { RooProtectedController } from "../protect/RooProtectedController"
import { AssistantMessageParser } from "../assistant-message/AssistantMessageParser"
import { ClineProvider } from "../webview/ClineProvider"
import { MultiSearchReplaceDiffStrategy } from "../diff/strategies/multi-search-replace"
import { MultiFileSearchReplaceDiffStrategy } from "../diff/strategies/multi-file-search-replace"
import {
	type ApiMessage,
	taskMetadata,
} from "../task-persistence"
import {
	type CheckpointDiffOptions,
	type CheckpointRestoreOptions,
} from "../checkpoints"
import { summarizeConversation } from "../condense"
import { AutoApprovalHandler } from "../auto-approval"
import { validateAndFixToolResultIds } from "./validateToolResultIds"

// Managers
import {
	TaskStateManager,
	ApiRequestManager,
	MessageManager as TaskMessageManager,
	ConversationRewindManager,
	ToolExecutor,
	UserInteractionManager,
	FileEditorManager,
	CheckpointManager,
	ContextManager,
	UsageTracker,
	ConfigurationManager,
	SubtaskManager,
	TaskLifecycleManager,
	StreamingManager,
	PromptManager,
	MessageQueueManager,
	BrowserSessionManager,
	ConversationHistoryManager,
} from "./managers"
import { IndexManager } from "./managers/core/IndexManager"

// New architecture components
import { TaskContainer, TOKENS } from "./TaskContainer"
import { TaskEventBus } from "./TaskEventBus"

export interface TaskOptions extends CreateTaskOptions {
	provider: ClineProvider
	apiConfiguration: ProviderSettings
	enableDiff?: boolean
	enableCheckpoints?: boolean
	checkpointTimeout?: number
	enableBridge?: boolean
	fuzzyMatchThreshold?: number
	consecutiveMistakeLimit?: number
	task?: string
	images?: string[]
	historyItem?: HistoryItem
	experiments?: Record<string, boolean>
	startTask?: boolean
	rootTask?: Task
	parentTask?: Task
	taskNumber?: number
	onCreated?: (task: Task) => void
	initialTodos?: TodoItem[]
	workspacePath?: string
	/** Initial status for the task's history item (e.g., "active" for child tasks) */
	initialStatus?: "active" | "delegated" | "completed"
}

export class Task extends EventEmitter<TaskEvents> implements TaskLike {
	readonly taskId: string
	readonly rootTaskId?: string
	readonly parentTaskId?: string
	childTaskId?: string
	pendingNewTaskToolCallId?: string

	readonly instanceId: string
	readonly metadata: TaskMetadata

	todoList?: TodoItem[]

	readonly rootTask: Task | undefined = undefined
	readonly parentTask: Task | undefined = undefined
	readonly taskNumber: number
	readonly workspacePath: string

	providerRef: WeakRef<ClineProvider>
	private readonly globalStoragePath: string
	abort: boolean = false
	currentRequestAbortController?: AbortController
	skipPrevResponseIdOnce: boolean = false

	// TaskStatus
	idleAsk?: ClineMessage
	resumableAsk?: ClineMessage
	interactiveAsk?: ClineMessage

	didFinishAbortingStream = false
	abandoned = false
	abortReason?: ClineApiReqCancelReason
	isInitialized = false
	isPaused: boolean = false

	// API
	apiConfiguration: ProviderSettings
	api: ApiHandler
	private static lastGlobalApiRequestTime?: number
	private autoApprovalHandler: AutoApprovalHandler

	/**
	 * Reset the global API request timestamp. This should only be used for testing.
	 * @internal
	 */
	static resetGlobalApiRequestTime(): void {
		Task.lastGlobalApiRequestTime = undefined
	}

	toolRepetitionDetector: ToolRepetitionDetector
	rooIgnoreController?: RooIgnoreController
	rooProtectedController?: RooProtectedController
	fileContextTracker: FileContextTracker
	urlContentFetcher: UrlContentFetcher
	terminalProcess?: RooTerminalProcess

	// Computer User
	private _browserSessionManager?: BrowserSessionManager

	// Editing
	diffViewProvider: DiffViewProvider
	diffStrategy?: DiffStrategy
	diffEnabled: boolean = false
	fuzzyMatchThreshold: number
	didEditFile: boolean = false

	// Ask
	private askResponse?: ClineAskResponse
	private askResponseText?: string
	private askResponseImages?: string[]
	public lastMessageTs?: number
	private autoApprovalTimeoutRef?: NodeJS.Timeout

	// Tool Use
	consecutiveMistakeCount: number = 0
	consecutiveMistakeLimit: number
	consecutiveMistakeCountForApplyDiff: Map<string, number> = new Map()
	consecutiveNoToolUseCount: number = 0
	didRejectTool = false
	didAlreadyUseTool = false
	didToolFailInCurrentTurn = false
	didCompleteReadingStream = false

	// Checkpoints
	enableCheckpoints: boolean
	checkpointTimeout: number
	checkpointService?: RepoPerTaskCheckpointService
	checkpointServiceInitializing = false

	// Task Bridge
	enableBridge: boolean

	// Cloud Sync Tracking
	private cloudSyncedMessageTimestamps: Set<number> = new Set()

	// Initial status for the task's history item (set at creation time to avoid race conditions)
	private readonly initialStatus?: "active" | "delegated" | "completed"

	// ConversationRewindManager for high-level message operations (lazy initialized)
	private _conversationRewindManager?: ConversationRewindManager

	// New Architecture Components
	private container: TaskContainer
	private eventBus: TaskEventBus
	private taskRef: WeakRef<Task>

	constructor({
		provider,
		apiConfiguration,
		enableDiff = false,
		enableCheckpoints = true,
		checkpointTimeout = DEFAULT_CHECKPOINT_TIMEOUT_SECONDS,
		enableBridge = false,
		fuzzyMatchThreshold = 1.0,
		consecutiveMistakeLimit = DEFAULT_CONSECUTIVE_MISTAKE_LIMIT,
		task,
		images,
		historyItem,
		experiments: experimentsConfig,
		startTask = true,
		rootTask,
		parentTask,
		taskNumber = -1,
		onCreated,
		initialTodos,
		workspacePath,
		initialStatus,
	}: TaskOptions) {
		super()

		if (startTask && !task && !images && !historyItem) {
			throw new Error("Either historyItem or task/images must be provided")
		}

		if (
			!checkpointTimeout ||
			checkpointTimeout > MAX_CHECKPOINT_TIMEOUT_SECONDS ||
			checkpointTimeout < MIN_CHECKPOINT_TIMEOUT_SECONDS
		) {
			throw new Error(
				"checkpointTimeout must be between " +
					MIN_CHECKPOINT_TIMEOUT_SECONDS +
					" and " +
					MAX_CHECKPOINT_TIMEOUT_SECONDS +
					" seconds",
			)
		}

		this.taskId = historyItem ? historyItem.id : crypto.randomUUID()
		this.rootTaskId = historyItem ? historyItem.rootTaskId : rootTask?.taskId
		this.parentTaskId = historyItem ? historyItem.parentTaskId : parentTask?.taskId
		this.childTaskId = undefined

		this.metadata = {
			task: historyItem ? historyItem.task : task,
			images: historyItem ? [] : images,
		}

		// Normal use-case is usually retry similar history task with new workspace.
		this.workspacePath = parentTask
			? parentTask.workspacePath
			: (workspacePath ?? getWorkspacePath(path.join(os.homedir(), "Desktop")))

		this.instanceId = crypto.randomUUID().slice(0, 8)
		this.taskNumber = -1

		this.rooIgnoreController = new RooIgnoreController(this.cwd)
		this.rooProtectedController = new RooProtectedController(this.cwd)
		this.fileContextTracker = new FileContextTracker(provider, this.taskId)

		this.rooIgnoreController.initialize().catch((error) => {
			console.error("Failed to initialize RooIgnoreController:", error)
		})

		this.apiConfiguration = apiConfiguration
		this.api = buildApiHandler(apiConfiguration)
		this.autoApprovalHandler = new AutoApprovalHandler()

		this.providerRef = new WeakRef(provider)
		this.globalStoragePath = provider.context.globalStorageUri.fsPath

		this.urlContentFetcher = new UrlContentFetcher(provider.context)
		this.diffEnabled = enableDiff
		this.fuzzyMatchThreshold = fuzzyMatchThreshold
		this.consecutiveMistakeLimit = consecutiveMistakeLimit ?? DEFAULT_CONSECUTIVE_MISTAKE_LIMIT
		this.diffViewProvider = new DiffViewProvider(this.cwd, this)
		this.enableCheckpoints = enableCheckpoints
		this.checkpointTimeout = checkpointTimeout
		this.enableBridge = enableBridge

		this.parentTask = parentTask
		this.taskNumber = taskNumber
		this.initialStatus = initialStatus

		// Initialize new architecture components
		this.taskRef = new WeakRef(this)
		this.container = new TaskContainer()
		this.eventBus = new TaskEventBus()

		// Initialize managers using dependency injection
		this.initializeManagers(provider, apiConfiguration, historyItem, initialTodos)

		// Sync task mode from state manager after initialization
		this.stateManager.waitForModeInitialization().then(() => {
			this._taskMode = this.stateManager.taskMode
			this._taskToolProtocol = this.stateManager.taskToolProtocol

			// Initialize the assistant message parser based on the locked tool protocol.
			const effectiveProtocol = this._taskToolProtocol || "xml"
			try {
				this.streamingManager.setAssistantMessageParser(effectiveProtocol !== "native" ? new AssistantMessageParser() : undefined)
			} catch (error) {
				console.warn("[Task] Failed to set assistant message parser:", error)
			}
		}).catch((error) => {
			console.error("[Task] Failed to initialize task mode:", error)
			this._taskMode = defaultModeSlug
			this._taskToolProtocol = "xml"
			try {
				this.streamingManager.setAssistantMessageParser(new AssistantMessageParser())
			} catch (error) {
				console.warn("[Task] Failed to set assistant message parser in catch block:", error)
			}
		})

		// Only set up diff strategy if diff is enabled.
		if (this.diffEnabled) {
			this.diffStrategy = new MultiSearchReplaceDiffStrategy(this.fuzzyMatchThreshold)

			provider.getState().then((state) => {
				const isMultiFileApplyDiffEnabled = experiments.isEnabled(
					state.experiments ?? {},
					EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF,
				)

				if (isMultiFileApplyDiffEnabled) {
					this.diffStrategy = new MultiFileSearchReplaceDiffStrategy(this.fuzzyMatchThreshold)
				}
			})
		}

		this.toolRepetitionDetector = new ToolRepetitionDetector(this.consecutiveMistakeLimit)

		if (initialTodos && initialTodos.length > 0) {
			this.todoList = initialTodos
		}

		onCreated?.(this)

		if (startTask) {
			if (task || images) {
				this.taskLifecycleManager.startTask(task, images)
			} else if (historyItem) {
				this.taskLifecycleManager.resumeTaskFromHistory()
			} else {
				throw new Error("Either historyItem or task/images must be provided")
			}
		}
	}

	// Properties delegated to state manager
	private _taskMode: string | undefined
	private _taskToolProtocol: ToolProtocol | undefined

	public async waitForModeInitialization(): Promise<void> {
		return this.stateManager.waitForModeInitialization()
	}

	public async getTaskMode(): Promise<string> {
		return this.stateManager.getTaskMode()
	}

	public get taskMode(): string {
		return this.stateManager.taskMode
	}

	public set taskMode(mode: string) {
		this._taskMode = mode
	}

	public get taskToolProtocol(): ToolProtocol | undefined {
		return this._taskToolProtocol
	}

	public set taskToolProtocol(protocol: ToolProtocol | undefined) {
		this._taskToolProtocol = protocol
	}

	public get taskStatus(): TaskStatus {
		if (this.interactiveAsk) {
			return TaskStatus.Interactive
		}

		if (this.resumableAsk) {
			return TaskStatus.Resumable
		}

		if (this.idleAsk) {
			return TaskStatus.Idle
		}

		return TaskStatus.Running
	}

	public get taskAsk(): ClineMessage | undefined {
		return this.idleAsk || this.resumableAsk || this.interactiveAsk
	}

	public get queuedMessages(): QueuedMessage[] {
		return this.messageQueueManager.queuedMessages
	}

	public get clineMessages(): ClineMessage[] {
		return this.taskMessageManager.getClineMessages()
	}

	public set clineMessages(messages: ClineMessage[]) {
		this.taskMessageManager.clineMessages = messages
	}

	public get apiConversationHistory(): ApiMessage[] {
		return this.taskMessageManager.getApiConversationHistory()
	}

	public set apiConversationHistory(history: ApiMessage[]) {
		this.taskMessageManager.apiConversationHistory = history
	}

	public get tokenUsage(): TokenUsage | undefined {
		return this.usageTracker.getTokenUsage()
	}

	public set tokenUsage(tokenUsage: TokenUsage) {
		this.usageTracker.setTokenUsage(tokenUsage)
	}

	public cancelCurrentRequest(): void {
		this.stateManager.cancelCurrentRequest()
	}

	public emitFinalTokenUsageUpdate(): void {
		this.usageTracker.emitFinalTokenUsageUpdate()
	}

	async overwriteApiConversationHistory(newHistory: ApiMessage[]) {
		return this.taskMessageManager.overwriteApiConversationHistory(newHistory)
	}

	public async flushPendingToolResultsToHistory(): Promise<void> {
		// Only flush if there's actually pending content to save
		const userMessageContent = this.getUserMessageContent()
		if (userMessageContent.length === 0) {
			return
		}

		// Save the user message with tool_result blocks
		const userMessage: Anthropic.MessageParam = {
			role: "user",
			content: userMessageContent,
		}

		// Validate and fix tool_result IDs against the previous assistant message
		const validatedMessage = validateAndFixToolResultIds(userMessage, this.apiConversationHistory)
		const userMessageWithTs = { ...validatedMessage, ts: Date.now() }
		this.apiConversationHistory.push(userMessageWithTs as ApiMessage)

		await this.taskMessageManager.saveApiConversationHistory()

		// Clear the pending content since it's now saved
		this.setUserMessageContent([])
}

	public async overwriteClineMessages(newMessages: ClineMessage[]) {
		await this.taskMessageManager.overwriteClineMessages(newMessages, this.providerRef, this.cloudSyncedMessageTimestamps)
		this.cloudSyncedMessageTimestamps.clear()
		for (const msg of newMessages) {
			if (msg.partial !== true) {
				this.cloudSyncedMessageTimestamps.add(msg.ts)
			}
		}
	}

	public async saveClineMessages() {
		await this.taskMessageManager.saveClineMessages()
		await this.updateTokenUsage()
	}

	private async updateTokenUsage() {
		try {
			const metadata = await taskMetadata({
				taskId: this.taskId,
				taskNumber: this.taskNumber,
				messages: this.clineMessages,
				globalStoragePath: this.globalStoragePath,
				workspace: this.workspacePath,
			})
			if (metadata.tokenUsage) {
				this.usageTracker.setTokenUsage(metadata.tokenUsage)
			}
		} catch (error) {
			console.error("Failed to update token usage:", error)
		}
	}

	// User interactions - delegated to user interaction manager
	async ask(
		type: ClineAsk,
		text?: string,
		images?: string[],
		partial?: boolean,
	): Promise<{ response: ClineAskResponse; text?: string; images?: string[] }> {
		return this.userInteractionManager.ask(type, text, images, partial)
	}

	public cancelAutoApprovalTimeout(): void {
		this.userInteractionManager.cancelAutoApprovalTimeout()
	}

	public approveAsk({ text, images }: { text?: string; images?: string[] } = {}) {
		return this.userInteractionManager.approveAsk({ text, images })
	}

	public denyAsk({ text, images }: { text?: string; images?: string[] } = {}) {
		return this.userInteractionManager.denyAsk({ text, images })
	}

	handleWebviewAskResponse(askResponse: ClineAskResponse, text?: string, images?: string[]) {
		return this.userInteractionManager.handleWebviewAskResponse(askResponse, text, images)
	}

	async say(
		type: ClineSay,
		text?: string,
		images?: string[],
		partial?: boolean,
		checkpoint?: Record<string, unknown>,
		progressStatus?: ToolProgressStatus,
		options?: { isNonInteractive?: boolean },
		contextCondense?: ContextCondense,
		contextTruncation?: ContextTruncation,
	): Promise<ClineMessage | undefined> {
		return this.userInteractionManager.say(type, text, images, partial, checkpoint, progressStatus, options, contextCondense, contextTruncation)
	}

	async sayAndCreateMissingParamError(toolName: ToolName, paramName: string, relPath?: string): Promise<ToolResponse> {
		return this.userInteractionManager.sayAndCreateMissingParamError(toolName, paramName, relPath)
	}

	// Tool execution - delegated to tool executor
	public recordToolUsage(toolName: ToolName) {
		this.usageTracker.recordToolUsage(toolName)
	}

	public recordToolError(toolName: ToolName, error?: string) {
		this.usageTracker.recordToolError(toolName, error)
	}

	// Checkpoints - delegated to checkpoint manager
	public async checkpointSave(force: boolean = false, suppressMessage: boolean = false) {
		return this.checkpointManager.checkpointSave(force, suppressMessage)
	}

	/**
	 * 创建包含完整API上下文的检查点
	 * 在创建检查点前保存工具协议等上下文信息
	 * 注意：系统提示词由PromptManager动态生成，不需要保存到检查点元数据中
	 */
	public async checkpointSaveWithFullContext(requestIndex: number, suppressMessage: boolean = false): Promise<{ commit?: string } | undefined> {
		try {
			// 1. 获取当前工具协议
			const toolProtocol = this.stateManager.taskToolProtocol

			// 2. 获取当前上下文token数
			const { contextTokens } = this.getTokenUsage()

			// 3. 创建包含完整上下文的检查点消息
			const checkpointMessage = {
				role: "system" as const,
				content: `Checkpoint at request ${requestIndex}`,
				ts: Date.now(),
				conversationIndex: requestIndex,
				checkpointMetadata: {
					isCheckpoint: true,
					requestIndex,
					toolProtocol,
					contextTokens,
				},
			} as any

			// 4. 添加到API对话历史
			await this.taskMessageManager.addToApiConversationHistory(checkpointMessage)

			// 5. 创建文件系统检查点
			const result = await this.checkpointManager.checkpointSave(false, suppressMessage)

			// 6. 关联检查点hash与请求索引（会自动持久化）
			if (result && result.commit) {
				await this.indexManager.associateCheckpointWithRequest(result.commit, requestIndex)
				console.log(
					`[Task] Created checkpoint with full context: hash=${result.commit}, requestIndex=${requestIndex}, ` +
					`contextTokens=${contextTokens}, toolProtocol=${toolProtocol}`
				)
			}

			return result
		} catch (error) {
			console.error("[Task] Failed to create checkpoint with full context:", error)
			return undefined
		}
	}

	public async checkpointRestore(options: CheckpointRestoreOptions) {
		return this.checkpointManager.checkpointRestore(options)
	}

	public async checkpointDiff(options: CheckpointDiffOptions) {
		return this.checkpointManager.checkpointDiff(options)
	}

	// Get checkpoint manager for extended operations
	getCheckpointManager(): CheckpointManager {
		return this.checkpointManager
	}

	// Context management - kept in Task class as it orchestrates multiple components
	public async condenseContext(): Promise<void> {
		const systemPrompt = await this.promptManager.getSystemPrompt(this.apiConfiguration, this.todoList, this.diffEnabled)

		// Get condensing configuration
		const state = await this.providerRef.deref()?.getState()
		// These properties may not exist in the state type yet, but are used for condensing configuration
		const customCondensingPrompt = state?.customCondensingPrompt
		const condensingApiConfigId = state?.condensingApiConfigId
		const listApiConfigMeta = state?.listApiConfigMeta

		// Determine API handler to use
		let condensingApiHandler: ApiHandler | undefined
		if (condensingApiConfigId && listApiConfigMeta && Array.isArray(listApiConfigMeta)) {
			// Find matching config by ID
			const matchingConfig = listApiConfigMeta.find((config) => config.id === condensingApiConfigId)
			if (matchingConfig) {
				const profile = await this.providerRef.deref()?.providerSettingsManager.getProfile({
					id: condensingApiConfigId,
				})
				// Ensure profile and apiProvider exist before trying to build handler
				if (profile && profile.apiProvider) {
					condensingApiHandler = buildApiHandler(profile)
				}
			}
		}

		const { contextTokens: prevContextTokens } = this.getTokenUsage()

		// Determine if we're using native tool protocol for proper message handling
		// Use the task's locked protocol, NOT the current settings (fallback to xml if not set)
		const useNativeTools = isNativeProtocol(this._taskToolProtocol ?? "xml")

		const {
			messages,
			summary,
			cost,
			newContextTokens = 0,
			error,
			condenseId,
		} = await summarizeConversation(
			this.apiConversationHistory,
			this.api, // Main API handler (fallback)
			systemPrompt, // Default summarization prompt (fallback)
			this.taskId,
			prevContextTokens,
			false, // manual trigger
			customCondensingPrompt, // User's custom prompt
			condensingApiHandler, // Specific handler for condensing
			useNativeTools, // Pass native tools flag for proper message handling
		)
		if (error) {
			this.say(
				"condense_context_error",
				error,
				undefined /* images */,
				false /* partial */,
				undefined /* checkpoint */,
				undefined /* progressStatus */,
				{ isNonInteractive: true } /* options */,
			)
			return
		}
		await this.overwriteApiConversationHistory(messages)

		const contextCondense: ContextCondense = {
			summary,
			cost,
			newContextTokens,
			prevContextTokens,
			condenseId: condenseId!,
		}
		await this.say(
			"condense_context",
			undefined /* text */,
			undefined /* images */,
			false /* partial */,
			undefined /* checkpoint */,
			undefined /* progressStatus */,
			{ isNonInteractive: true } /* options */,
			contextCondense,
		)

		// Process any queued messages after condensing completes
		this.processQueuedMessages()
	}

	// Token and tool usage - delegated to usage tracker
	public combineMessages(messages: ClineMessage[]) {
		return this.usageTracker.combineMessages(messages)
	}

	public getTokenUsage(): TokenUsage {
		return this.usageTracker.getTokenUsage()
	}

	public get toolUsage(): ToolUsage {
		return this.usageTracker.getToolUsage()
	}

	public set toolUsage(toolUsage: ToolUsage) {
		this.usageTracker.setToolUsage(toolUsage)
	}

	public get tokenUsageSnapshot(): TokenUsage | undefined {
		return this.usageTracker.getSnapshot().tokenUsage
	}

	public get toolUsageSnapshot(): ToolUsage | undefined {
		return this.usageTracker.getSnapshot().toolUsage
	}

	// Task lifecycle methods
	public async abortTask(isAbandoned = false) {
		this.usageTracker.emitFinalTokenUsageUpdate()
		this.taskLifecycleManager.abortTask(isAbandoned)
		
		// Call dispose and handle any errors gracefully
		try {
			this.dispose()
		} catch (error) {
			console.error("Error during task disposal:", error)
		}
	}

	public async dispose(): Promise<void> {
		try {
			this.removeAllListeners()
		} catch (error) {
			console.error("Error removing event listeners:", error)
		}
		
		this.cancelCurrentRequest()
		
		// Dispose container and all services
		await this.container.dispose()
		this.eventBus.dispose()
	}

	/**
	 * Initialize all managers using dependency injection to avoid circular references
	 */
	private initializeManagers(
		provider: ClineProvider,
		apiConfiguration: ProviderSettings,
		historyItem?: HistoryItem,
		initialTodos?: TodoItem[]
	): void {
		const taskRef = new WeakRef(this)

		// Create state manager first (other managers depend on it)
		const stateManager = new TaskStateManager({
			taskId: this.taskId,
			rootTaskId: this.rootTaskId,
			parentTaskId: this.parentTaskId,
			taskNumber: this.taskNumber,
			workspacePath: this.workspacePath,
			metadata: this.metadata,
			provider,
			apiConfiguration,
			historyItem,
			initialTodos,
			initialStatus: this.initialStatus,
		})
		this.container.register(TOKENS.TaskStateManager, stateManager)

		// Create index manager (needed by message manager and checkpoint manager)
		const indexManager = new IndexManager({
			taskId: this.taskId,
			globalStoragePath: this.globalStoragePath,
		})
		this.container.register(TOKENS.IndexManager, indexManager)

		// Create message manager
		const messageManager = new TaskMessageManager({
			stateManager,
			taskId: this.taskId,
			globalStoragePath: this.globalStoragePath,
			task: taskRef, // Pass weak reference instead of direct reference
			eventBus: this.eventBus, // Pass event bus reference
			indexManager, // Pass index manager reference
		})
		this.container.register(TOKENS.TaskMessageManager, messageManager)

		// Create context manager
		const contextManager = new ContextManager({
			cwd: this.cwd,
			provider,
			taskId: this.taskId,
		})
		this.container.register(TOKENS.ContextManager, contextManager)

		// Create file editor manager
		const fileEditorManager = new FileEditorManager({
			cwd: this.cwd,
			fuzzyMatchThreshold: this.fuzzyMatchThreshold,
			enableDiff: this.diffEnabled,
			provider,
		})
		this.container.register(TOKENS.FileEditorManager, fileEditorManager)

		// Create tool executor
		const toolExecutor = new ToolExecutor({
			consecutiveMistakeLimit: this.consecutiveMistakeLimit,
		})
		this.container.register(TOKENS.ToolExecutor, toolExecutor)

		// Create user interaction manager
		const userInteractionManager = new UserInteractionManager({
			stateManager,
			messageManager,
		})
		this.container.register(TOKENS.UserInteractionManager, userInteractionManager)

		// Create checkpoint manager
		const checkpointManager = new CheckpointManager({
			stateManager,
			messageManager,
			taskId: this.taskId,
			enableCheckpoints: this.enableCheckpoints,
			checkpointTimeout: this.checkpointTimeout,
			globalStoragePath: this.globalStoragePath,
			indexManager,
		})
		this.container.register(TOKENS.CheckpointManager, checkpointManager)

		// Create usage tracker with event bus instead of direct callback
		const usageTracker = new UsageTracker({
			emitTokenUsage: (tokenUsage, toolUsage) => {
				this.emit(RooCodeEventName.TaskTokenUsageUpdated, this.taskId, tokenUsage, toolUsage)
			},
		})
		this.container.register(TOKENS.UsageTracker, usageTracker)

		// Create streaming manager with event bus
		const streamingManager = new StreamingManager({
			taskId: this.taskId,
			onStreamingStateChange: (state) => {
				this.eventBus.emit(RooCodeEventName.TaskStreamingStateChanged, {
					taskId: this.taskId,
					state
				})
			},
			onStreamingContentUpdate: (content) => {
				this.eventBus.emit(RooCodeEventName.TaskStreamingContentUpdated, {
					taskId: this.taskId,
					content
				})
			},
		})
		this.container.register(TOKENS.StreamingManager, streamingManager)

		// Create prompt manager
		const promptManager = new PromptManager({
			taskId: this.taskId,
			providerRef: this.providerRef,
			workspacePath: this.cwd,
			diffStrategy: this.diffStrategy,
			rooIgnoreController: this.rooIgnoreController,
		})
		this.container.register(TOKENS.PromptManager, promptManager)

		// Create message queue manager with event bus
		const messageQueueManager = new MessageQueueManager({
			taskId: this.taskId,
			providerRef: this.providerRef,
			onUserMessage: (taskId) => {
				this.eventBus.emit(RooCodeEventName.TaskUserMessage, { taskId })
			},
		})
		this.container.register(TOKENS.MessageQueueManager, messageQueueManager)

		// Create conversation history manager
		const conversationHistoryManager = new ConversationHistoryManager({
			taskId: this.taskId,
		})
		this.container.register(TOKENS.ConversationHistoryManager, conversationHistoryManager)

		// Create configuration manager
		const configurationManager = new ConfigurationManager({
			taskId: this.taskId,
			providerRef: this.providerRef,
			onConfigurationUpdate: (newConfig) => {
				this.updateApiConfiguration(newConfig)
			},
		})
		this.container.register(TOKENS.ConfigurationManager, configurationManager)

		// Create subtask manager (still needs direct task reference for now)
		const subtaskManager = new SubtaskManager({
			task: this,
			providerRef: this.providerRef,
			taskId: this.taskId,
			rootTaskId: this.rootTaskId,
			parentTaskId: this.parentTaskId,
			taskNumber: this.taskNumber,
			workspacePath: this.workspacePath,
			apiConfiguration,
		})
		this.container.register(TOKENS.SubtaskManager, subtaskManager)

		// Create task lifecycle manager
		const taskLifecycleManager = new TaskLifecycleManager({
			task: this,
			providerRef: this.providerRef,
			taskId: this.taskId,
			taskNumber: this.taskNumber,
			workspacePath: this.workspacePath,
			apiConfiguration,
			metadata: this.metadata,
			enableCheckpoints: this.enableCheckpoints,
		})
		this.container.register(TOKENS.TaskLifecycleManager, taskLifecycleManager)

		// Create API request manager (complex dependencies)
		const apiRequestManager = new ApiRequestManager({
			stateManager,
			messageManager,
			userInteractionManager,
			contextManager,
			usageTracker,
			fileEditorManager,
			api: this.api,
			apiConfiguration,
			cwd: this.cwd,
			streamingManager,
			checkpointManager,
			getSystemPrompt: () => promptManager.getSystemPrompt(this.apiConfiguration, this.todoList, this.diffEnabled),
			getLastGlobalApiRequestTime: () => Task.lastGlobalApiRequestTime,
			setLastGlobalApiRequestTime: (time: number) => {
				Task.lastGlobalApiRequestTime = time
			},
		})
		this.container.register(TOKENS.ApiRequestManager, apiRequestManager)

		// Create browser session manager
		const browserSessionManager = new BrowserSessionManager({
			taskId: this.taskId,
			context: provider.context,
			providerRef: this.providerRef,
			onStatusUpdate: (message: string) => {
				this.say("browser_session_status", message)
			},
			onWebviewUpdate: (isActive: boolean) => {
				this.broadcastBrowserSessionUpdate(isActive)
			},
		})
		this.container.register(TOKENS.BrowserSessionManager, browserSessionManager)
	}

	public async startSubtask(message: string, initialTodos: TodoItem[], mode: string) {
		return this.subtaskManager.startSubtask(message, initialTodos, mode)
	}

	public async resumeAfterDelegation(): Promise<void> {
		return this.subtaskManager.resumeAfterDelegation()
	}

	public async submitUserMessage(
		text: string,
		images: string[] = [],
		mode?: string,
		providerProfile?: string,
	): Promise<void> {
		return this.messageQueueManager.submitUserMessage(text, images, mode, providerProfile)
	}

	async handleTerminalOperation(terminalOperation: "continue" | "abort") {
		if (terminalOperation === "continue") {
			this.isPaused = false
			await this.recursivelyMakeClineRequests([])
		} else {
			await this.abortTask()
		}
	}

	public updateApiConfiguration(newApiConfiguration: ProviderSettings): void {
		this.stateManager.updateApiConfiguration(newApiConfiguration)
		this.apiConfiguration = newApiConfiguration
		this.api = buildApiHandler(newApiConfiguration)
		this.configurationManager.updateApiConfiguration(newApiConfiguration)
	}

	public async processQueuedMessages(): Promise<void> {
		return this.messageQueueManager.processQueuedMessages()
	}

	public async recursivelyMakeClineRequests(
		userContent: Anthropic.Messages.ContentBlockParam[],
		includeFileDetails: boolean = false,
	): Promise<boolean> {
		return this.apiRequestManager.recursivelyMakeClineRequests(userContent, includeFileDetails)
	}

	public async *attemptApiRequest(): ApiStream {
		yield* this.apiRequestManager.attemptApiRequest()
	}

	// Public method for testing
	public async getSystemPrompt(): Promise<string> {
		return this.promptManager.getSystemPrompt(this.apiConfiguration, this.todoList, this.diffEnabled)
	}

	/**
	 * 设置系统提示词（用于检查点恢复）
	 * 注意：系统提示词通常由PromptManager动态生成，此方法仅用于检查点恢复场景
	 */
	public setSystemPrompt(systemPrompt: string): void {
		console.log("[Task] System prompt restoration is handled by PromptManager, this method is for checkpoint metadata only")
		// 系统提示词的恢复由PromptManager处理，这里只是占位方法
		// 实际的恢复逻辑在PromptManager中，因为它需要访问provider状态
	}

	private async backoffAndAnnounce(retryAttempt: number, error: any): Promise<void> {
		return this.apiRequestManager.backoffAndAnnounce(retryAttempt, error)
	}

	private broadcastBrowserSessionUpdate(isActive: boolean): void {
		const provider = this.providerRef.deref()
		if (!provider) {
			return
		}

		provider.postMessageToWebview({
			type: "browserSessionUpdate",
			isBrowserSessionActive: isActive,
		})
	}

	static create(options: TaskOptions): [Task, Promise<void>] {
		const instance = new Task({ ...options, startTask: false })
		const { images, task, historyItem } = options
		let promise

		if (images || task) {
			promise = instance.taskLifecycleManager.startTask(task, images)
		} else if (historyItem) {
			promise = instance.taskLifecycleManager.resumeTaskFromHistory()
		} else {
			throw new Error("Either historyItem or task/images must be provided")
		}

		return [instance, promise]
	}

	get cwd(): string {
		return this.workspacePath
	}

	get conversationRewindManager(): ConversationRewindManager {
		if (!this._conversationRewindManager) {
			this._conversationRewindManager = new ConversationRewindManager(this)
		}
		return this._conversationRewindManager
	}

	// Manager getter methods using container
	private get stateManager(): TaskStateManager {
		return this.container.get(TOKENS.TaskStateManager)
	}

	private get taskMessageManager(): TaskMessageManager {
		return this.container.get(TOKENS.TaskMessageManager)
	}

	private get contextManager(): ContextManager {
		return this.container.get(TOKENS.ContextManager)
	}

	private get fileEditorManager(): FileEditorManager {
		return this.container.get(TOKENS.FileEditorManager)
	}

	private get toolExecutor(): ToolExecutor {
		return this.container.get(TOKENS.ToolExecutor)
	}

	private get userInteractionManager(): UserInteractionManager {
		return this.container.get(TOKENS.UserInteractionManager)
	}

	private get checkpointManager(): CheckpointManager {
		return this.container.get(TOKENS.CheckpointManager)
	}

	private get usageTracker(): UsageTracker {
		return this.container.get(TOKENS.UsageTracker)
	}

	private get streamingManager(): StreamingManager {
		try {
			return this.container.get(TOKENS.StreamingManager)
		} catch (error) {
			// Container might be disposed, return undefined-safe behavior
			console.warn("[Task] StreamingManager not available in container:", error)
			return {} as StreamingManager
		}
	}

	private get promptManager(): PromptManager {
		return this.container.get(TOKENS.PromptManager)
	}

	public get messageQueueManager(): MessageQueueManager {
		return this.container.get(TOKENS.MessageQueueManager)
	}

	private get conversationHistoryManager(): ConversationHistoryManager {
		return this.container.get(TOKENS.ConversationHistoryManager)
	}

	private get configurationManager(): ConfigurationManager {
		return this.container.get(TOKENS.ConfigurationManager)
	}

	private get subtaskManager(): SubtaskManager {
		return this.container.get(TOKENS.SubtaskManager)
	}

	private get taskLifecycleManager(): TaskLifecycleManager {
		return this.container.get(TOKENS.TaskLifecycleManager)
	}

	private get apiRequestManager(): ApiRequestManager {
		return this.container.get(TOKENS.ApiRequestManager)
	}

	private get indexManager(): IndexManager {
		return this.container.get(TOKENS.IndexManager)
	}

	private get browserSessionManager(): BrowserSessionManager {
		if (!this._browserSessionManager) {
			this._browserSessionManager = this.container.get(TOKENS.BrowserSessionManager)
		}
		return this._browserSessionManager
	}

	public getAssistantMessageParser(): any {
		return this.streamingManager.getAssistantMessageParser()
	}

	public setAssistantMessageParser(parser: any): void {
		this.streamingManager.setAssistantMessageParser(parser)
	}

	public clearAssistantMessageParser(): void {
		this.streamingManager.clearAssistantMessageParser()
	}

	public getStreamingState(): any {
		return this.streamingManager.getStreamingState()
	}

	public isPresentAssistantMessageLocked(): boolean {
		return this.streamingManager.isPresentAssistantMessageLocked()
	}

	public setPresentAssistantMessageLocked(locked: boolean): void {
		this.streamingManager.setPresentAssistantMessageLocked(locked)
	}

	public hasPresentAssistantMessagePendingUpdates(): boolean {
		return this.streamingManager.hasPresentAssistantMessagePendingUpdates()
	}

	public setPresentAssistantMessageHasPendingUpdates(hasUpdates: boolean): void {
		this.streamingManager.setPresentAssistantMessageHasPendingUpdates(hasUpdates)
	}

	public getCurrentStreamingContentIndex(): number {
		return this.streamingManager.getCurrentStreamingContentIndex()
	}

	public setCurrentStreamingContentIndex(index: number): void {
		this.streamingManager.setCurrentStreamingContentIndex(index)
	}

	public getStreamingDidCheckpoint(): boolean {
		return this.streamingManager.getStreamingDidCheckpoint()
	}

	public setStreamingDidCheckpoint(value: boolean): void {
		this.streamingManager.setStreamingDidCheckpoint(value)
	}

	public getAssistantMessageContent(): any[] {
		return this.streamingManager.getAssistantMessageContent()
	}

	public getUserMessageContent(): any[] {
		return this.streamingManager.getUserMessageContent()
	}

	public setUserMessageContent(content: any[]): void {
		this.streamingManager.setUserMessageContent(content)
	}

	public setUserMessageContentReady(ready: boolean): void {
		this.streamingManager.setUserMessageContentReady(ready)
	}

	public isUserMessageContentReady(): boolean {
		return this.streamingManager.isUserMessageContentReady()
	}

	public hasCompletedReadingStream(): boolean {
		return this.streamingManager.hasCompletedReadingStream()
	}

	public setDidCompleteReadingStream(completed: boolean): void {
		this.streamingManager.setDidCompleteReadingStream(completed)
	}

	public getDidRejectTool(): boolean {
		return this.streamingManager.isToolRejected()
	}

	public setDidRejectTool(rejected: boolean): void {
		this.streamingManager.setDidRejectTool(rejected)
	}

	public getDidAlreadyUseTool(): boolean {
		return this.streamingManager.hasAlreadyUsedTool()
	}

	public setDidAlreadyUseTool(used: boolean): void {
		this.streamingManager.setDidAlreadyUseTool(used)
	}

	public getBrowserSession() {
		return this.browserSessionManager.getBrowserSession()
	}

	public isBrowserSessionActive(): boolean {
		return this.browserSessionManager.isSessionActive()
	}

	public getBrowserViewportSize(): { width?: number; height?: number } {
		return this.browserSessionManager.getViewportSize()
	}

	/**
	 * 获取当前请求索引（新增）
	 */
	public getCurrentRequestIndex(): number | undefined {
		return this.apiRequestManager.getCurrentRequestIndex()
	}

	/**
	 * 开始新的API请求（新增）
	 */
	public startNewApiRequest(): number {
		return this.taskMessageManager.startNewApiRequest()
	}

	/**
	 * 结束当前API请求（新增）
	 */
	public endCurrentApiRequest(): void {
		this.taskMessageManager.endCurrentApiRequest()
	}

	public disposeBrowserSession(): void {
		this.browserSessionManager.dispose()
	}
}
