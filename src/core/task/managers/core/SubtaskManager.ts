import type { ClineProvider } from "../../../webview/ClineProvider"
import type { TodoItem, ClineMessage } from "@shared/types"
import type { Task } from "../../Task"
import { RooCodeEventName } from "@shared/types"
import { findLastIndex } from "@shared/array"
import { ClineApiReqInfo } from "@shared/ExtensionMessage"

export interface SubtaskManagerOptions {
	task: Task
	providerRef: WeakRef<ClineProvider>
	taskId: string
	rootTaskId?: string
	parentTaskId?: string
	taskNumber: number
	workspacePath: string
	apiConfiguration: any
}

export class SubtaskManager {
	private task: Task
	private providerRef: WeakRef<ClineProvider>
	private taskId: string
	private rootTaskId?: string
	private parentTaskId?: string
	private taskNumber: number
	private workspacePath: string
	private apiConfiguration: any

	childTaskId?: string
	pendingNewTaskToolCallId?: string

	constructor(options: SubtaskManagerOptions) {
		this.task = options.task
		this.providerRef = options.providerRef
		this.taskId = options.taskId
		this.rootTaskId = options.rootTaskId
		this.parentTaskId = options.parentTaskId
		this.taskNumber = options.taskNumber
		this.workspacePath = options.workspacePath
		this.apiConfiguration = options.apiConfiguration

		// 验证 provider 引用有效性
		if (!this.providerRef.deref()) {
			console.warn("[SubtaskManager] Provider reference is invalid at construction time")
		}
	}

	async startSubtask(message: string, initialTodos: TodoItem[], mode: string): Promise<string> {
		const provider = this.providerRef.deref()
		if (!provider) {
			throw new Error("Provider reference lost")
		}

		try {
			// 使用类型安全的调用方式
			const subtask = await provider.delegateParentAndOpenChild({
				parentTaskId: this.taskId,
				message,
				initialTodos,
				mode,
			})

			this.childTaskId = subtask.taskId
			this.task.emit(RooCodeEventName.TaskDelegated, this.taskId, subtask.taskId)
			
			console.log(`[SubtaskManager] Started subtask ${subtask.taskId} for parent ${this.taskId}`)
			return subtask.taskId
		} catch (error) {
			console.error("[SubtaskManager] Failed to start subtask:", error)
			throw new Error(`Failed to start subtask: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	async resumeAfterDelegation(): Promise<void> {
		try {
			const apiConversationHistory = this.task.apiConversationHistory
			const clineMessages = this.task.clineMessages

			if (apiConversationHistory.length === 0) {
				return
			}

			// 简化消息清理逻辑
			const cleanedMessages = this.cleanupDelegationMessages(clineMessages)
			this.task.clineMessages = cleanedMessages
			await this.task.saveClineMessages()

			this.childTaskId = undefined
			console.log(`[SubtaskManager] Resumed after delegation, cleaned ${clineMessages.length - cleanedMessages.length} messages`)
		} catch (error) {
			console.error("[SubtaskManager] Failed to resume after delegation:", error)
			throw error
		}
	}

	/**
	 * 清理委托相关的消息
	 */
	private cleanupDelegationMessages(clineMessages: ClineMessage[]): ClineMessage[] {
		let cleanedMessages = [...clineMessages]
		
		// 1. 移除所有推理消息
		cleanedMessages = cleanedMessages.filter(msg =>
			!(msg.type === "say" && msg.say === "reasoning")
		)

		// 2. 找到最后一个相关消息索引
		const lastRelevantIndex = findLastIndex(
			cleanedMessages,
			(msg: ClineMessage) => msg.type === "ask" || (msg.type === "say" && msg.say === "api_req_started")
		)

		// 3. 如果找到相关消息，截断到该位置
		if (lastRelevantIndex !== -1) {
			const lastMsg = cleanedMessages[lastRelevantIndex]
			if (lastMsg.type === "ask") {
				cleanedMessages = cleanedMessages.slice(0, lastRelevantIndex)
			} else if (lastMsg.type === "say" && lastMsg.say === "api_req_started") {
				// 检查是否需要保留该消息
				const info: ClineApiReqInfo = JSON.parse(lastMsg.text || "{}")
				if (info.cost === undefined && info.cancelReason === undefined) {
					cleanedMessages = cleanedMessages.slice(0, lastRelevantIndex)
				}
			}
		}

		return cleanedMessages
	}

	getChildTaskId(): string | undefined {
		return this.childTaskId
	}

	getPendingNewTaskToolCallId(): string | undefined {
		return this.pendingNewTaskToolCallId
	}

	setPendingNewTaskToolCallId(toolCallId: string): void {
		this.pendingNewTaskToolCallId = toolCallId
	}

	clearPendingNewTaskToolCallId(): void {
		this.pendingNewTaskToolCallId = undefined
	}
}
