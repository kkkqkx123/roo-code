import type { ClineMessage } from "@shared/types"

export function combineApiRequests(messages: ClineMessage[]): ClineMessage[] {
	if (messages.length === 0) {
		return []
	}

	if (messages.length === 1) {
		return messages
	}

	let isMergeNecessary = false

	for (const msg of messages) {
		if (msg.type === "say" && (msg.say === "api_req_started" || msg.say === "api_req_finished")) {
			isMergeNecessary = true
			break
		}
	}

	if (!isMergeNecessary) {
		return messages
	}

	const result: ClineMessage[] = []
	const startedIndices: number[] = []

	for (const message of messages) {
		if (message.type !== "say" || (message.say !== "api_req_started" && message.say !== "api_req_finished")) {
			result.push(message)
			continue
		}

		if (message.say === "api_req_started") {
			result.push(message)
			startedIndices.push(result.length - 1)
			continue
		}

		const startIndex = startedIndices.length > 0 ? startedIndices.pop() : undefined

		if (startIndex !== undefined) {
			const startMessage = result[startIndex]
			let startData = {}
			let finishData = {}

			try {
				if (startMessage.text) {
					startData = JSON.parse(startMessage.text)
				}
			} catch (e) {}

			try {
				if (message.text) {
					finishData = JSON.parse(message.text)
				}
			} catch (e) {}

			result[startIndex] = { ...startMessage, text: JSON.stringify({ ...startData, ...finishData }) }
		}
	}

	return result
}
