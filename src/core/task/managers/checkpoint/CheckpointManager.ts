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

	constructor(options: CheckpointManagerOptions) {
		this.stateManager = options.stateManager
		this.messageManager = options.messageManager
		this.taskId = options.taskId
		this.globalStoragePath = options.globalStoragePath
		this.enableCheckpoints = options.enableCheckpoints
		this.checkpointTimeout = options.checkpointTimeout
		this.indexManager = options.indexManager
		this.contextRestoreService = new ContextRestoreService()
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
		return this.contextRestoreService.restoreContext({
			targetIndex: targetRequestIndex,
			indexType: "request",
			messageManager: this.messageManager,
			stateManager: this.stateManager,
		})
	}

	/**
	 * 从持久化数据恢复上下文状态（向后兼容）
	 * 根据对话索引找到对应的对话状态并恢复
	 */
	async restoreContextFromPersistedDataByIndex(targetConversationIndex: number): Promise<boolean> {
		return this.contextRestoreService.restoreContext({
			targetIndex: targetConversationIndex,
			indexType: "conversation",
			messageManager: this.messageManager,
			stateManager: this.stateManager,
		})
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