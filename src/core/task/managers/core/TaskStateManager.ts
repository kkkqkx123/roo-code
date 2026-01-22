import { EventEmitter } from "events"
import type { TaskMetadata, ToolProtocol, RooCodeEventName, TodoItem, ModelInfo } from "@shared/types"
import { resolveToolProtocol } from "../../../../utils/resolveToolProtocol"
import { defaultModeSlug } from "@core/modes/mode-utils"
import type { ClineProvider } from "../../../webview/ClineProvider"
import type { ProviderSettings } from "@shared/types"
import { ErrorHandler } from "../../../error/ErrorHandler"

export interface TaskStateOptions {
	taskId: string
	rootTaskId?: string
	parentTaskId?: string
	taskNumber: number
	workspacePath: string
	metadata: TaskMetadata
	provider: ClineProvider
	apiConfiguration: ProviderSettings
	historyItem?: any
	initialTodos?: TodoItem[]
	initialStatus?: "active" | "delegated" | "completed" | "aborted"
	modelInfo?: ModelInfo
}

export class TaskStateManager extends EventEmitter {
	readonly taskId: string
	readonly rootTaskId?: string
	readonly parentTaskId?: string
	childTaskId?: string
	pendingNewTaskToolCallId?: string

	readonly instanceId: string
	readonly metadata: TaskMetadata
	readonly taskNumber: number
	readonly workspacePath: string

	private _taskMode: string | undefined
	private _taskToolProtocol: ToolProtocol | undefined
	private taskModeReady: Promise<void>
	private initializationError: Error | null = null
	private errorHandler: ErrorHandler

	providerRef: WeakRef<ClineProvider>
	abort: boolean = false
	currentRequestAbortController?: AbortController
	skipPrevResponseIdOnce: boolean = false
	lastMessageTs?: number

	isInitialized = false
	isPaused: boolean = false
	didFinishAbortingStream = false
	abandoned = false
	abortReason?: any

	todoList?: TodoItem[]

	private readonly initialStatus?: "active" | "delegated" | "completed" | "aborted"

	constructor(options: TaskStateOptions) {
		super()

		this.taskId = options.taskId
		this.rootTaskId = options.rootTaskId
		this.parentTaskId = options.parentTaskId
		this.childTaskId = undefined
		this.pendingNewTaskToolCallId = undefined

		this.instanceId = crypto.randomUUID().slice(0, 8)
		this.metadata = options.metadata
		this.taskNumber = options.taskNumber
		this.workspacePath = options.workspacePath

		this.providerRef = new WeakRef(options.provider)
		this.initialStatus = options.initialStatus
		this.errorHandler = new ErrorHandler()

		if (options.initialTodos && options.initialTodos.length > 0) {
			this.todoList = options.initialTodos
		}

		if (options.historyItem) {
			this._taskMode = options.historyItem.mode || defaultModeSlug
			this.taskModeReady = Promise.resolve()
			this._taskToolProtocol = options.historyItem.toolProtocol
		} else {
			this._taskMode = undefined
			this.taskModeReady = this.initializeTaskMode(options.provider).catch((error) => {
				console.error("[TaskStateManager] Failed to initialize task mode:", error)
				this.initializationError = error instanceof Error ? error : new Error(String(error))
				this._taskMode = defaultModeSlug
			})
			const modelInfo = options.modelInfo
			this._taskToolProtocol = resolveToolProtocol(options.apiConfiguration, modelInfo)
		}
	}

	async initializeTaskMode(provider: ClineProvider): Promise<void> {
		try {
			const state = await provider.getState()
			this._taskMode = state.mode || defaultModeSlug
		} catch (error) {
			console.error("[TaskStateManager] Failed to initialize task mode:", error)
			await this.errorHandler.handleError(
				error instanceof Error ? error : new Error(String(error)),
				{
					operation: "initializeTaskMode",
					taskId: this.taskId,
					timestamp: Date.now()
				}
			)
			this._taskMode = defaultModeSlug
		}
	}

	async waitForModeInitialization(): Promise<void> {
		await this.taskModeReady
	}

	async getTaskMode(): Promise<string> {
		await this.taskModeReady
		if (this.initializationError) {
			throw this.initializationError
		}
		return this._taskMode || defaultModeSlug
	}

	get taskMode(): string {
		if (this.initializationError) {
			console.warn("[TaskStateManager] Using taskMode getter while initialization failed:", this.initializationError)
		}
		return this._taskMode ?? defaultModeSlug
	}

	setTaskMode(mode: string): void {
		this._taskMode = mode
	}

	get taskToolProtocol(): ToolProtocol | undefined {
		return this._taskToolProtocol
	}

	set taskToolProtocol(protocol: ToolProtocol | undefined) {
		this._taskToolProtocol = protocol
	}

	setTaskToolProtocol(protocol: ToolProtocol | undefined): void {
		this._taskToolProtocol = protocol
	}

	setSystemPrompt(systemPrompt: string): void {
		console.log("[TaskStateManager] System prompt restoration should be handled by Task class")
	}

	cancelCurrentRequest(): void {
		if (this.currentRequestAbortController) {
			this.currentRequestAbortController.abort()
			this.currentRequestAbortController = undefined
		}
	}

	setAbort(abort: boolean): void {
		this.abort = abort
	}

	setPaused(paused: boolean): void {
		this.isPaused = paused
	}

	setAbandoned(abandoned: boolean): void {
		this.abandoned = abandoned
	}

	setAbortReason(reason: any): void {
		this.abortReason = reason
	}

	setInitialized(initialized: boolean): void {
		this.isInitialized = initialized
	}

	setDidFinishAbortingStream(finished: boolean): void {
		this.didFinishAbortingStream = finished
	}

	getProvider(): ClineProvider | undefined {
		return this.providerRef.deref()
	}

	emitTaskEvent(eventName: RooCodeEventName, ...args: any[]): void {
		this.emit(eventName, ...args)
	}

	validateState(): boolean {
		try {
			if (!this.taskId) {
				console.warn("[TaskStateManager] Validation failed: taskId is missing")
				return false
			}

			if (!this.workspacePath) {
				console.warn("[TaskStateManager] Validation failed: workspacePath is missing")
				return false
			}

			if (this.initializationError) {
				console.warn("[TaskStateManager] Validation warning: initialization failed with error:", this.initializationError)
			}

			return true
		} catch (error) {
			console.error("[TaskStateManager] State validation error:", error)
			return false
		}
	}

	dispose(
		providerRef: WeakRef<ClineProvider>,
		messageQueueStateChangedHandler?: (() => void) | undefined,
		providerProfileChangeListener?: (config: { name: string; provider?: string }) => void,
	): void {
		try {
			if (!this.validateState()) {
				console.warn("[TaskStateManager] State validation failed during dispose")
			}

			this.removeAllListeners()
			
			this.cancelCurrentRequest()
			
			this.providerRef = providerRef
			
			this.todoList = undefined
			
			this.abort = false
			this.isPaused = false
			this.didFinishAbortingStream = false
			this.abandoned = false
			this.abortReason = undefined
			this.isInitialized = false
			this.initializationError = null
			
			console.log(`[TaskStateManager] Disposed for task ${this.taskId}`)
		} catch (error) {
			console.error("[TaskStateManager] Dispose failed:", error)
		}
	}

	updateApiConfiguration(newApiConfiguration: ProviderSettings): void {
		console.log("[TaskStateManager] API configuration update received (handled by Task class)")
	}
}
