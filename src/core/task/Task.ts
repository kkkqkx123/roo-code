import * as path from "path"
import * as vscode from "vscode"
import os from "os"
import crypto from "crypto"
import EventEmitter from "events"

import { Anthropic } from "@anthropic-ai/sdk"
import { Package } from "../../shared/package"

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
	type ModelInfo,
	type ToolProtocol,
	RooCodeEventName,
	TaskStatus,
	TodoItem,
	getApiProtocol,
	getModelId,
	isIdleAsk,
	isInteractiveAsk,
	isResumableAsk,
	isNativeProtocol,
	QueuedMessage,
	DEFAULT_CONSECUTIVE_MISTAKE_LIMIT,
	DEFAULT_CHECKPOINT_TIMEOUT_SECONDS,
	MAX_CHECKPOINT_TIMEOUT_SECONDS,
	MIN_CHECKPOINT_TIMEOUT_SECONDS,
	TOOL_PROTOCOL,
} from "@roo-code/types"
import { resolveToolProtocol, detectToolProtocolFromHistory } from "../../utils/resolveToolProtocol"

// api
import { ApiHandler, ApiHandlerCreateMessageMetadata, buildApiHandler } from "../../api"
import { ApiStream, GroundingSource } from "../../api/transform/stream"
import { maybeRemoveImageBlocks } from "../../api/transform/image-cleaning"

// shared
import { findLastIndex } from "../../shared/array"
import type { ToolResponse } from "../../shared/tools"
import { combineApiRequests } from "../../shared/combineApiRequests"
import { combineCommandSequences } from "../../shared/combineCommandSequences"
import { t } from "../../i18n"
import { ClineApiReqCancelReason, ClineApiReqInfo } from "../../shared/ExtensionMessage"
import { getApiMetrics, hasTokenUsageChanged, hasToolUsageChanged } from "../../shared/getApiMetrics"
import { ClineAskResponse } from "../../shared/WebviewMessage"
import { defaultModeSlug, getModeBySlug, getGroupName } from "../../shared/modes"
import { DiffStrategy, type ToolUse, type ToolParamName, toolParamNames } from "../../shared/tools"
import { EXPERIMENT_IDS, experiments } from "../../shared/experiments"
import { getModelMaxOutputTokens } from "../../shared/api"

// services
import { UrlContentFetcher } from "../../services/browser/UrlContentFetcher"
import { BrowserSession } from "../../services/browser/BrowserSession"
import { McpHub } from "../../services/mcp/McpHub"
import { McpServerManager } from "../../services/mcp/McpServerManager"
import { RepoPerTaskCheckpointService } from "../../services/checkpoints"

// integrations
import { DiffViewProvider } from "../../integrations/editor/DiffViewProvider"
import { findToolName } from "../../integrations/misc/export-markdown"
import { RooTerminalProcess } from "../../integrations/terminal/types"
import { TerminalRegistry } from "../../integrations/terminal/TerminalRegistry"

// utils
import { calculateApiCostAnthropic, calculateApiCostOpenAI } from "../../shared/cost"
import { getWorkspacePath } from "../../utils/path"

// prompts
import { formatResponse } from "../prompts/responses"
import { SYSTEM_PROMPT } from "../prompts/system"
import { buildNativeToolsArray } from "./build-tools"

// core modules
import { ToolRepetitionDetector } from "../tools/ToolRepetitionDetector"
import { restoreTodoListForTask } from "../tools/UpdateTodoListTool"
import { FileContextTracker } from "../context-tracking/FileContextTracker"
import { RooIgnoreController } from "../ignore/RooIgnoreController"
import { RooProtectedController } from "../protect/RooProtectedController"
import { type AssistantMessageContent, presentAssistantMessage } from "../assistant-message"
import { AssistantMessageParser } from "../assistant-message/AssistantMessageParser"
import { NativeToolCallParser } from "../assistant-message/NativeToolCallParser"
import { manageContext, willManageContext } from "../context-management"
import { ClineProvider } from "../webview/ClineProvider"
import { MultiSearchReplaceDiffStrategy } from "../diff/strategies/multi-search-replace"
import { MultiFileSearchReplaceDiffStrategy } from "../diff/strategies/multi-file-search-replace"
import {
	type ApiMessage,
	readApiMessages,
	saveApiMessages,
	readTaskMessages,
	saveTaskMessages,
	taskMetadata,
} from "../task-persistence"
import { getEnvironmentDetails } from "../environment/getEnvironmentDetails"
import { checkContextWindowExceededError } from "../context-management/context-error-handling"
import {
	type CheckpointDiffOptions,
	type CheckpointRestoreOptions,
	getCheckpointService,
	checkpointSave,
	checkpointRestore,
	checkpointDiff,
} from "../checkpoints"
import { processUserContentMentions } from "../mentions/processUserContentMentions"
import { getMessagesSinceLastSummary, summarizeConversation, getEffectiveApiHistory } from "../condense"
import { MessageQueueService } from "../message-queue/MessageQueueService"
import { AutoApprovalHandler, checkAutoApproval } from "../auto-approval"
import { MessageManager } from "../message-manager"
import { validateAndFixToolResultIds } from "./validateToolResultIds"

// Managers
import {
	TaskStateManager,
	ApiRequestManager,
	MessageManager as TaskMessageManager,
	ToolExecutor,
	UserInteractionManager,
	FileEditorManager,
	CheckpointManager,
	ContextManager,
	UsageTracker,
	ConfigurationManager,
	SubtaskManager,
	TaskLifecycleManager,
} from "./managers"

const MAX_EXPONENTIAL_BACKOFF_SECONDS = 600 // 10 minutes
const DEFAULT_USAGE_COLLECTION_TIMEOUT_MS = 5000 // 5 seconds
const FORCED_CONTEXT_REDUCTION_PERCENT = 75 // Keep 75% of context (remove 25%) on context window errors
const MAX_CONTEXT_WINDOW_RETRIES = 3 // Maximum retries for context window errors

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
	browserSession: BrowserSession

	// Editing
	diffViewProvider: DiffViewProvider
	diffStrategy?: DiffStrategy
	diffEnabled: boolean = false
	fuzzyMatchThreshold: number
	didEditFile: boolean = false

	// LLM Messages & Chat Messages
	apiConversationHistory: ApiMessage[] = []
	clineMessages: ClineMessage[] = []

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
	toolUsage: ToolUsage = {}

	// Checkpoints
	enableCheckpoints: boolean
	checkpointTimeout: number
	checkpointService?: RepoPerTaskCheckpointService
	checkpointServiceInitializing = false

	// Task Bridge
	enableBridge: boolean

	// Message Queue Service
	public readonly messageQueueService: MessageQueueService
	private messageQueueStateChangedHandler: (() => void) | undefined

	// Streaming
	isWaitingForFirstChunk = false
	isStreaming = false
	currentStreamingContentIndex = 0
	currentStreamingDidCheckpoint = false
	assistantMessageContent: AssistantMessageContent[] = []
	presentAssistantMessageLocked = false
	presentAssistantMessageHasPendingUpdates = false
	userMessageContent: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolResultBlockParam)[] = []
	userMessageContentReady = false
	didRejectTool = false
	didAlreadyUseTool = false
	didToolFailInCurrentTurn = false
	didCompleteReadingStream = false
	assistantMessageParser?: AssistantMessageParser
	private providerProfileChangeListener?: (config: { name: string; provider?: string }) => void

	// Native tool call streaming state (track which index each tool is at)
	private streamingToolCallIndices: Map<string, number> = new Map()

	// Cached model info for current streaming session (set at start of each API request)
	// This prevents excessive getModel() calls during tool execution
	cachedStreamingModel?: { id: string; info: ModelInfo }

	// Token Usage Cache
	private tokenUsageSnapshot?: TokenUsage
	private tokenUsageSnapshotAt?: number

	// Tool Usage Cache
	private toolUsageSnapshot?: ToolUsage

	// Cloud Sync Tracking
	private cloudSyncedMessageTimestamps: Set<number> = new Set()

	// Initial status for the task's history item (set at creation time to avoid race conditions)
	private readonly initialStatus?: "active" | "delegated" | "completed"

	// MessageManager for high-level message operations (lazy initialized)
	private _messageManager?: MessageManager

	// Managers
	private stateManager: TaskStateManager
	private apiRequestManager: ApiRequestManager
	private taskMessageManager: TaskMessageManager
	private toolExecutor: ToolExecutor
	private userInteractionManager: UserInteractionManager
	private fileEditorManager: FileEditorManager
	private checkpointManager: CheckpointManager
	private contextManager: ContextManager
	private usageTracker: UsageTracker
	private configurationManager: ConfigurationManager
	private subtaskManager: SubtaskManager
	private taskLifecycleManager: TaskLifecycleManager

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

		this.urlContentFetcher = new UrlContentFetcher(provider.context)
		this.browserSession = new BrowserSession(provider.context, (isActive: boolean) => {
			this.say("browser_session_status", isActive ? "Browser session opened" : "Browser session closed")
			this.broadcastBrowserSessionUpdate()

			if (isActive) {
				try {
					const { BrowserSessionPanelManager } = require("../webview/BrowserSessionPanelManager")
					const providerRef = this.providerRef.deref()
					if (providerRef) {
						BrowserSessionPanelManager.getInstance(providerRef)
							.show()
							.catch(() => {})
					}
				} catch (err) {
					console.error("[Task] Failed to auto-open Browser Session panel:", err)
				}
			}
		})
		this.diffEnabled = enableDiff
		this.fuzzyMatchThreshold = fuzzyMatchThreshold
		this.consecutiveMistakeLimit = consecutiveMistakeLimit ?? DEFAULT_CONSECUTIVE_MISTAKE_LIMIT
		this.providerRef = new WeakRef(provider)
		this.globalStoragePath = provider.context.globalStorageUri.fsPath
		this.diffViewProvider = new DiffViewProvider(this.cwd, this)
		this.enableCheckpoints = enableCheckpoints
		this.checkpointTimeout = checkpointTimeout
		this.enableBridge = enableBridge

		this.parentTask = parentTask
		this.taskNumber = taskNumber
		this.initialStatus = initialStatus

		// Initialize managers
		this.stateManager = new TaskStateManager({
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
			initialStatus,
		})

		this.taskMessageManager = new TaskMessageManager({
			stateManager: this.stateManager,
			taskId: this.taskId,
			globalStoragePath: this.globalStoragePath,
		})

		this.contextManager = new ContextManager({
			cwd: this.cwd,
			provider,
			taskId: this.taskId,
		})

		this.fileEditorManager = new FileEditorManager({
			cwd: this.cwd,
			fuzzyMatchThreshold: this.fuzzyMatchThreshold,
			enableDiff: this.diffEnabled,
			provider,
		})

		this.toolExecutor = new ToolExecutor({
			consecutiveMistakeLimit: this.consecutiveMistakeLimit,
		})

		this.userInteractionManager = new UserInteractionManager({
			stateManager: this.stateManager,
			messageManager: this.taskMessageManager,
		})

		this.checkpointManager = new CheckpointManager({
			stateManager: this.stateManager,
			messageManager: this.taskMessageManager,
			taskId: this.taskId,
			enableCheckpoints: this.enableCheckpoints,
			checkpointTimeout: this.checkpointTimeout,
		})

		this.usageTracker = new UsageTracker({
			emitTokenUsage: (tokenUsage, toolUsage) => {
				this.emit(RooCodeEventName.TaskTokenUsageUpdated, this.taskId, tokenUsage, toolUsage)
			},
		})

		this.apiRequestManager = new ApiRequestManager({
			stateManager: this.stateManager,
			messageManager: this.taskMessageManager,
			userInteractionManager: this.userInteractionManager,
			contextManager: this.contextManager,
			usageTracker: this.usageTracker,
			fileEditorManager: this.fileEditorManager,
			api: this.api,
			apiConfiguration,
			cwd: this.cwd,
		})

		this.configurationManager = new ConfigurationManager({
			taskId: this.taskId,
			providerRef: this.providerRef,
			onConfigurationUpdate: (newConfig) => {
				this.updateApiConfiguration(newConfig)
			},
		})

		this.subtaskManager = new SubtaskManager({
			task: this,
			providerRef: this.providerRef,
			taskId: this.taskId,
			rootTaskId: this.rootTaskId,
			parentTaskId: this.parentTaskId,
			taskNumber: this.taskNumber,
			workspacePath: this.workspacePath,
			apiConfiguration,
		})

		this.taskLifecycleManager = new TaskLifecycleManager({
			task: this,
			providerRef: this.providerRef,
			taskId: this.taskId,
			taskNumber: this.taskNumber,
			workspacePath: this.workspacePath,
			apiConfiguration,
			metadata: this.metadata,
			enableCheckpoints: this.enableCheckpoints,
		})

		// Sync task mode from state manager
		this._taskMode = this.stateManager.taskMode
		this._taskToolProtocol = this.stateManager.taskToolProtocol

		// Initialize the assistant message parser based on the locked tool protocol.
		const effectiveProtocol = this._taskToolProtocol || "xml"
		this.assistantMessageParser = effectiveProtocol !== "native" ? new AssistantMessageParser() : undefined

		this.messageQueueService = new MessageQueueService()

		this.messageQueueStateChangedHandler = () => {
			this.emit(RooCodeEventName.TaskUserMessage, this.taskId)
			this.providerRef.deref()?.postStateToWebview()
		}

		this.messageQueueService.on("stateChanged", this.messageQueueStateChangedHandler)

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
		return this.messageQueueService.messages
	}

	public get tokenUsage(): TokenUsage | undefined {
		if (this.tokenUsageSnapshot && this.tokenUsageSnapshotAt) {
			return this.tokenUsageSnapshot
		}

		this.tokenUsageSnapshot = this.getTokenUsage()
		this.tokenUsageSnapshotAt = this.clineMessages.at(-1)?.ts

		return this.tokenUsageSnapshot
	}

	public cancelCurrentRequest(): void {
		this.stateManager.cancelCurrentRequest()
	}

	public emitFinalTokenUsageUpdate(): void {
		this.usageTracker.emitFinalTokenUsageUpdate()
	}

	// API Messages - delegated to message manager
	private async getSavedApiConversationHistory(): Promise<ApiMessage[]> {
		return this.taskMessageManager.getSavedApiConversationHistory()
	}

	private async addToApiConversationHistory(message: Anthropic.MessageParam, reasoning?: string) {
		return this.taskMessageManager.addToApiConversationHistory(message, reasoning, this.api)
	}

	async overwriteApiConversationHistory(newHistory: ApiMessage[]) {
		return this.taskMessageManager.overwriteApiConversationHistory(newHistory)
	}

	public async flushPendingToolResultsToHistory(): Promise<void> {
		return this.taskMessageManager.flushPendingToolResultsToHistory()
	}

	private async saveApiConversationHistory() {
		return this.taskMessageManager.saveApiConversationHistory()
	}

	// Cline Messages - delegated to message manager
	private async getSavedClineMessages(): Promise<ClineMessage[]> {
		return this.taskMessageManager.getSavedClineMessages()
	}

	private async addToClineMessages(message: ClineMessage) {
		return this.taskMessageManager.addToClineMessages(message, this.providerRef, this.cloudSyncedMessageTimestamps)
	}

	public async overwriteClineMessages(newMessages: ClineMessage[]) {
		await this.taskMessageManager.overwriteClineMessages(newMessages, this.providerRef, this.cloudSyncedMessageTimestamps)
		this.clineMessages = newMessages
		this.cloudSyncedMessageTimestamps.clear()
		for (const msg of newMessages) {
			if (msg.partial !== true) {
				this.cloudSyncedMessageTimestamps.add(msg.ts)
			}
		}
	}

	private async updateClineMessage(message: ClineMessage) {
		return this.taskMessageManager.updateClineMessage(message, this.providerRef)
	}

	public async saveClineMessages() {
		return this.taskMessageManager.saveClineMessages()
	}

	private findMessageByTimestamp(ts: number): ClineMessage | undefined {
		return this.taskMessageManager.findMessageByTimestamp(ts)
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

	public async checkpointRestore(options: CheckpointRestoreOptions) {
		return this.checkpointManager.checkpointRestore(options)
	}

	public async checkpointDiff(options: CheckpointDiffOptions) {
		return this.checkpointManager.checkpointDiff(options)
	}

	// Context management - kept in Task class as it orchestrates multiple components
	public async condenseContext(): Promise<void> {
		const systemPrompt = await this.getSystemPrompt()

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

	// Task lifecycle methods
	public async abortTask(isAbandoned = false) {
		this.taskLifecycleManager.abortTask(isAbandoned)
	}

	public dispose(): void {
		this.taskLifecycleManager.dispose()
	}

	public async startSubtask(message: string, initialTodos: TodoItem[], mode: string) {
		return this.subtaskManager.startSubtask(message, initialTodos, mode)
	}

	public async resumeAfterDelegation(): Promise<void> {
		return this.subtaskManager.resumeAfterDelegation()
	}

	public async submitUserMessage(text: string, images: string[] = []): Promise<void> {
		if (text.length === 0 && images.length === 0) {
			return
		}

		const provider = this.providerRef.deref()
		if (!provider) {
			throw new Error("Provider reference lost")
		}

		const state = await provider.getState()
		if (!state) {
			throw new Error("Provider state not available")
		}

		const { mode, apiConfiguration } = state

		if (mode) {
			this._taskMode = mode
		}

		if (apiConfiguration) {
			this.apiConfiguration = apiConfiguration
			this.api = buildApiHandler(apiConfiguration)
		}

		await this.recursivelyMakeClineRequests(
			[
				{ type: "text", text: text },
				...images.map((image) => ({ type: "image", source: { type: "base64", media_type: "image/png", data: image } } as Anthropic.Messages.ImageBlockParam)),
			],
			false,
		)
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
		if (!this.messageQueueService.isEmpty()) {
			const queued = this.messageQueueService.dequeueMessage()
			if (queued) {
				setTimeout(() => {
					this.submitUserMessage(queued.text, queued.images)
				}, 100)
			}
		}
	}

	public async recursivelyMakeClineRequests(
		userContent: Anthropic.Messages.ContentBlockParam[],
		includeFileDetails: boolean = false,
	): Promise<boolean> {
		return this.apiRequestManager.recursivelyMakeClineRequests(userContent, includeFileDetails)
	}

	private async getSystemPrompt(): Promise<string> {
		const provider = this.providerRef.deref()
		if (!provider) {
			throw new Error("Provider reference lost")
		}

		const state = await provider.getState()
		const mcpEnabled = state?.mcpEnabled ?? true

		if (mcpEnabled) {
			const mcpHub = provider.getMcpHub()
			if (!mcpHub) {
				throw new Error("MCP Hub not available")
			}

			const mcpServers = mcpHub.getServers()
			const mcpTools = mcpServers.flatMap((server) => server.tools ?? [])

			return SYSTEM_PROMPT(
				provider.context,
				this.cwd,
				state?.browserToolEnabled ?? true,
				mcpHub,
				this.diffStrategy,
				state?.browserViewportSize ?? "900x600",
				await this.getTaskMode(),
				state?.customModePrompts,
				undefined,
				state?.customInstructions,
				this.diffEnabled,
				state?.experiments,
				state?.enableMcpServerCreation,
				state?.language,
				this.rooIgnoreController?.getInstructions(),
				state?.maxReadFileLine !== -1,
				{
					maxConcurrentFileReads: state?.maxConcurrentFileReads ?? 5,
					todoListEnabled: this.apiConfiguration?.todoListEnabled ?? true,
					browserToolEnabled: state?.browserToolEnabled ?? true,
					useAgentRules: vscode.workspace.getConfiguration(Package.name).get<boolean>("useAgentRules") ?? true,
					newTaskRequireTodos: vscode.workspace.getConfiguration(Package.name).get<boolean>("newTaskRequireTodos") ?? false,
				},
				this.todoList ?? [],
				getModelId(this.apiConfiguration),
			)
		}

		return SYSTEM_PROMPT(
			provider.context,
			this.cwd,
			state?.browserToolEnabled ?? true,
			undefined,
			this.diffStrategy,
			state?.browserViewportSize ?? "900x600",
			await this.getTaskMode(),
			state?.customModePrompts,
			undefined,
			state?.customInstructions,
			this.diffEnabled,
			state?.experiments,
			state?.enableMcpServerCreation,
			state?.language,
			this.rooIgnoreController?.getInstructions(),
			state?.maxReadFileLine !== -1,
			{
				maxConcurrentFileReads: state?.maxConcurrentFileReads ?? 5,
				todoListEnabled: this.apiConfiguration?.todoListEnabled ?? true,
				browserToolEnabled: state?.browserToolEnabled ?? true,
				useAgentRules: vscode.workspace.getConfiguration(Package.name).get<boolean>("useAgentRules") ?? true,
				newTaskRequireTodos: vscode.workspace.getConfiguration(Package.name).get<boolean>("newTaskRequireTodos") ?? false,
			},
			this.todoList ?? [],
			getModelId(this.apiConfiguration),
		)
	}

	private async handleContextWindowExceededError(): Promise<void> {
		const provider = this.providerRef.deref()
		const state = await provider?.getState()

		const {
			autoCondenseContext = true,
			autoCondenseContextPercent = 100,
			profileThresholds = {},
			customCondensingPrompt,
			condensingApiConfigId,
			listApiConfigMeta,
		} = state ?? {}

		const systemPrompt = await this.getSystemPrompt()
		const { contextTokens } = this.getTokenUsage()

		const modelInfo = this.api.getModel().info
		const maxTokens = getModelMaxOutputTokens({
			modelId: this.api.getModel().id,
			model: modelInfo,
			settings: this.apiConfiguration,
		})
		const contextWindow = modelInfo.contextWindow

		const currentProfileId = this.configurationManager.getCurrentProfileId(state)
		const useNativeTools = isNativeProtocol(this._taskToolProtocol ?? "xml")

		let condensingApiHandler: ApiHandler | undefined

		if (condensingApiConfigId && listApiConfigMeta && Array.isArray(listApiConfigMeta)) {
			const matchingConfig = listApiConfigMeta.find((config) => config.id === condensingApiConfigId)

			if (matchingConfig) {
				const profile = await provider?.providerSettingsManager.getProfile({
					id: condensingApiConfigId,
				})

				if (profile && profile.apiProvider) {
					condensingApiHandler = buildApiHandler(profile)
				}
			}
		}

		const truncateResult = await manageContext({
			messages: this.apiConversationHistory,
			totalTokens: contextTokens,
			maxTokens,
			contextWindow,
			apiHandler: this.api,
			autoCondenseContext,
			autoCondenseContextPercent,
			systemPrompt,
			taskId: this.taskId,
			customCondensingPrompt,
			condensingApiHandler,
			profileThresholds,
			currentProfileId,
			useNativeTools,
		})

		if (truncateResult.messages !== this.apiConversationHistory) {
			await this.overwriteApiConversationHistory(truncateResult.messages)
		}

		if (truncateResult.summary) {
			const { summary, cost, prevContextTokens, newContextTokens = 0 } = truncateResult
			const contextCondense: ContextCondense = { summary, cost, newContextTokens, prevContextTokens }
			await this.say(
				"condense_context",
				undefined,
				undefined,
				false,
				undefined,
				undefined,
				{ isNonInteractive: true },
				contextCondense,
			)
		} else if (truncateResult.truncationId) {
			const contextTruncation: ContextTruncation = {
				truncationId: truncateResult.truncationId,
				messagesRemoved: truncateResult.messagesRemoved ?? 0,
				prevContextTokens: truncateResult.prevContextTokens,
				newContextTokens: truncateResult.newContextTokensAfterTruncation ?? 0,
			}
			await this.say(
				"sliding_window_truncation",
				undefined,
				undefined,
				false,
				undefined,
				undefined,
				{ isNonInteractive: true },
				undefined,
				contextTruncation,
			)
		}

		await provider?.postMessageToWebview({ type: "condenseTaskContextResponse", text: this.taskId })
	}

	public async *attemptApiRequest(): ApiStream {
		yield* this.apiRequestManager.attemptApiRequest()
	}

	private async backoffAndAnnounce(retryAttempt: number, error: any): Promise<void> {
		return this.apiRequestManager.backoffAndAnnounce(retryAttempt, error)
	}

	private buildCleanConversationHistory(
		messages: ApiMessage[],
	): Array<
		Anthropic.Messages.MessageParam | { type: "reasoning"; encrypted_content: string; id?: string; summary?: any[] }
	> {
		type ReasoningItemForRequest = {
			type: "reasoning"
			encrypted_content: string
			id?: string
			summary?: any[]
		}

		const cleanConversationHistory: (Anthropic.Messages.MessageParam | ReasoningItemForRequest)[] = []

		for (const msg of messages) {
			if (msg.type === "reasoning") {
				if (msg.encrypted_content) {
					cleanConversationHistory.push({
						type: "reasoning",
						summary: msg.summary,
						encrypted_content: msg.encrypted_content!,
						...(msg.id ? { id: msg.id } : {}),
					})
				}
				continue
			}

			if (msg.role === "assistant") {
				const rawContent = msg.content

				const contentArray: Anthropic.Messages.ContentBlockParam[] = Array.isArray(rawContent)
					? (rawContent as Anthropic.Messages.ContentBlockParam[])
					: rawContent !== undefined
						? ([
								{ type: "text", text: rawContent } satisfies Anthropic.Messages.TextBlockParam,
							] as Anthropic.Messages.ContentBlockParam[])
						: []

				const [first, ...rest] = contentArray

				const msgWithDetails = msg
				if (msgWithDetails.reasoning_details && Array.isArray(msgWithDetails.reasoning_details)) {
					let assistantContent: Anthropic.Messages.MessageParam["content"]

					if (contentArray.length === 0) {
						assistantContent = ""
					} else if (contentArray.length === 1 && contentArray[0].type === "text") {
						assistantContent = (contentArray[0] as Anthropic.Messages.TextBlockParam).text
					} else {
						assistantContent = contentArray
					}

					cleanConversationHistory.push({
						role: "assistant",
						content: assistantContent,
						reasoning_details: msgWithDetails.reasoning_details,
					} as any)

					continue
				}

				const hasEncryptedReasoning =
					first && (first as any).type === "reasoning" && typeof (first as any).encrypted_content === "string"

				if (hasEncryptedReasoning) {
					cleanConversationHistory.push({
						role: "assistant",
						content: rest.length === 0 ? "" : rest,
					})

					continue
				}

				const hasThinkingBlock =
					first && (first as any).type === "thinking" && typeof (first as any).thinking === "string"

				if (hasThinkingBlock) {
					cleanConversationHistory.push({
						role: "assistant",
						content: rest.length === 0 ? "" : rest,
					})

					continue
				}

				cleanConversationHistory.push(msg as Anthropic.Messages.MessageParam)
			} else if (msg.role) {
				cleanConversationHistory.push(msg as Anthropic.Messages.MessageParam)
			}
		}

		return cleanConversationHistory
	}

	private broadcastBrowserSessionUpdate(): void {
		const provider = this.providerRef.deref()
		if (!provider) {
			return
		}

		provider.postMessageToWebview({
			type: "browserSessionUpdate",
			isBrowserSessionActive: this.browserSession.isSessionActive(),
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

	get messageManager(): MessageManager {
		if (!this._messageManager) {
			this._messageManager = new MessageManager(this)
		}
		return this._messageManager
	}

	private isValidTokenCount(count: number | undefined): boolean {
		return count !== undefined && count !== null && count > 0
	}

	private async estimateTokensWithTiktoken(): Promise<{ inputTokens: number; outputTokens: number } | null> {
		try {
			let inputTokens = 0
			let outputTokens = 0

			if (this.userMessageContent.length > 0) {
				inputTokens = await this.api.countTokens(this.userMessageContent)
			}

			if (this.assistantMessageContent.length > 0) {
				const assistantContent = this.assistantMessageContent.map((block) => {
					if (block.type === "text") {
						return { type: "text" as const, text: block.content }
					} else if (block.type === "tool_use") {
						return { type: "text" as const, text: JSON.stringify(block.params) }
					}
					return { type: "text" as const, text: "" }
				})
				outputTokens = await this.api.countTokens(assistantContent)
			}

			return { inputTokens, outputTokens }
		} catch (error) {
			console.error("Failed to estimate tokens with tiktoken:", error)
			return null
		}
	}
}
