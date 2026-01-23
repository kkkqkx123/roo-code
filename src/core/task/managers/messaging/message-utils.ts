import type { ClineMessage, ClineAsk } from "@shared/types"

import { safeJsonParse } from "@shared/safeJsonParse"

export const COMMAND_OUTPUT_STRING = "Output:"

export const blockingAsks = [
	"followup",
	"command",
	"tool",
	"browser_action_launch",
	"use_mcp_server",
] as const satisfies readonly ClineAsk[]

export const nonBlockingAsks = [
	"command_output",
] as const satisfies readonly ClineAsk[]

export const mutableAsks = ["resume_task"] as const satisfies readonly ClineAsk[]

export const terminalAsks = ["command"] as const satisfies readonly ClineAsk[]

export function isBlockingAsk(ask: ClineAsk): ask is "followup" | "command" | "tool" | "browser_action_launch" | "use_mcp_server" {
	return (blockingAsks as readonly ClineAsk[]).includes(ask)
}

export function isNonBlockingAsk(ask: ClineAsk): ask is "command_output" {
	return (nonBlockingAsks as readonly ClineAsk[]).includes(ask)
}

export function isMutableAsk(ask: ClineAsk): ask is "resume_task" {
	return (mutableAsks as readonly ClineAsk[]).includes(ask)
}

export function isTerminalAsk(ask: ClineAsk): ask is "command" {
	return (terminalAsks as readonly ClineAsk[]).includes(ask)
}

export function combineCommandSequences(messages: ClineMessage[]): ClineMessage[] {
	const combinedMessages = new Map<number, ClineMessage>()
	const processedIndices = new Set<number>()

	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i]

		if (msg.type === "ask" && msg.ask === "use_mcp_server") {
			let responses: string[] = []
			let j = i + 1

			while (j < messages.length) {
				if (messages[j].say === "mcp_server_response") {
					responses.push(messages[j].text || "")
					processedIndices.add(j)
					j++
				} else if (messages[j].type === "ask" && messages[j].ask === "use_mcp_server") {
					break
				} else {
					j++
				}
			}

			if (responses.length > 0) {
				const jsonObj = safeJsonParse<any>(msg.text || "{}", {})
				jsonObj.response = responses.join("\n")
				const combinedText = JSON.stringify(jsonObj)

				combinedMessages.set(msg.ts, { ...msg, text: combinedText })
			} else {
				combinedMessages.set(msg.ts, { ...msg })
			}
		}
		else if (msg.type === "ask" && msg.ask === "command") {
			let combinedText = msg.text || ""
			let j = i + 1
			let previous: { type: "ask" | "say"; text: string } | undefined
			let lastProcessedIndex = i

			while (j < messages.length) {
				const { type, ask, say, text = "" } = messages[j]

				if (type === "ask" && ask === "command") {
					break
				}

				if (ask === "command_output" || say === "command_output") {
					if (!previous) {
						combinedText += `\n${COMMAND_OUTPUT_STRING}`
					}

					const isDuplicate = previous && previous.type !== type && previous.text === text

					if (text.length > 0 && !isDuplicate) {
						if (
							previous &&
							combinedText.length >
								combinedText.indexOf(COMMAND_OUTPUT_STRING) + COMMAND_OUTPUT_STRING.length
						) {
							combinedText += "\n"
						}
						combinedText += text
					}

					previous = { type, text }
					processedIndices.add(j)
					lastProcessedIndex = j
				}

				j++
			}

			combinedMessages.set(msg.ts, { ...msg, text: combinedText })

			if (lastProcessedIndex > i) {
				i = lastProcessedIndex
			}
		}
	}

	const result: ClineMessage[] = []
	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i]

		if (processedIndices.has(i)) {
			continue
		}

		if (msg.ask === "command_output" || msg.say === "command_output" || msg.say === "mcp_server_response") {
			continue
		}

		if (combinedMessages.has(msg.ts)) {
			result.push(combinedMessages.get(msg.ts)!)
		} else {
			result.push(msg)
		}
	}

	return result
}
