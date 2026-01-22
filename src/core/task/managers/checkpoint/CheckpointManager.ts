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
import { IndexManager } from "../core/IndexManager"
import { ContextRestoreService } from "../core/ContextRestoreService"
import { ErrorHandler } from "../../../error/ErrorHandler"

export interface CheckpointManagerOptions {
	stateManager: TaskStateManager
	messageManager: MessageManager
	taskId: string
	enableCheckpoints: boolean
	checkpointTimeout: number
	globalStoragePath: string
	indexManager: IndexManager
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
	private indexManager: IndexManager
	private contextRestoreService: ContextRestoreService
	private errorHandler: ErrorHandler

	constructor(options: CheckpointManagerOptions) {
		this.stateManager = options.stateManager
		this.messageManager = options.messageManager
		this.taskId = options.taskId
		this.globalStoragePath = options.globalStoragePath
		this.enableCheckpoints = options.enableCheckpoints
		this.checkpointTimeout = options.checkpointTimeout
		this.indexManager = options.indexManager
		this.contextRestoreService = new ContextRestoreService()
		this.errorHandler = new ErrorHandler()
	}

	/**
	 * 保存检查点，返回检查点信息
	 */
	async checkpointSave(force: boolean = false, suppressMessage: boolean = false): Promise<{ commit?: string } | undefined> {
		if (!this.enableCheckpoints) {
			return undefined
		}

		try {
			const result = await this.executeWithRetry(
				async () => {
					const service = this.getService()
					if (!service) {
						throw new Error("Checkpoint service not available")
					}

					return await service.saveCheckpoint(
						`Task: ${this.taskId}`,
						{ allowEmpty: force, suppressMessage }
					)
				},
				"checkpointSave",
				3
			)

			if (result?.commit) {
				return { commit: result.commit }
			}
			
			return undefined
		} catch (error) {
			console.error("[CheckpointManager] Failed to save checkpoint:", error)
			throw error
		}
	}

	async checkpointRestore(options: CheckpointRestoreOptions): Promise<void> {
		if (!this.enableCheckpoints) {
			return
		}

		try {
			await this.executeWithRetry(
				async () => await checkpointRestore(
					this.stateManager as any,
					options,
				),
				"checkpointRestore",
				3
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
			await this.executeWithRetry(
				async () => await checkpointDiff(
					this.stateManager as any,
					options,
				),
				"checkpointDiff",
				3
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
				// 使用 IndexManager 存储检查点与请求索引的关联
				await this.indexManager.associateCheckpointWithRequest(result.commit, requestIndex)
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
		return this.indexManager.getCheckpointRequestIndex(commitHash)
	}

	/**
	 * 从持久化数据恢复上下文状态
	 * 根据请求索引找到对应的对话状态并恢复
	 */
	async restoreContextFromPersistedDataByRequestIndex(targetRequestIndex: number): Promise<boolean> {
		const result = await this.contextRestoreService.restoreContext({
			targetIndex: targetRequestIndex,
			indexType: "request",
			messageManager: this.messageManager,
			stateManager: this.stateManager,
		})
		return result.success
	}

	/**
	 * 从持久化数据恢复上下文状态（向后兼容）
	 * 根据对话索引找到对应的对话状态并恢复
	 */
	async restoreContextFromPersistedDataByIndex(targetConversationIndex: number): Promise<boolean> {
		const result = await this.contextRestoreService.restoreContext({
			targetIndex: targetConversationIndex,
			indexType: "conversation",
			messageManager: this.messageManager,
			stateManager: this.stateManager,
		})
		return result.success
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
			await this.executeWithRetry(
				async () => {
					await checkpointRestore(
						this.stateManager as any,
						{
							ts: options.ts,
							commitHash: options.commitHash,
							mode: options.mode,
							operation: options.operation,
						},
					)

					if (options.restoreApiContext) {
						const requestIndex = this.getCheckpointRequestIndex(options.commitHash)
						
						if (requestIndex !== undefined) {
							const success = await this.restoreContextFromPersistedDataByRequestIndex(requestIndex)
							if (!success) {
								console.warn(`[CheckpointManager] Context restoration failed for request index ${requestIndex}, but file restoration succeeded`)
							}
						} else if (options.conversationIndex !== undefined) {
							const success = await this.restoreContextFromPersistedDataByIndex(options.conversationIndex)
							if (!success) {
								console.warn(`[CheckpointManager] Context restoration failed for conversation index ${options.conversationIndex}, but file restoration succeeded`)
							}
						} else {
							console.warn(`[CheckpointManager] No request index found for checkpoint ${options.commitHash}, skipping context restoration`)
						}
					}
				},
				"checkpointRestoreExtended",
				3
			)
		} catch (error) {
			console.error("[CheckpointManager] Failed to restore checkpoint with context:", error)
			throw error
		}
	}

	private async executeWithRetry<T>(
		operation: () => Promise<T>,
		operationName: string,
		maxRetries: number = 3
	): Promise<T> {
		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				console.log(`[CheckpointManager#${operationName}] Attempt ${attempt + 1}/${maxRetries}`)
				const result = await operation()
				console.log(`[CheckpointManager#${operationName}] Operation completed successfully`)
				return result
			} catch (error) {
				console.error(`[CheckpointManager#${operationName}] Error on attempt ${attempt + 1}: ${error}`)
				
				const result = await this.errorHandler.handleError(
					error instanceof Error ? error : new Error(String(error)),
					{
						operation: operationName,
						taskId: this.taskId,
						timestamp: Date.now()
					}
				)

				if (attempt === maxRetries - 1 || !result.shouldRetry) {
					console.log(`[CheckpointManager#${operationName}] Max retries reached or no retry allowed, throwing error`)
					throw error
				}

				const delay = 1000 * (attempt + 1)
				console.log(`[CheckpointManager#${operationName}] Retrying after ${delay}ms`)
				await this.delay(delay)
			}
		}
		throw new Error(`Operation ${operationName} failed after ${maxRetries} attempts`)
	}

	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms))
	}
}