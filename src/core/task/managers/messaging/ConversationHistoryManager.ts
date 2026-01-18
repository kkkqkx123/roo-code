import type Anthropic from "@anthropic-ai/sdk"
import type { ApiMessage } from "../../../task-persistence"

export interface ConversationHistoryManagerOptions {
	taskId: string
}

export class ConversationHistoryManager {
	readonly taskId: string

	constructor(options: ConversationHistoryManagerOptions) {
		this.taskId = options.taskId
	}

	public buildCleanConversationHistory(
		messages: ApiMessage[],
	): Array<
		Anthropic.Messages.MessageParam | { type: "reasoning"; encrypted_content: string; id?: string; summary?: any[] }
	> {
		type ReasoningItemForRequest = {
			type: "reasoning"
			encrypted_content: string
			id?: string
			summary?: any[]
		}

		const cleanConversationHistory: (Anthropic.Messages.MessageParam | ReasoningItemForRequest)[] = []

		for (const msg of messages) {
			if (msg.type === "reasoning") {
				if (msg.encrypted_content) {
					cleanConversationHistory.push({
						type: "reasoning",
						summary: msg.summary,
						encrypted_content: msg.encrypted_content!,
						...(msg.id ? { id: msg.id } : {}),
					})
				}
				continue
			}

			if (msg.role === "assistant") {
				const rawContent = msg.content

				const contentArray: Anthropic.Messages.ContentBlockParam[] = Array.isArray(rawContent)
					? (rawContent as Anthropic.Messages.ContentBlockParam[])
					: rawContent !== undefined
						? ([
								{ type: "text", text: rawContent } satisfies Anthropic.Messages.TextBlockParam,
							] as Anthropic.Messages.ContentBlockParam[])
						: []

				const [first, ...rest] = contentArray

				const msgWithDetails = msg
				if (msgWithDetails.reasoning_details && Array.isArray(msgWithDetails.reasoning_details)) {
					let assistantContent: Anthropic.Messages.MessageParam["content"]

					if (contentArray.length === 0) {
						assistantContent = ""
					} else if (contentArray.length === 1 && contentArray[0].type === "text") {
						assistantContent = (contentArray[0] as Anthropic.Messages.TextBlockParam).text
					} else {
						assistantContent = contentArray
					}

					cleanConversationHistory.push({
						role: "assistant",
						content: assistantContent,
						reasoning_details: msgWithDetails.reasoning_details,
					} as any)

					continue
				}

				const hasEncryptedReasoning =
					first && (first as any).type === "reasoning" && typeof (first as any).encrypted_content === "string"

				if (hasEncryptedReasoning) {
					cleanConversationHistory.push({
						role: "assistant",
						content: rest.length === 0 ? "" : rest,
					})

					continue
				}

				const hasThinkingBlock =
					first && (first as any).type === "thinking" && typeof (first as any).thinking === "string"

				if (hasThinkingBlock) {
					cleanConversationHistory.push({
						role: "assistant",
						content: rest.length === 0 ? "" : rest,
					})

					continue
				}

				cleanConversationHistory.push(msg as Anthropic.Messages.MessageParam)
			} else if (msg.role) {
				cleanConversationHistory.push(msg as Anthropic.Messages.MessageParam)
			}
		}

		return cleanConversationHistory
	}

	public cleanAssistantMessage(msg: ApiMessage): Anthropic.Messages.MessageParam | null {
		if (msg.role !== "assistant") {
			return null
		}

		const rawContent = msg.content

		const contentArray: Anthropic.Messages.ContentBlockParam[] = Array.isArray(rawContent)
			? (rawContent as Anthropic.Messages.ContentBlockParam[])
			: rawContent !== undefined
				? ([
						{ type: "text", text: rawContent } satisfies Anthropic.Messages.TextBlockParam,
					] as Anthropic.Messages.ContentBlockParam[])
				: []

		const [first, ...rest] = contentArray

		const msgWithDetails = msg
		if (msgWithDetails.reasoning_details && Array.isArray(msgWithDetails.reasoning_details)) {
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
				reasoning_details: msgWithDetails.reasoning_details,
			} as any
		}

		const hasEncryptedReasoning =
			first && (first as any).type === "reasoning" && typeof (first as any).encrypted_content === "string"

		if (hasEncryptedReasoning) {
			return {
				role: "assistant",
				content: rest.length === 0 ? "" : rest,
			}
		}

		const hasThinkingBlock =
			first && (first as any).type === "thinking" && typeof (first as any).thinking === "string"

		if (hasThinkingBlock) {
			return {
				role: "assistant",
				content: rest.length === 0 ? "" : rest,
			}
		}

		return msg as Anthropic.Messages.MessageParam
	}

	public cleanReasoningMessage(msg: ApiMessage): { type: "reasoning"; encrypted_content: string; id?: string; summary?: any[] } | null {
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
			(msg): msg is Anthropic.Messages.MessageParam => (msg as any).type !== "reasoning",
		)
	}
}
