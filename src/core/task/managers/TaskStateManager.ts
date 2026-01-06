import { EventEmitter } from "events"
import type { TaskMetadata, TaskEvents, ToolProtocol, RooCodeEventName, TodoItem, ModelInfo } from "@roo-code/types"
import { resolveToolProtocol } from "../../../utils/resolveToolProtocol"
import { defaultModeSlug } from "../../../shared/modes"
import type { ClineProvider } from "../../webview/ClineProvider"
import type { ProviderSettings } from "@roo-code/types"

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
	initialStatus?: "active" | "delegated" | "completed"
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

	private readonly initialStatus?: "active" | "delegated" | "completed"

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

		if (options.initialTodos && options.initialTodos.length > 0) {
			this.todoList = options.initialTodos
		}

		if (options.historyItem) {
			this._taskMode = options.historyItem.mode || defaultModeSlug
			this.taskModeReady = Promise.resolve()
			this._taskToolProtocol = options.historyItem.toolProtocol
		} else {
			this._taskMode = undefined
			this.taskModeReady = this.initializeTaskMode(options.provider)
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
			this._taskMode = defaultModeSlug
		}
	}

	async waitForModeInitialization(): Promise<void> {
		await this.taskModeReady
	}

	async getTaskMode(): Promise<string> {
		await this.taskModeReady
		return this._taskMode || defaultModeSlug
	}

	get taskMode(): string {
		if (this._taskMode === undefined) {
			throw new Error("Task mode not initialized. Call waitForModeInitialization() first.")
		}
		return this._taskMode
	}

	get taskToolProtocol(): ToolProtocol | undefined {
		return this._taskToolProtocol
	}

	set taskToolProtocol(protocol: ToolProtocol | undefined) {
		this._taskToolProtocol = protocol
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

	dispose(
		providerRef: WeakRef<ClineProvider>,
		messageQueueStateChangedHandler?: (() => void) | undefined,
		providerProfileChangeListener?: (config: { name: string; provider?: string }) => void,
	): void {
		this.removeAllListeners()
	}

	updateApiConfiguration(newApiConfiguration: ProviderSettings): void {
		// Configuration update is handled by the Task class
		// This method is kept for interface compatibility
	}
}
