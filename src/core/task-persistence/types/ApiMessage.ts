import type { Anthropic } from "@anthropic-ai/sdk"

/**
 * 推理摘要项
 */
export interface ReasoningSummary {
	type: string
	content: string
	timestamp: number
}

/**
 * 检查点元数据，用于保存完整上下文
 */
export interface CheckpointMetadata {
	isCheckpoint: boolean
	requestIndex?: number
	checkpointHash?: string
	toolProtocol?: string
	contextTokens?: number
}

/**
 * API 消息类型
 * 扩展 Anthropic.MessageParam 以支持额外的元数据
 */
export interface ApiMessage extends Anthropic.MessageParam {
	/** 消息时间戳 */
	ts?: number
	/** 是否为摘要消息 */
	isSummary?: boolean
	/** 消息唯一标识符 */
	id?: string
	/** 消息类型标识（用于推理项） */
	type?: "reasoning"
	/** 推理摘要数组 */
	summary?: ReasoningSummary[]
	/** 加密内容 */
	encrypted_content?: string
	/** 文本内容 */
	text?: string
	/** OpenRouter reasoning_details 数组格式（用于 Gemini 3 等） */
	reasoning_details?: any[]
	/** 非破坏性压缩：摘要消息的唯一标识符 */
	condenseId?: string
	/** 非破坏性压缩：指向替换此消息的摘要的 condenseId */
	/** 带有 condenseParent 的消息在发送到 API 时会被过滤（如果摘要存在） */
	condenseParent?: string
	/** 非破坏性截断：截断标记消息的唯一标识符 */
	truncationId?: string
	/** 非破坏性截断：指向隐藏此消息的标记的 truncationId */
	/** 对话索引，用于检查点恢复 */
	conversationIndex?: number
	/** 带有 truncationParent 的消息在发送到 API 时会被过滤（如果标记存在） */
	truncationParent?: string
	/** 标识消息为截断边界标记 */
	isTruncationMarker?: boolean
	/** 检查点元数据，用于保存完整上下文 */
	checkpointMetadata?: CheckpointMetadata
}

/**
 * 读取 API 消息的选项
 */
export interface ReadApiMessagesOptions {
	/** 任务 ID */
	taskId: string
	/** 全局存储路径 */
	globalStoragePath: string
}

/**
 * 保存 API 消息的选项
 */
export interface SaveApiMessagesOptions {
	/** 要保存的消息数组 */
	messages: ApiMessage[]
	/** 任务 ID */
	taskId: string
	/** 全局存储路径 */
	globalStoragePath: string
}