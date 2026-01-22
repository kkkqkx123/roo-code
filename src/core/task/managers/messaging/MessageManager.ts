import type { ClineMessage } from "@shared/types"
import type { ApiMessage } from "../../../task-persistence"
import { readApiMessages, saveApiMessages, readTaskMessages, saveTaskMessages } from "../../../task-persistence"
import { findLastIndex } from "../../../../shared/array"
import { restoreTodoListForTask } from "../../../tools/UpdateTodoListTool"
import type { TaskStateManager } from "../core/TaskStateManager"
import type { ClineProvider } from "../../../webview/ClineProvider"
import { RooCodeEventName } from "@shared/types"
import type { IndexManager } from "../core/IndexManager"
import { ConversationIndexStrategy } from "./ConversationIndexStrategy"
import { ErrorHandler } from "../../../error/ErrorHandler"

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
	private conversationIndexStrategy: ConversationIndexStrategy // Conversation index strategy
	private errorHandler: ErrorHandler // Error handler
	private initialized: boolean = false // 初始化状态标志

	apiConversationHistory: ApiMessage[] = []
	clineMessages: ClineMessage[] = []

	constructor(options: MessageManagerOptions) {
		this.stateManager = options.stateManager
		this.taskId = options.taskId
		this.globalStoragePath = options.globalStoragePath
		this.task = options.task
		this.eventBus = options.eventBus
		this.indexManager = options.indexManager
		this.conversationIndexStrategy = new ConversationIndexStrategy(options.indexManager)
		this.errorHandler = new ErrorHandler()
	}

	/**
	 * 异步初始化方法，必须在构造后调用
	 */
	async initialize(): Promise<void> {
		if (this.initialized) {
			return
		}
		
		try {
			// 初始化 IndexManager
			await this.indexManager.initialize()
			this.initialized = true
		} catch (error) {
			console.error('[MessageManager] Failed to initialize:', error)
			throw error
		}
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
	async startNewApiRequest(): Promise<number> {
		return await this.indexManager.startNewApiRequest()
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
		
		// 使用策略模式分配对话索引
		const conversationIndex = this.conversationIndexStrategy.assignIndex(message)

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
		if (!provider) {
			console.warn('[MessageManager#addToClineMessages] Provider reference lost')
			return
		}
		
		provider.log(`[MessageManager#addToClineMessages] Adding message, type: ${message.type}, say: ${message.say}, current count: ${this.clineMessages.length}`)
		
		this.clineMessages.push(message)
		await this.saveClineMessages()
		
		provider.log(`[MessageManager#addToClineMessages] Message saved, new count: ${this.clineMessages.length}`)
		
		if (this.eventBus) {
			provider.log(`[MessageManager#addToClineMessages] Emitting TaskUserMessage event`)
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
		try {
			await this.executeWithRetry(
				async () => {
					const messagesWithIndex = this.conversationIndexStrategy.assignIndexesToMessages(this.apiConversationHistory)
					await saveApiMessages({ messages: messagesWithIndex, taskId: this.taskId, globalStoragePath: this.globalStoragePath })
				},
				"saveApiConversationHistory",
				3
			)
		} catch (error) {
			console.error(`[MessageManager#saveApiConversationHistory] Failed to save API conversation history:`, error)
			throw error
		}
	}

	async saveClineMessages(messages?: ClineMessage[]): Promise<void> {
		try {
			await this.executeWithRetry(
				async () => {
					if (messages) {
						this.clineMessages = messages
					}
					await saveTaskMessages({ messages: this.clineMessages, taskId: this.taskId, globalStoragePath: this.globalStoragePath })
				},
				"saveClineMessages",
				3
			)
		} catch (error) {
			console.error(`[MessageManager#saveClineMessages] Failed to save Cline messages:`, error)
			throw error
		}
		
		// Notify the task to update token usage
		if (this.task && typeof this.task.saveClineMessages === 'function') {
			try {
				await this.task.saveClineMessages()
			} catch (error) {
				console.error(`[MessageManager#saveClineMessages] Failed to notify task of message save:`, error)
			}
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

	private async executeWithRetry<T>(
		operation: () => Promise<T>,
		operationName: string,
		maxRetries: number = 3
	): Promise<T> {
		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				const provider = this.stateManager.getProvider()
				provider?.log(`[MessageManager#${operationName}] Attempt ${attempt + 1}/${maxRetries}`)
				const result = await operation()
				provider?.log(`[MessageManager#${operationName}] Operation completed successfully`)
				return result
			} catch (error) {
				const provider = this.stateManager.getProvider()
				provider?.log(`[MessageManager#${operationName}] Error on attempt ${attempt + 1}: ${error}`)
				
				const result = await this.errorHandler.handleError(
					error instanceof Error ? error : new Error(String(error)),
					{
						operation: operationName,
						taskId: this.taskId,
						timestamp: Date.now()
					}
				)

				if (attempt === maxRetries - 1 || !result.shouldRetry) {
					provider?.log(`[MessageManager#${operationName}] Max retries reached or no retry allowed, throwing error`)
					throw error
				}

				const delay = 1000 * (attempt + 1)
				provider?.log(`[MessageManager#${operationName}] Retrying after ${delay}ms`)
				await this.delay(delay)
			}
		}
		throw new Error(`Operation ${operationName} failed after ${maxRetries} attempts`)
	}

	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms))
	}
}
