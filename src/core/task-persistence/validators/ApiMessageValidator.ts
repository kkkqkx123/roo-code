import type { ApiMessage } from "../types/ApiMessage"
import { ApiMessageValidationError } from "../errors/ApiMessageErrors"

/**
 * 验证单个 API 消息
 * @param message - 要验证的消息
 * @returns 如果消息有效返回 true，否则返回 false
 */
export function isValidApiMessage(message: unknown): message is ApiMessage {
	if (!message || typeof message !== "object") {
		return false
	}

	const msg = message as Partial<ApiMessage>

	// 检查必需字段
	if (!msg.role) {
		return false
	}

	// 验证 role 字段
	if (msg.role !== "user" && msg.role !== "assistant" && msg.role !== "system") {
		return false
	}

	// 验证 content 字段
	if (msg.content === undefined) {
		return false
	}

	// 如果 content 是数组，验证每个元素
	if (Array.isArray(msg.content)) {
		for (const block of msg.content) {
			if (!block || typeof block !== "object") {
				return false
			}
			if (!block.type) {
				return false
			}
		}
	}

	// 验证可选字段的类型
	if (msg.ts !== undefined && typeof msg.ts !== "number") {
		return false
	}

	if (msg.id !== undefined && typeof msg.id !== "string") {
		return false
	}

	if (msg.isSummary !== undefined && typeof msg.isSummary !== "boolean") {
		return false
	}

	if (msg.conversationIndex !== undefined && typeof msg.conversationIndex !== "number") {
		return false
	}

	// 验证 reasoning 类型
	if (msg.type === "reasoning") {
		if (!msg.encrypted_content || typeof msg.encrypted_content !== "string") {
			return false
		}
	}

	return true
}

/**
 * 验证 API 消息数组
 * @param messages - 要验证的消息数组
 * @returns 如果所有消息都有效返回 true，否则返回 false
 */
export function isValidApiMessageArray(messages: unknown): messages is ApiMessage[] {
	if (!Array.isArray(messages)) {
		return false
	}

	return messages.every((msg) => isValidApiMessage(msg))
}

/**
 * 验证 API 消息并抛出错误
 * @param message - 要验证的消息
 * @throws {ApiMessageValidationError} 如果消息无效
 */
export function validateApiMessage(message: unknown): asserts message is ApiMessage {
	if (!isValidApiMessage(message)) {
		throw new ApiMessageValidationError("Invalid API message structure", [message])
	}
}

/**
 * 验证 API 消息数组并抛出错误
 * @param messages - 要验证的消息数组
 * @throws {ApiMessageValidationError} 如果消息数组无效
 */
export function validateApiMessageArray(messages: unknown): asserts messages is ApiMessage[] {
	if (!Array.isArray(messages)) {
		throw new ApiMessageValidationError("Messages must be an array")
	}

	const invalidMessages: any[] = []
	for (let i = 0; i < messages.length; i++) {
		if (!isValidApiMessage(messages[i])) {
			invalidMessages.push({ index: i, message: messages[i] })
		}
	}

	if (invalidMessages.length > 0) {
		throw new ApiMessageValidationError(
			`Found ${invalidMessages.length} invalid message(s)`,
			invalidMessages,
		)
	}
}

/**
 * 清理和规范化 API 消息
 * 移除无效字段，确保数据一致性
 * @param message - 要清理的消息
 * @returns 清理后的消息
 */
export function sanitizeApiMessage(message: ApiMessage): ApiMessage {
	const sanitized: ApiMessage = { ...message }

	// 确保 role 是有效的，如果无效则设置为默认值
	if (sanitized.role !== "user" && sanitized.role !== "assistant") {
		sanitized.role = "user"
	}

	// 确保 content 存在
	if (sanitized.content === undefined) {
		sanitized.content = ""
	}

	// 清理无效的 content 块
	if (Array.isArray(sanitized.content)) {
		sanitized.content = sanitized.content.filter((block) => {
			return block && typeof block === "object" && block.type
		})
	}

	// 确保 ts 是有效的数字
	if (sanitized.ts !== undefined && (typeof sanitized.ts !== "number" || isNaN(sanitized.ts))) {
		delete sanitized.ts
	}

	// 确保 conversationIndex 是有效的数字
	if (sanitized.conversationIndex !== undefined && (typeof sanitized.conversationIndex !== "number" || isNaN(sanitized.conversationIndex))) {
		delete sanitized.conversationIndex
	}

	return sanitized
}

/**
 * 清理和规范化 API 消息数组
 * @param messages - 要清理的消息数组
 * @returns 清理后的消息数组
 */
export function sanitizeApiMessageArray(messages: ApiMessage[]): ApiMessage[] {
	return messages.map((msg) => sanitizeApiMessage(msg))
}