import type { ApiMessage } from "../../../task-persistence"
import type { IndexManager } from "../core/IndexManager"

/**
 * 对话索引分配策略
 * 
 * 职责：
 * - 为不同类型的消息分配对话索引
 * - 确保索引分配的一致性和可预测性
 * - 处理异常情况（如助手消息没有当前请求索引）
 */
export class ConversationIndexStrategy {
	constructor(private indexManager: IndexManager) {}

	/**
	 * 为消息分配对话索引
	 * 
	 * 策略：
	 * - 用户消息：分配新的对话索引
	 * - 助手消息：继承当前请求索引，如果没有则分配新索引
	 * - 其他消息：不分配索引
	 * 
	 * @param message 要分配索引的消息
	 * @returns 分配的对话索引，如果不需要分配则返回 undefined
	 */
	assignIndex(message: ApiMessage): number | undefined {
		if (message.role === "assistant") {
			return this.assignAssistantMessageIndex()
		} else if (message.role === "user") {
			return this.assignUserMessageIndex()
		}
		return undefined
	}

	/**
	 * 为助手消息分配索引
	 * 
	 * 策略：
	 * - 优先继承当前请求索引
	 * - 如果没有当前请求索引，分配新索引并记录警告
	 * 
	 * @returns 分配的对话索引
	 */
	private assignAssistantMessageIndex(): number {
		const currentIndex = this.indexManager.getCurrentRequestIndex()

		if (currentIndex !== undefined) {
			return currentIndex
		}

		// 异常情况：助手消息没有当前请求索引
		const newIndex = this.indexManager.getConversationIndexCounter()
		this.indexManager.setConversationIndexCounter(newIndex + 1)
		console.warn(`[ConversationIndexStrategy] Assistant message without active request, assigned new index: ${newIndex}`)
		return newIndex
	}

	/**
	 * 为用户消息分配索引
	 * 
	 * 策略：
	 * - 总是分配新的对话索引
	 * 
	 * @returns 分配的对话索引
	 */
	private assignUserMessageIndex(): number {
		const index = this.indexManager.getConversationIndexCounter()
		this.indexManager.setConversationIndexCounter(index + 1)
		return index
	}

	/**
	 * 为批量消息分配索引
	 * 
	 * @param messages 要分配索引的消息数组
	 * @returns 带有索引的消息数组
	 */
	assignIndexesToMessages(messages: ApiMessage[]): ApiMessage[] {
		return messages.map((msg) => {
			if (msg.conversationIndex === undefined) {
				const index = this.assignIndex(msg)
				if (index !== undefined) {
					return {
						...msg,
						conversationIndex: index,
					}
				}
			}
			return msg
		})
	}
}