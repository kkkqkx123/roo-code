import type { ClineMessage } from "@roo-code/types"
import type { ApiMessage } from "../../task-persistence/apiMessages"
import { readApiMessages, saveApiMessages, readTaskMessages, saveTaskMessages } from "../../task-persistence"
import { findLastIndex } from "../../../shared/array"
import { restoreTodoListForTask } from "../../tools/UpdateTodoListTool"
import type { TaskStateManager } from "./TaskStateManager"
import type { ClineProvider } from "../../webview/ClineProvider"

export interface MessageManagerOptions {
	stateManager: TaskStateManager
	taskId: string
	globalStoragePath: string
}

export class MessageManager {
	private stateManager: TaskStateManager
	private taskId: string
	private globalStoragePath: string

	apiConversationHistory: ApiMessage[] = []
	clineMessages: ClineMessage[] = []

	constructor(options: MessageManagerOptions) {
		this.stateManager = options.stateManager
		this.taskId = options.taskId
		this.globalStoragePath = options.globalStoragePath
	}

	async getSavedApiConversationHistory(): Promise<ApiMessage[]> {
		return readApiMessages({ taskId: this.taskId, globalStoragePath: this.globalStoragePath })
	}

	async getSavedClineMessages(): Promise<ClineMessage[]> {
		return readTaskMessages({ taskId: this.taskId, globalStoragePath: this.globalStoragePath })
	}

	async addToApiConversationHistory(message: ApiMessage, reasoning?: string, api?: any): Promise<void> {
		const messageWithTs = {
			...message,
			ts: Date.now(),
		} as ApiMessage

		if (message.role === "assistant") {
			const content = messageWithTs.content

			if (Array.isArray(content)) {
				const reasoningDetails = content.find((block: any) => block.type === "reasoning_details")
				const thoughtSignature = content.find((block: any) => block.type === "thought_signature")

				if (reasoningDetails) {
					const contentWithoutReasoning = content.filter((block: any) => block.type !== "reasoning_details")
					messageWithTs.content = contentWithoutReasoning.length > 0 ? contentWithoutReasoning : ""
				} else if (reasoning && thoughtSignature && !reasoningDetails) {
					const reasoningDetailsBlock = {
						type: "reasoning_details",
						reasoning,
						signature: thoughtSignature,
					} as any
					messageWithTs.content = [...content, reasoningDetailsBlock]
				}
			} else if (typeof messageWithTs.content === "string") {
				const thoughtSignature = messageWithTs.content.match(/<thought_signature>([\s\S]*?)<\/thought_signature>/)
				if (thoughtSignature && !reasoning) {
					const reasoningDetailsBlock = {
						type: "reasoning_details",
						reasoning: messageWithTs.content,
						signature: thoughtSignature[1],
					} as any
					messageWithTs.content = [reasoningDetailsBlock]
				}
			}
		}

		this.apiConversationHistory.push(messageWithTs)
		await this.saveApiConversationHistory()
	}

	async overwriteApiConversationHistory(newHistory: ApiMessage[]): Promise<void> {
		this.apiConversationHistory = newHistory
		await this.saveApiConversationHistory()
	}

	async addToClineMessages(message: ClineMessage, providerRef?: WeakRef<ClineProvider>, cloudSyncedMessageTimestamps?: Set<number>): Promise<void> {
		this.clineMessages.push(message)
		await this.saveClineMessages()
	}

	async overwriteClineMessages(newMessages: ClineMessage[], providerRef?: WeakRef<ClineProvider>, cloudSyncedMessageTimestamps?: Set<number>): Promise<void> {
		this.clineMessages = newMessages
		restoreTodoListForTask(this.stateManager as any)

		for (const msg of newMessages) {
			if (msg.partial !== true) {
				this.stateManager.lastMessageTs = msg.ts
			}
		}

		await this.saveClineMessages()
	}

	async updateClineMessage(message: ClineMessage, providerRef?: WeakRef<ClineProvider>): Promise<void> {
		const index = this.findMessageIndexByTimestamp(message.ts)
		if (index !== -1) {
			this.clineMessages[index] = message
			await this.saveClineMessages()
		}
	}

	async saveApiConversationHistory(): Promise<void> {
		await saveApiMessages({ messages: this.apiConversationHistory, taskId: this.taskId, globalStoragePath: this.globalStoragePath })
	}

	async saveClineMessages(messages?: ClineMessage[]): Promise<void> {
		if (messages) {
			this.clineMessages = messages
		}
		await saveTaskMessages({ messages: this.clineMessages, taskId: this.taskId, globalStoragePath: this.globalStoragePath })
	}

	findMessageByTimestamp(ts: number): ClineMessage | undefined {
		for (let i = this.clineMessages.length - 1; i >= 0; i--) {
			if (this.clineMessages[i].ts === ts) {
				return this.clineMessages[i]
			}
		}
		return undefined
	}

	findMessageIndexByTimestamp(ts: number): number {
		for (let i = this.clineMessages.length - 1; i >= 0; i--) {
			if (this.clineMessages[i].ts === ts) {
				return i
			}
		}
		return -1
	}

	getApiConversationHistory(): ApiMessage[] {
		return this.apiConversationHistory
	}

	getClineMessages(): ClineMessage[] {
		return this.clineMessages
	}

	getLastApiReqIndex(): number {
		return findLastIndex(this.clineMessages, (m) => m.say === "api_req_started")
	}

	async flushPendingToolResultsToHistory(): Promise<void> {
		if (this.apiConversationHistory.length === 0) {
			return
		}

		const lastMessage = this.apiConversationHistory[this.apiConversationHistory.length - 1]

		if (lastMessage.role === "user" && Array.isArray(lastMessage.content)) {
			const toolResultBlocks = lastMessage.content.filter(
				(block: any) => block.type === "tool_result",
			)

			if (toolResultBlocks.length > 0) {
				await this.saveApiConversationHistory()
			}
		}
	}

	async postToWebview(): Promise<void> {
		const provider = this.stateManager.getProvider()
		if (provider) {
			await provider.postStateToWebview()
		}
	}
}
