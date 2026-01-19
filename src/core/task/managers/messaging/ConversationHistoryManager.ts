import type Anthropic from "@anthropic-ai/sdk"
import type { ApiMessage } from "../../../task-persistence"

export interface ConversationHistoryManagerOptions {
	taskId: string
}

// 定义扩展的消息类型
interface ReasoningDetail {
	type: string
	reasoning?: string
	signature?: string
	[key: string]: unknown
}

interface ExtendedMessageParam extends Anthropic.Messages.MessageParam {
	reasoning_details?: ReasoningDetail[]
}

interface ReasoningMessageParam {
	type: "reasoning"
	encrypted_content: string
	id?: string
	summary?: Array<{ type: string; content: string }>
}

// 使用联合类型
type CleanMessageParam = ExtendedMessageParam | ReasoningMessageParam

export class ConversationHistoryManager {
	readonly taskId: string

	constructor(options: ConversationHistoryManagerOptions) {
		this.taskId = options.taskId
	}

	public buildCleanConversationHistory(
		messages: ApiMessage[],
	): CleanMessageParam[] {
		if (!Array.isArray(messages)) {
			throw new Error('[ConversationHistoryManager] messages must be an array')
		}

		const cleanConversationHistory: CleanMessageParam[] = []

		for (const msg of messages) {
			if (!msg || typeof msg !== 'object') {
				console.warn('[ConversationHistoryManager] Invalid message, skipping:', msg)
				continue
			}

			try {
				const cleaned = this.cleanMessage(msg)
				if (cleaned) {
					cleanConversationHistory.push(cleaned)
				}
			} catch (error) {
				console.error('[ConversationHistoryManager] Error cleaning message:', error)
				continue
			}
		}

		return cleanConversationHistory
	}

	private cleanMessage(msg: ApiMessage): CleanMessageParam | null {
		if (msg.type === "reasoning") {
			return this.cleanReasoningMessage(msg)
		}
		
		if (msg.role === "assistant") {
			return this.processAssistantMessage(msg)
		}
		
		if (msg.role) {
			return msg as ExtendedMessageParam
		}
		
		return null
	}

	private processAssistantMessage(msg: ApiMessage): ExtendedMessageParam | null {
		const rawContent = msg.content
		const contentArray = this.normalizeContent(rawContent)
		const [first, ...rest] = contentArray

		// 处理 reasoning_details
		if (this.hasReasoningDetails(msg)) {
			return this.buildMessageWithReasoningDetails(msg, contentArray)
		}

		// 处理加密推理
		if (this.hasEncryptedReasoning(first)) {
			return {
				role: "assistant",
				content: rest.length === 0 ? "" : rest,
			}
		}

		// 处理思考块
		if (this.hasThinkingBlock(first)) {
			return {
				role: "assistant",
				content: rest.length === 0 ? "" : rest,
			}
		}

		return msg as ExtendedMessageParam
	}

	private normalizeContent(rawContent: any): Anthropic.Messages.ContentBlockParam[] {
		if (Array.isArray(rawContent)) {
			return rawContent as Anthropic.Messages.ContentBlockParam[]
		}
		if (rawContent !== undefined) {
			return [{
				type: "text",
				text: rawContent
			} satisfies Anthropic.Messages.TextBlockParam]
		}
		return []
	}

	private hasReasoningDetails(msg: ApiMessage): boolean {
		const msgWithDetails = msg as ApiMessage & { reasoning_details?: ReasoningDetail[] }
		return msgWithDetails.reasoning_details !== undefined && Array.isArray(msgWithDetails.reasoning_details)
	}

	private hasEncryptedReasoning(first: Anthropic.Messages.ContentBlockParam | undefined): boolean {
		if (!first) return false
		const block = first as { type?: string; encrypted_content?: string }
		return block.type === "reasoning" && typeof block.encrypted_content === "string"
	}

	private hasThinkingBlock(first: Anthropic.Messages.ContentBlockParam | undefined): boolean {
		if (!first) return false
		const block = first as { type?: string; thinking?: string }
		return block.type === "thinking" && typeof block.thinking === "string"
	}

	private buildMessageWithReasoningDetails(
		msg: ApiMessage,
		contentArray: Anthropic.Messages.ContentBlockParam[]
	): ExtendedMessageParam {
		const msgWithDetails = msg as ApiMessage & { reasoning_details?: ReasoningDetail[] }
		let assistantContent: Anthropic.Messages.MessageParam["content"]

		if (contentArray.length === 0) {
			assistantContent = ""
		} else if (contentArray.length === 1 && contentArray[0].type === "text") {
			assistantContent = (contentArray[0] as Anthropic.Messages.TextBlockParam).text
		} else {
			assistantContent = contentArray
		}

		return {
			role: "assistant",
			content: assistantContent,
			...(msgWithDetails.reasoning_details ? { reasoning_details: msgWithDetails.reasoning_details } : {}),
		}
	}

	public cleanAssistantMessage(msg: ApiMessage): ExtendedMessageParam | null {
		if (msg.role !== "assistant") {
			return null
		}

		return this.processAssistantMessage(msg)
	}

	public cleanReasoningMessage(msg: ApiMessage): ReasoningMessageParam | null {
		if (msg.type !== "reasoning") {
			return null
		}

		if (!msg.encrypted_content) {
			return null
		}

		return {
			type: "reasoning",
			summary: msg.summary,
			encrypted_content: msg.encrypted_content!,
			...(msg.id ? { id: msg.id } : {}),
		}
	}

	public validateConversationHistory(messages: ApiMessage[]): boolean {
		if (!Array.isArray(messages)) {
			return false
		}

		for (const msg of messages) {
			if (!msg || typeof msg !== "object") {
				return false
			}

			// 验证 ts 字段
			if (msg.ts !== undefined && typeof msg.ts !== "number") {
				return false
			}

			if (msg.type === "reasoning") {
				if (!msg.encrypted_content || typeof msg.encrypted_content !== "string") {
					return false
				}
			} else if (msg.role) {
				if (msg.role !== "user" && msg.role !== "assistant" && msg.role !== "system") {
					return false
				}
			} else {
				return false
			}
		}

		return true
	}

	public convertToApiMessages(messages: ApiMessage[]): Anthropic.Messages.MessageParam[] {
		const cleanHistory = this.buildCleanConversationHistory(messages)
		return cleanHistory.filter(
			(msg): msg is Anthropic.Messages.MessageParam => {
				const reasoningMsg = msg as ReasoningMessageParam
				return reasoningMsg.type !== "reasoning"
			},
		)
	}
}
