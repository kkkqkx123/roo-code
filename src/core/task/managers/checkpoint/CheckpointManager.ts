import type { CheckpointDiffOptions, CheckpointRestoreOptions } from "../../../checkpoints"
import {
	checkpointSave,
	checkpointRestore,
	checkpointDiff,
	getCheckpointService,
} from "../../../checkpoints"
import type { TaskStateManager } from "../core/TaskStateManager"
import type { MessageManager } from "../messaging/MessageManager"
import type { CheckpointRestoreOptionsExtended } from "../../../checkpoints/types"
import type { ApiMessage } from "../../../task-persistence"
import type { ToolProtocol } from "@roo-code/types"
import { GlobalFileNames } from "../../../../shared/globalFileNames"
import { getTaskDirectoryPath } from "../../../../utils/storage"
import { safeWriteJson } from "../../../../utils/safeWriteJson"
import { fileExistsAtPath } from "../../../../utils/fs"
import * as fs from "fs/promises"
import * as path from "path"

export interface CheckpointManagerOptions {
	stateManager: TaskStateManager
	messageManager: MessageManager
	taskId: string
	enableCheckpoints: boolean
	checkpointTimeout: number
	globalStoragePath: string
}

export class CheckpointManager {
	private stateManager: TaskStateManager
	private messageManager: MessageManager
	private taskId: string
	private globalStoragePath: string
	enableCheckpoints: boolean
	checkpointTimeout: number
	checkpointService?: any
	checkpointServiceInitializing = false
	private checkpointRequestIndexes: Map<string, number> = new Map() // 检查点关联的请求索引

	constructor(options: CheckpointManagerOptions) {
		this.stateManager = options.stateManager
		this.messageManager = options.messageManager
		this.taskId = options.taskId
		this.globalStoragePath = options.globalStoragePath
		this.enableCheckpoints = options.enableCheckpoints
		this.checkpointTimeout = options.checkpointTimeout
		
		// 从持久化存储加载检查点请求索引
		this.loadCheckpointRequestIndexes()
	}

	/**
	 * 从持久化存储加载检查点请求索引
	 */
	private async loadCheckpointRequestIndexes(): Promise<void> {
		try {
			const taskDir = await getTaskDirectoryPath(this.globalStoragePath, this.taskId)
			const filePath = path.join(taskDir, GlobalFileNames.checkpointRequestIndexes)
			const fileExists = await fileExistsAtPath(filePath)

			if (fileExists) {
				const fileContent = await fs.readFile(filePath, "utf8")
				if (fileContent.trim()) {
					const data = JSON.parse(fileContent)
					this.checkpointRequestIndexes = new Map(Object.entries(data))
					console.log(`[CheckpointManager] Loaded ${this.checkpointRequestIndexes.size} checkpoint request indexes`)
				}
			}
		} catch (error) {
			console.error("[CheckpointManager] Failed to load checkpoint request indexes:", error)
			// 不影响主流程，继续执行
		}
	}

	/**
	 * 保存检查点请求索引到持久化存储
	 */
	private async saveCheckpointRequestIndexes(): Promise<void> {
		try {
			const taskDir = await getTaskDirectoryPath(this.globalStoragePath, this.taskId)
			const filePath = path.join(taskDir, GlobalFileNames.checkpointRequestIndexes)
			const data = Object.fromEntries(this.checkpointRequestIndexes)
			await safeWriteJson(filePath, data)
		} catch (error) {
			console.error("[CheckpointManager] Failed to save checkpoint request indexes:", error)
			// 不影响主流程，继续执行
		}
	}

	/**
	 * 设置检查点关联的请求索引
	 */
	async setCheckpointRequestIndex(commitHash: string, requestIndex: number): Promise<void> {
		this.checkpointRequestIndexes.set(commitHash, requestIndex)
		console.log(`[CheckpointManager] Associated checkpoint ${commitHash} with request index ${requestIndex}`)
		// 异步保存到持久化存储
		this.saveCheckpointRequestIndexes().catch((error) => {
			console.error("[CheckpointManager] Failed to save checkpoint request indexes:", error)
		})
	}

	/**
	 * 保存检查点，返回检查点信息
	 */
	async checkpointSave(force: boolean = false, suppressMessage: boolean = false): Promise<{ commit?: string } | undefined> {
		if (!this.enableCheckpoints) {
			return undefined
		}

		try {
			const service = this.getService()
			if (!service) {
				return undefined
			}

			// 保存检查点
			const result = await service.saveCheckpoint(
				`Task: ${this.taskId}`,
				{ allowEmpty: force, suppressMessage }
			)

			if (result?.commit) {
				return { commit: result.commit }
			}
			
			return undefined
		} catch (error) {
			console.error("[CheckpointManager] Failed to save checkpoint:", error)
			return undefined
		}
	}

	async checkpointRestore(options: CheckpointRestoreOptions): Promise<void> {
		if (!this.enableCheckpoints) {
			return
		}

		try {
			await checkpointRestore(
				this.stateManager as any,
				options,
			)
		} catch (error) {
			console.error("[CheckpointManager] Failed to restore checkpoint:", error)
			throw error
		}
	}

	async checkpointDiff(options: CheckpointDiffOptions): Promise<void> {
		if (!this.enableCheckpoints) {
			return
		}

		try {
			await checkpointDiff(
				this.stateManager as any,
				options,
			)
		} catch (error) {
			console.error("[CheckpointManager] Failed to diff checkpoint:", error)
			throw error
		}
	}

	getService(): any {
		if (!this.checkpointService && !this.checkpointServiceInitializing) {
			this.checkpointServiceInitializing = true
			this.checkpointService = getCheckpointService(this.stateManager as any)
			this.checkpointServiceInitializing = false
		}
		return this.checkpointService
	}

	isEnabled(): boolean {
		return this.enableCheckpoints
	}

	getTimeout(): number {
		return this.checkpointTimeout
	}

	/**
	 * 创建检查点，关联请求索引
	 */
	async createCheckpoint(requestIndex: number): Promise<void> {
		try {
			// 保存检查点
			const result = await this.checkpointSave(false, true)
			
			if (result && result.commit && this.checkpointService) {
				// 存储检查点与请求索引的关联（会自动持久化）
				await this.setCheckpointRequestIndex(result.commit, requestIndex)
			}
		} catch (error) {
			console.error("[CheckpointManager] Failed to create checkpoint:", error)
			throw error
		}
	}

	/**
	 * 获取检查点关联的请求索引
	 */
	getCheckpointRequestIndex(commitHash: string): number | undefined {
		return this.checkpointRequestIndexes.get(commitHash)
	}

	/**
	 * 从持久化数据恢复上下文状态
	 * 根据请求索引找到对应的对话状态并恢复
	 */
	async restoreContextFromPersistedDataByRequestIndex(targetRequestIndex: number): Promise<boolean> {
		try {
			// 1. 获取持久化的API对话历史
			const fullHistory = await this.messageManager.getSavedApiConversationHistory()
			
			if (!fullHistory || fullHistory.length === 0) {
				console.warn(`[CheckpointManager] No persisted API conversation history found for task: ${this.taskId}`)
				return false
			}

			// 2. 找到目标请求索引的恢复点
			// 恢复到包含该请求索引的完整对话状态
			let restoreIndex = -1
			for (let i = fullHistory.length - 1; i >= 0; i--) {
				const message = fullHistory[i]
				if (message.role === "assistant" &&
					message.conversationIndex !== undefined &&
					message.conversationIndex <= targetRequestIndex) {
					restoreIndex = i
					break
				}
			}

			if (restoreIndex === -1) {
				console.warn(`[CheckpointManager] No suitable restore point found before request index ${targetRequestIndex}`)
				return false
			}

			// 3. 截取到恢复点的历史记录
			const restoredHistory = fullHistory.slice(0, restoreIndex + 1)
			
			// 4. 恢复到内存中
			await this.messageManager.overwriteApiConversationHistory(restoredHistory)
			
			// 5. 从对话历史中推断并恢复任务状态
			await this.restoreTaskStateFromHistory(restoredHistory)
			
			// 6. 设置当前请求索引为实际恢复到的索引（而非目标索引）
			const lastMessage = restoredHistory[restoredHistory.length - 1]
			const actualRequestIndex = lastMessage?.conversationIndex ?? targetRequestIndex
			this.messageManager.setCurrentRequestIndex(actualRequestIndex)
			
			console.log(`[CheckpointManager] Successfully restored context to request index ${actualRequestIndex} (target: ${targetRequestIndex})`)
			return true
			
		} catch (error) {
			console.error("[CheckpointManager] Context restoration failed:", error)
			return false
		}
	}

	/**
	 * 从持久化数据恢复上下文状态（向后兼容）
	 * 根据对话索引找到对应的对话状态并恢复
	 */
	async restoreContextFromPersistedDataByIndex(targetConversationIndex: number): Promise<boolean> {
		try {
			// 1. 获取持久化的API对话历史
			const fullHistory = await this.messageManager.getSavedApiConversationHistory()
			
			if (!fullHistory || fullHistory.length === 0) {
				console.warn(`[CheckpointManager] No persisted API conversation history found for task: ${this.taskId}`)
				return false
			}

			// 2. 找到目标对话索引的恢复点（找到最后一条不超过目标索引的助手消息）
			let restoreIndex = -1
			for (let i = fullHistory.length - 1; i >= 0; i--) {
				const message = fullHistory[i]
				if (message.role === "assistant" && message.conversationIndex !== undefined && message.conversationIndex <= targetConversationIndex) {
					restoreIndex = i
					break
				}
			}

			if (restoreIndex === -1) {
				console.warn(`[CheckpointManager] No suitable restore point found before conversation index ${targetConversationIndex}`)
				return false
			}

			// 3. 截取到恢复点的历史记录（包含完整的对话轮次）
			const restoredHistory = fullHistory.slice(0, restoreIndex + 1)
			
			// 4. 恢复到内存中
			await this.messageManager.overwriteApiConversationHistory(restoredHistory)
			
			// 5. 从对话历史中推断并恢复任务状态
			await this.restoreTaskStateFromHistory(restoredHistory)
			
			// 6. 设置当前请求索引（与 restoreContextFromPersistedDataByRequestIndex 保持一致）
			const lastMessage = restoredHistory[restoredHistory.length - 1]
			const actualRequestIndex = lastMessage?.conversationIndex ?? targetConversationIndex
			this.messageManager.setCurrentRequestIndex(actualRequestIndex)
			
			console.log(`[CheckpointManager] Successfully restored context from persisted data to conversation index ${actualRequestIndex} (target: ${targetConversationIndex})`)
			return true
		} catch (error) {
			console.error(`[CheckpointManager] Failed to restore context from persisted data:`, error)
			return false
		}
	}

	/**
	 * 从对话历史恢复任务状态
	 */
	private async restoreTaskStateFromHistory(history: ApiMessage[]): Promise<void> {
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
				const { systemPrompt, toolProtocol } = checkpointMessage.checkpointMetadata

				// 恢复工具协议
				if (toolProtocol && this.stateManager.setTaskToolProtocol) {
					this.stateManager.setTaskToolProtocol(toolProtocol as ToolProtocol)
					console.log(`[CheckpointManager] Restored tool protocol from checkpoint metadata: ${toolProtocol}`)
				}

				// 系统提示词由PromptManager动态生成，不需要手动恢复
				// 检查点元数据中的systemPrompt仅用于记录和调试
				if (systemPrompt) {
					console.log(`[CheckpointManager] Checkpoint metadata contains system prompt (length: ${systemPrompt.length})`)
				}

				return
			}

			// 3. 回退：从最近的助手消息中检测工具协议
			let detectedToolProtocol: string | undefined
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
			if (detectedToolProtocol && this.stateManager.setTaskToolProtocol) {
				this.stateManager.setTaskToolProtocol(detectedToolProtocol as ToolProtocol)
			}

			// 4. 系统提示词由PromptManager管理，不需要从对话历史恢复

			console.log(`[CheckpointManager] Restored task state from history: toolProtocol=${detectedToolProtocol}`)
		} catch (error) {
			console.error(`[CheckpointManager] Failed to restore task state from history:`, error)
			// 不影响主恢复流程，继续执行
		}
	}

	/**
	 * 扩展的检查点恢复方法，支持API上下文恢复
	 * 现在基于持久化数据而非内存快照
	 */
	async checkpointRestoreExtended(options: CheckpointRestoreOptionsExtended): Promise<void> {
		if (!this.enableCheckpoints) {
			return
		}

		try {
			// 首先执行标准的检查点恢复（文件系统）
			await checkpointRestore(
				this.stateManager as any,
				{
					ts: options.ts,
					commitHash: options.commitHash,
					mode: options.mode,
					operation: options.operation,
				},
			)

			// 如果需要恢复API上下文
			if (options.restoreApiContext) {
				// 从检查点获取请求索引
				const requestIndex = this.getCheckpointRequestIndex(options.commitHash)
				
				if (requestIndex !== undefined) {
					// 基于请求索引恢复上下文
					const success = await this.restoreContextFromPersistedDataByRequestIndex(requestIndex)
					if (!success) {
						console.warn(`[CheckpointManager] Context restoration failed for request index ${requestIndex}, but file restoration succeeded`)
					}
				} else if (options.conversationIndex !== undefined) {
					// 回退到旧的对话索引（向后兼容）
					const success = await this.restoreContextFromPersistedDataByIndex(options.conversationIndex)
					if (!success) {
						console.warn(`[CheckpointManager] Context restoration failed for conversation index ${options.conversationIndex}, but file restoration succeeded`)
					}
				} else {
					console.warn(`[CheckpointManager] No request index found for checkpoint ${options.commitHash}, skipping context restoration`)
				}
			}
		} catch (error) {
			console.error("[CheckpointManager] Failed to restore checkpoint with context:", error)
			throw error
		}
	}
}
