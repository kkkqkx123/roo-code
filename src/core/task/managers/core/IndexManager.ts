import { safeWriteJson } from "../../../../utils/safeWriteJson"
import { GlobalFileNames } from "../../../../shared/globalFileNames"
import { getTaskDirectoryPath } from "../../../../utils/storage"
import { fileExistsAtPath } from "../../../../utils/fs"
import * as path from "path"
import * as fs from "fs/promises"

export interface IndexManagerOptions {
	taskId: string
	globalStoragePath: string
}

/**
 * 统一索引管理器
 * 
 * 职责：
 * - 管理对话索引计数器
 * - 管理当前请求索引
 * - 管理检查点与请求索引的映射
 * - 持久化索引数据
 */
export class IndexManager {
	readonly taskId: string
	readonly globalStoragePath: string

	private conversationIndexCounter: number = 0
	private currentRequestIndex: number | undefined
	private checkpointRequestIndexes: Map<string, number> = new Map()
	private initialized: boolean = false
	private initializationPromise: Promise<void> | null = null

	constructor(options: IndexManagerOptions) {
		this.taskId = options.taskId
		this.globalStoragePath = options.globalStoragePath
	}

	/**
	 * 异步初始化方法，必须在构造后调用
	 */
	async initialize(): Promise<void> {
		if (this.initializationPromise) {
			return this.initializationPromise
		}

		this.initializationPromise = (async () => {
			try {
				await this.loadIndexes()
				this.initialized = true
				console.log(`[IndexManager] Initialized for task ${this.taskId}`)
			} catch (error) {
				console.error("[IndexManager] Initialization failed:", error)
				throw error
			}
		})()

		return this.initializationPromise
	}

	/**
	 * 等待初始化完成
	 */
	async waitForInitialization(): Promise<void> {
		if (this.initializationPromise) {
			await this.initializationPromise
		} else {
			throw new Error("IndexManager not initialized. Call initialize() first.")
		}
	}

	/**
	 * 开始新的API请求，分配请求索引
	 */
	async startNewApiRequest(): Promise<number> {
		await this.waitForInitialization()
		
		const requestIndex = this.conversationIndexCounter++
		this.currentRequestIndex = requestIndex
		console.log(`[IndexManager] Started new API request with index: ${requestIndex}`)
		return requestIndex
	}

	/**
	 * 获取当前请求索引
	 */
	getCurrentRequestIndex(): number | undefined {
		return this.currentRequestIndex
	}

	/**
	 * 设置当前请求索引
	 */
	setCurrentRequestIndex(index: number): void {
		this.currentRequestIndex = index
	}

	/**
	 * 结束当前API请求
	 */
	endCurrentApiRequest(): void {
		this.currentRequestIndex = undefined
	}

	/**
	 * 获取对话索引计数器
	 */
	getConversationIndexCounter(): number {
		return this.conversationIndexCounter
	}

	/**
	 * 设置对话索引计数器
	 */
	setConversationIndexCounter(counter: number): void {
		this.conversationIndexCounter = counter
	}

	/**
	 * 关联检查点和请求索引
	 */
	async associateCheckpointWithRequest(commitHash: string, requestIndex: number): Promise<void> {
		await this.waitForInitialization()
		
		this.checkpointRequestIndexes.set(commitHash, requestIndex)
		console.log(`[IndexManager] Associated checkpoint ${commitHash} with request index ${requestIndex}`)
		
		// 立即持久化以确保数据一致性
		try {
			await this.persistCheckpointIndexes()
		} catch (error) {
			console.error("[IndexManager] Failed to persist checkpoint indexes:", error)
			// 回滚内存中的更改
			this.checkpointRequestIndexes.delete(commitHash)
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
	 * 获取所有检查点索引映射
	 */
	getAllCheckpointIndexes(): Map<string, number> {
		return new Map(this.checkpointRequestIndexes)
	}

	/**
	 * 从持久化存储加载索引
	 */
	private async loadIndexes(): Promise<void> {
		try {
			// 加载检查点请求索引映射
			const taskDir = await getTaskDirectoryPath(this.globalStoragePath, this.taskId)
			const filePath = path.join(taskDir, GlobalFileNames.checkpointRequestIndexes)
			const fileExists = await fileExistsAtPath(filePath)

			if (fileExists) {
				const fileContent = await fs.readFile(filePath, "utf8")
				if (fileContent.trim()) {
					const data = JSON.parse(fileContent)
					this.checkpointRequestIndexes = new Map(Object.entries(data))
					console.log(`[IndexManager] Loaded ${this.checkpointRequestIndexes.size} checkpoint request indexes`)
				}
			}
		} catch (error) {
			console.error("[IndexManager] Failed to load indexes:", error)
			// 不影响主流程，继续执行
		}
	}

	/**
	 * 持久化检查点索引映射
	 */
	private async persistCheckpointIndexes(): Promise<void> {
		try {
			const taskDir = await getTaskDirectoryPath(this.globalStoragePath, this.taskId)
			const filePath = path.join(taskDir, GlobalFileNames.checkpointRequestIndexes)
			const data = Object.fromEntries(this.checkpointRequestIndexes)
			await safeWriteJson(filePath, data)
		} catch (error) {
			console.error("[IndexManager] Failed to persist checkpoint indexes:", error)
			// 不影响主流程，继续执行
		}
	}

	/**
	 * 清理资源
	 */
	async dispose(): Promise<void> {
		try {
			// 确保所有待处理的持久化操作完成
			if (this.initializationPromise) {
				await this.initializationPromise
			}
			
			// 清理状态
			this.conversationIndexCounter = 0
			this.currentRequestIndex = undefined
			this.checkpointRequestIndexes.clear()
			this.initialized = false
			this.initializationPromise = null
			
			console.log(`[IndexManager] Disposed for task ${this.taskId}`)
		} catch (error) {
			console.error("[IndexManager] Dispose failed:", error)
		}
	}
}