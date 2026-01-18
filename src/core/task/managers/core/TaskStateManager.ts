import { EventEmitter } from "events"
import type { TaskMetadata, ToolProtocol, RooCodeEventName, TodoItem, ModelInfo } from "@shared/types"
import { resolveToolProtocol } from "../../../../utils/resolveToolProtocol"
import { defaultModeSlug } from "../../../../shared/modes"
import type { ClineProvider } from "../../../webview/ClineProvider"
import type { ProviderSettings } from "@shared/types"

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
			// 异步初始化任务模式，但不阻塞构造函数
			this.taskModeReady = this.initializeTaskMode(options.provider).catch((error) => {
				console.error("[TaskStateManager] Failed to initialize task mode:", error)
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
		// 如果尚未初始化，返回默认值
		// 注意：如果需要确保获取初始化后的值，应使用 getTaskMode() 方法
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

	// setTaskToolProtocol 是 taskToolProtocol setter 的别名，保持向后兼容
	setTaskToolProtocol(protocol: ToolProtocol | undefined): void {
		this._taskToolProtocol = protocol
	}

	setSystemPrompt(systemPrompt: string): void {
		// 系统提示的恢复由Task类处理，这里只是占位方法
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

	dispose(
		providerRef: WeakRef<ClineProvider>,
		messageQueueStateChangedHandler?: (() => void) | undefined,
		providerProfileChangeListener?: (config: { name: string; provider?: string }) => void,
	): void {
		// 移除所有事件监听器
		this.removeAllListeners()
		
		// 取消当前请求
		this.cancelCurrentRequest()
		
		// 清理引用
		this.providerRef = new WeakRef({} as ClineProvider)
		
		// 清理待办列表
		this.todoList = undefined
		
		// 清理状态标志
		this.abort = false
		this.isPaused = false
		this.didFinishAbortingStream = false
		this.abandoned = false
		this.abortReason = undefined
		this.isInitialized = false
	}

	updateApiConfiguration(newApiConfiguration: ProviderSettings): void {
		// 配置更新由 Task 类处理
		// 此方法保留用于接口兼容性
		// 如果需要在此处处理配置更新，可以添加相应的逻辑
		console.log("[TaskStateManager] API configuration update received (handled by Task class)")
	}
}
