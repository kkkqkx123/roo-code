import type { ClineProvider } from "../../webview/ClineProvider"
import type { TodoItem, ClineMessage } from "@roo-code/types"
import type { Task } from "../Task"
import { RooCodeEventName } from "@roo-code/types"
import { findLastIndex } from "../../../shared/array"
import { ClineApiReqInfo } from "../../../shared/ExtensionMessage"

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
	}

	async startSubtask(message: string, initialTodos: TodoItem[], mode: string): Promise<void> {
		const provider = this.providerRef.deref()
		if (!provider) {
			throw new Error("Provider reference lost")
		}

		const subtask = await (provider as any).delegateParentAndOpenChild({
			parentTaskId: this.taskId,
			message,
			initialTodos,
			mode,
		})

		this.childTaskId = subtask.taskId

		this.task.emit(RooCodeEventName.TaskDelegated, this.taskId, subtask.taskId)
	}

	async resumeAfterDelegation(): Promise<void> {
		const apiConversationHistory = this.task.apiConversationHistory
		const clineMessages = this.task.clineMessages

		if (apiConversationHistory.length === 0) {
			return
		}

		const lastUserMsgIndex = findLastIndex(apiConversationHistory, (msg) => msg.role === "user")

		if (lastUserMsgIndex >= 0) {
			const lastUserMsg = apiConversationHistory[lastUserMsgIndex]

			if (Array.isArray(lastUserMsg.content)) {
				const textBlocks = lastUserMsg.content.filter((block: any) => block.type === "text")

				if (textBlocks.length > 0) {
					const lastTextBlock = textBlocks[textBlocks.length - 1] as any

					if (lastTextBlock.text.includes("Task delegated to subtask")) {
						lastTextBlock.text = lastTextBlock.text.replace(/Task delegated to subtask[\s\S]*?$/g, "")
					}
				}
			}
		}

		let modifiedClineMessages = [...clineMessages]

		for (let i = modifiedClineMessages.length - 1; i >= 0; i--) {
			const msg = modifiedClineMessages[i]
			if (msg.type === "say" && msg.say === "reasoning") {
				modifiedClineMessages.splice(i, 1)
			}
		}

		while (modifiedClineMessages.length > 0) {
			const last = modifiedClineMessages[modifiedClineMessages.length - 1]
			if (last.type === "say" && last.say === "reasoning") {
				modifiedClineMessages.pop()
			} else {
				break
			}
		}

		const lastRelevantMessageIndex = findLastIndex(
			modifiedClineMessages,
			(msg) => msg.type === "ask" || msg.say === "api_req_started",
		)

		if (lastRelevantMessageIndex !== -1) {
			const lastRelevantMessage = modifiedClineMessages[lastRelevantMessageIndex]
			if (lastRelevantMessage.type === "ask") {
				modifiedClineMessages = modifiedClineMessages.slice(0, lastRelevantMessageIndex)
			}
		}

		for (let i = modifiedClineMessages.length - 1; i >= 0; i--) {
			const msg = modifiedClineMessages[i]
			if (msg.type === "say" && msg.say === "api_req_started") {
				const lastApiReqStartedIndex = i

				if (lastApiReqStartedIndex !== -1) {
					const lastClineMessage = modifiedClineMessages[lastApiReqStartedIndex]
					if (lastClineMessage?.say === "api_req_started") {
						const { cost, cancelReason }: ClineApiReqInfo = JSON.parse(lastClineMessage.text || "{}")

						if (cost === undefined && cancelReason === undefined) {
							modifiedClineMessages.splice(lastApiReqStartedIndex, 1)
						}
					}
				}
				break
			}
		}

		this.task.clineMessages = modifiedClineMessages
		await this.task.saveClineMessages()

		this.childTaskId = undefined
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
