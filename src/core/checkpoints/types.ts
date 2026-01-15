import type { ProviderSettings, ClineSay, ToolProgressStatus, ContextCondense, ContextTruncation } from "@roo-code/types"
import type { Anthropic } from "@anthropic-ai/sdk"

/**
 * 检查点类型枚举
 */
export enum CheckpointType {
  FILE_ONLY = "file_only",
  CONTEXT_ONLY = "context_only", 
  UNIFIED = "unified"
}

/**
 * 恢复类型枚举
 */
export enum RestoreType {
  FILES_ONLY = "files_only",
  CONTEXT_ONLY = "context_only",
  FILES_AND_CONTEXT = "files_and_context"
}

/**
 * 检查点恢复选项扩展，支持API上下文恢复
 * 现在基于对话索引而非时间戳
 */
export interface CheckpointRestoreOptionsExtended {
  ts: number // 保留向后兼容
  commitHash: string
  mode: "preview" | "restore"
  operation?: "delete" | "edit"
  restoreApiContext?: boolean
  restoreType?: RestoreType
  // 新增：对话索引，用于精确恢复LLM响应状态
  conversationIndex?: number
}

/**
 * 统一检查点选项
 */
export interface UnifiedCheckpointOptions {
  type: CheckpointType
  message: string
  saveFiles: boolean
  saveContext: boolean
  snapshotId?: string
  fileOptions?: FileCheckpointOptions
}

/**
 * 任务状态接口
 */
export interface TaskState {
  taskMode: string
  taskToolProtocol?: string
  systemPrompt: string
  conversationHistory: any[]
  trackedFiles: string[]
  // 可以根据需要添加更多状态字段
}

/**
 * 统一恢复选项
 */
export interface UnifiedRestoreOptions {
  restoreType: RestoreType
  checkpointId?: string
  snapshotId?: string
  targetTaskState?: Partial<TaskState>
}

/**
 * 文件检查点选项
 */
export interface FileCheckpointOptions {
  allowEmpty?: boolean
  suppressMessage?: boolean
  force?: boolean
}

/**
 * 文件恢复选项
 */
export interface FileRestoreOptions {
  preserveCurrentChanges?: boolean
  backupCurrentState?: boolean
}

/**
 * 统一检查点结果
 */
export interface UnifiedCheckpointResult {
  fileCheckpoint?: FileCheckpointResult
  contextSnapshot?: ContextSnapshotResult
}

/**
 * 文件检查点结果
 */
export interface FileCheckpointResult {
  id: string
  commitHash: string
  timestamp: number
  message: string
}

/**
 * 上下文快照结果
 */
export interface ContextSnapshotResult {
  id: string
  timestamp: number
  apiRequestId?: string
}

/**
 * API上下文管理器接口
 */
export interface ApiContextManager {
  getLatestApiRequestId(): string | undefined
  clearApiContextSnapshots(): Promise<void>
}