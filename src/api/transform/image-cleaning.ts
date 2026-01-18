import { ApiHandler } from "../index"
import { ApiMessage } from "../../core/task-persistence/apiMessages"

export function maybeRemoveImageBlocks(messages: ApiMessage[], apiHandler: ApiHandler): ApiMessage[] {
	if (messages.length === 0) {
		return messages
	}

	const model = apiHandler.getModel()
	const supportsImages = model?.info?.supportsImages ?? true

	if (supportsImages) {
		return messages
	}

	return messages.map((message) => {
		if (typeof message.content === "string") {
			return message
		}

		const filteredContent = message.content.filter((block) => {
			if (block.type === "image") {
				return false
			}
			return true
		})

		return {
			...message,
			content: filteredContent.length > 0 ? filteredContent : message.content,
		}
	})
}
