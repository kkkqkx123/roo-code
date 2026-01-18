import type { ClineMessage } from "@roo-code/types"
import type { ApiMessage } from "../../../task-persistence"
import { readApiMessages, saveApiMessages, readTaskMessages, saveTaskMessages } from "../../../task-persistence"
import { findLastIndex } from "../../../../shared/array"
import { restoreTodoListForTask } from "../../../tools/UpdateTodoListTool"
import type { TaskStateManager } from "../core/TaskStateManager"
import type { ClineProvider } from "../../../webview/ClineProvider"
import { RooCodeEventName } from "@roo-code/types"
import type { IndexManager } from "../core/IndexManager"

export interface MessageManagerOptions {
	stateManager: TaskStateManager
	taskId: string
	globalStoragePath: string
	task?: any // Add optional task reference for token usage updates
	eventBus?: any // Add optional event bus reference
	indexManager: IndexManager // Add index manager reference
}

export class MessageManager {
	private stateManager: TaskStateManager
	private taskId: string
	private globalStoragePath: string
	private task?: any // Store task reference for token usage updates
	private eventBus?: any // Store event bus reference
	private indexManager: IndexManager // Index manager reference
	private initialized: boolean = false // 初始化状态标志
	
	// 添加缺失的属性
	private currentRequestIndex: number | undefined

	apiConversationHistory: ApiMessage[] = []
	clineMessages: ClineMessage[] = []

	constructor(options: MessageManagerOptions) {
		this.stateManager = options.stateManager
		this.taskId = options.taskId
		this.globalStoragePath = options.globalStoragePath
		this.task = options.task
		this.eventBus = options.eventBus
		this.indexManager = options.indexManager
	}

	/**
	 * 异步初始化方法，必须在构造后调用
	 */
	async initialize(): Promise<void> {
		if (this.initialized) {
			return
		}
		
		// 初始化 IndexManager
		await this.indexManager.initialize()
		this.initialized = true
	}

	/**
	 * 确保已初始化
	 */
	private ensureInitialized(): void {
		if (!this.initialized) {
			throw new Error('[MessageManager] Not initialized. Call initialize() first.')
		}
	}

	/**
	 * 开始新的API请求，分配请求索引
	 */
	startNewApiRequest(): number {
		return this.indexManager.startNewApiRequest()
	}

	/**
	 * 获取当前请求索引
	 */
	getCurrentRequestIndex(): number | undefined {
		return this.indexManager.getCurrentRequestIndex()
	}

	/**
	 * 设置当前请求索引
	 */
	setCurrentRequestIndex(index: number): void {
		this.indexManager.setCurrentRequestIndex(index)
	}

	/**
	 * 结束当前API请求
	 */
	endCurrentApiRequest(): void {
		this.indexManager.endCurrentApiRequest()
	}

	async getSavedApiConversationHistory(): Promise<ApiMessage[]> {
		return readApiMessages({ taskId: this.taskId, globalStoragePath: this.globalStoragePath })
	}

	async getSavedClineMessages(): Promise<ClineMessage[]> {
		return readTaskMessages({ taskId: this.taskId, globalStoragePath: this.globalStoragePath })
	}

	async addToApiConversationHistory(message: ApiMessage, reasoning?: string, api?: any): Promise<void> {
		this.ensureInitialized()
		
		// 修改：基于请求索引的策略
		let conversationIndex: number | undefined
		
		if (message.role === "assistant") {
			// 响应消息继承当前请求索引
			conversationIndex = this.getCurrentRequestIndex()
			
			// 如果没有当前请求（异常情况），分配新索引
			if (conversationIndex === undefined) {
				conversationIndex = this.indexManager.getConversationIndexCounter()
				this.indexManager.setConversationIndexCounter(conversationIndex + 1)
				console.warn(`[MessageManager] Assistant message without active request, assigned new index: ${conversationIndex}`)
			}
		} else if (message.role === "user") {
			// 用户消息也分配索引
			conversationIndex = this.indexManager.getConversationIndexCounter()
			this.indexManager.setConversationIndexCounter(conversationIndex + 1)
		}

		const messageWithTs = {
			...message,
			ts: Date.now(),
			conversationIndex,
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
		const provider = this.stateManager.getProvider()
		provider?.log(`[MessageManager#addToClineMessages] Adding message, type: ${message.type}, say: ${message.say}, current count: ${this.clineMessages.length}`)
		
		this.clineMessages.push(message)
		await this.saveClineMessages()
		
		provider?.log(`[MessageManager#addToClineMessages] Message saved, new count: ${this.clineMessages.length}`)
		
		if (this.eventBus) {
			provider?.log(`[MessageManager#addToClineMessages] Emitting TaskUserMessage event`)
			this.eventBus.emit(RooCodeEventName.TaskUserMessage, this.taskId)
		}
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
			
			if (this.eventBus) {
				this.eventBus.emit(RooCodeEventName.TaskUserMessage, this.taskId)
			}
		}
	}

	async saveApiConversationHistory(): Promise<void> {
		// 确保所有消息都有 conversationIndex
		const messagesWithIndex = this.apiConversationHistory.map(msg => {
			if (msg.conversationIndex === undefined && msg.role) {
				const currentIndex = this.indexManager.getConversationIndexCounter()
				this.indexManager.setConversationIndexCounter(currentIndex + 1)
				return {
					...msg,
					conversationIndex: currentIndex
				}
			}
			return msg
		})
		
		await saveApiMessages({ messages: messagesWithIndex, taskId: this.taskId, globalStoragePath: this.globalStoragePath })
	}

	async saveClineMessages(messages?: ClineMessage[]): Promise<void> {
		if (messages) {
			this.clineMessages = messages
		}
		await saveTaskMessages({ messages: this.clineMessages, taskId: this.taskId, globalStoragePath: this.globalStoragePath })
		
		// Notify the task to update token usage
		if (this.task && typeof this.task.saveClineMessages === 'function') {
			await this.task.saveClineMessages()
		}
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

	dispose(): void {
		this.apiConversationHistory = []
		this.clineMessages = []
		this.task = undefined
		this.indexManager.dispose()
		this.initialized = false
	}
}
