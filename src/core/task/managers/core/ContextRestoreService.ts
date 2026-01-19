import type { ApiMessage } from "../../../task-persistence"
import type { MessageManager } from "../messaging/MessageManager"
import type { TaskStateManager } from "./TaskStateManager"
import type { ToolProtocol } from "@shared/types"

export interface ContextRestoreOptions {
	targetIndex: number
	indexType: "request" | "conversation"
	messageManager: MessageManager
	stateManager: TaskStateManager
}

export interface RestoreResult {
	success: boolean
	reason?: string
	restoredIndex?: number
	error?: unknown
}

/**
 * 上下文恢复服务
 * 
 * 职责：
 * - 统一上下文恢复逻辑
 * - 支持基于请求索引和对话索引的恢复
 * - 从对话历史恢复任务状态
 * - 消除重复的恢复代码
 */
export class ContextRestoreService {
	/**
	 * 统一的上下文恢复方法
	 * 
	 * @param options 恢复选项
	 * @returns 是否恢复成功
	 */
	async restoreContext(options: ContextRestoreOptions): Promise<RestoreResult> {
		const { targetIndex, indexType, messageManager, stateManager } = options

		try {
			// 1. 获取持久化的API对话历史
			const fullHistory = await messageManager.getSavedApiConversationHistory()

			if (!fullHistory || fullHistory.length === 0) {
				console.warn(`[ContextRestoreService] No persisted API conversation history found`)
				return { success: false, reason: 'NO_HISTORY' }
			}

			// 2. 根据索引类型找到恢复点
			const restoreIndex = this.findRestoreIndex(fullHistory, targetIndex, indexType)

			if (restoreIndex === -1) {
				console.warn(
					`[ContextRestoreService] No suitable restore point found before ${indexType} index ${targetIndex}`,
				)
				return { success: false, reason: 'NO_RESTORE_POINT' }
			}

			// 3. 截取到恢复点的历史记录
			const restoredHistory = fullHistory.slice(0, restoreIndex + 1)

			// 4. 恢复到内存中
			await messageManager.overwriteApiConversationHistory(restoredHistory)

			// 5. 从对话历史中推断并恢复任务状态
			await this.restoreTaskStateFromHistory(restoredHistory, stateManager)

			// 6. 设置当前请求索引
			const lastMessage = restoredHistory[restoredHistory.length - 1]
			const actualRequestIndex = lastMessage?.conversationIndex ?? targetIndex
			messageManager.setCurrentRequestIndex(actualRequestIndex)

			console.log(
				`[ContextRestoreService] Successfully restored context to ${indexType} index ${actualRequestIndex} (target: ${targetIndex})`,
			)
			return { success: true, restoredIndex: actualRequestIndex }
		} catch (error) {
			console.error("[ContextRestoreService] Context restoration failed:", error)
			return { success: false, reason: 'RESTORATION_FAILED', error }
		}
	}

	/**
	 * 找到恢复点索引
	 * 
	 * @param history 完整的对话历史
	 * @param targetIndex 目标索引
	 * @param indexType 索引类型
	 * @returns 恢复点索引，-1表示未找到
	 */
	private findRestoreIndex(
		history: ApiMessage[],
		targetIndex: number,
		indexType: "request" | "conversation",
	): number {
		// 改进的恢复点查找：考虑多种消息类型
		for (let i = history.length - 1; i >= 0; i--) {
			const message = history[i]
			
			// 优先查找检查点消息
			if (message.checkpointMetadata?.isCheckpoint &&
				message.conversationIndex !== undefined &&
				message.conversationIndex <= targetIndex) {
				return i
			}
			
			// 其次查找助手消息
			if (
				message.role === "assistant" &&
				message.conversationIndex !== undefined &&
				message.conversationIndex <= targetIndex
			) {
				return i
			}
			
			// 对于请求索引类型，也考虑用户消息
			if (indexType === "request" &&
				message.role === "user" &&
				message.conversationIndex !== undefined &&
				message.conversationIndex <= targetIndex) {
				return i
			}
		}
		return -1
	}

	/**
	 * 从对话历史恢复任务状态
	 * 
	 * @param history 对话历史
	 * @param stateManager 任务状态管理器
	 */
	private async restoreTaskStateFromHistory(
		history: ApiMessage[],
		stateManager: TaskStateManager,
	): Promise<void> {
		try {
			// 1. 首先查找检查点消息（包含完整上下文）
			let checkpointMessage: ApiMessage | undefined
			for (let i = history.length - 1; i >= 0; i--) {
				const message = history[i]
				if (message.checkpointMetadata?.isCheckpoint) {
					checkpointMessage = message
					break
				}
			}

			// 2. 如果找到检查点消息，从中恢复完整上下文
			if (checkpointMessage && checkpointMessage.checkpointMetadata) {
				const { toolProtocol } = checkpointMessage.checkpointMetadata

				// 恢复工具协议 - 使用类型保护
				if (toolProtocol && this.isValidToolProtocol(toolProtocol) && stateManager.setTaskToolProtocol) {
					stateManager.setTaskToolProtocol(toolProtocol)
					console.log(`[ContextRestoreService] Restored tool protocol from checkpoint metadata: ${toolProtocol}`)
				}

				// 系统提示词由PromptManager动态生成，不需要手动恢复

				return
			}

			// 3. 回退：从最近的助手消息中检测工具协议
			let detectedToolProtocol: ToolProtocol | undefined
			for (let i = history.length - 1; i >= 0; i--) {
				const message = history[i]
				if (message.role === "assistant" && Array.isArray(message.content)) {
					// 检查是否包含工具使用块来判断协议类型
					const hasToolUse = message.content.some((block: any) => block.type === "tool_use")
					if (hasToolUse) {
						detectedToolProtocol = "native"
						break
					}
				}
			}

			// 恢复检测到的工具协议
			if (detectedToolProtocol && stateManager.setTaskToolProtocol) {
				stateManager.setTaskToolProtocol(detectedToolProtocol)
			}

			// 4. 系统提示词由PromptManager管理，不需要从对话历史恢复

			console.log(`[ContextRestoreService] Restored task state from history: toolProtocol=${detectedToolProtocol}`)
		} catch (error) {
			console.error(`[ContextRestoreService] Failed to restore task state from history:`, error)
			// 不影响主恢复流程，继续执行
		}
	}

	/**
		* 验证工具协议类型
		*/
	private isValidToolProtocol(protocol: string): protocol is ToolProtocol {
		return protocol === "native" || protocol === "xml"
	}
}