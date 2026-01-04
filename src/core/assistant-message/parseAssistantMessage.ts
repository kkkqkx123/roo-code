import { type ToolName, toolNames } from "@roo-code/types"

import { TextContent, ToolUse, McpToolUse, ToolParamName, toolParamNames } from "../../shared/tools"

export type AssistantMessageContent = TextContent | ToolUse | McpToolUse

export function parseAssistantMessage(assistantMessage: string): AssistantMessageContent[] {
	const contentBlocks: AssistantMessageContent[] = []

	let currentTextContentStart = 0
	let currentTextContent: TextContent | undefined = undefined
	let currentToolUseStart = 0
	let currentToolUse: ToolUse | undefined = undefined
	let currentParamValueStart = 0
	let currentParamName: ToolParamName | undefined = undefined

	const toolUseOpenTags = new Map<string, ToolName>()
	const toolParamOpenTags = new Map<string, ToolParamName>()

	for (const name of toolNames) {
		toolUseOpenTags.set(`<${name}>`, name)
	}

	for (const name of toolParamNames) {
		toolParamOpenTags.set(`<${name}>`, name)
	}

	const len = assistantMessage.length

	for (let i = 0; i < len; i++) {
		const currentCharIndex = i

		if (currentToolUse && currentParamName) {
			const closeTag = `</${currentParamName}>`
			if (
				currentCharIndex >= closeTag.length - 1 &&
				assistantMessage.startsWith(closeTag, currentCharIndex - closeTag.length + 1)
			) {
				const value = assistantMessage.slice(currentParamValueStart, currentCharIndex - closeTag.length + 1)
				currentToolUse.params[currentParamName] =
					currentParamName === "content" ? value.replace(/^\n/, "").replace(/\n$/, "") : value.trim()
				currentParamName = undefined
			} else {
				continue
			}
		}

		if (currentToolUse && !currentParamName) {
			let startedNewParam = false

			for (const [tag, paramName] of toolParamOpenTags.entries()) {
				if (currentCharIndex >= tag.length - 1 && assistantMessage.startsWith(tag, currentCharIndex - tag.length + 1)) {
					currentParamName = paramName
					currentParamValueStart = currentCharIndex + 1
					startedNewParam = true
					break
				}
			}

			if (startedNewParam) {
				continue
			}

			const toolCloseTag = `</${currentToolUse.name}>`

			if (
				currentCharIndex >= toolCloseTag.length - 1 &&
				assistantMessage.startsWith(toolCloseTag, currentCharIndex - toolCloseTag.length + 1)
			) {
				const toolContentSlice = assistantMessage.slice(
					currentToolUseStart,
					currentCharIndex - toolCloseTag.length + 1,
				)

				const contentParamName: ToolParamName = "content"
				if (
					currentToolUse.name === "write_to_file" &&
					toolContentSlice.includes(`<${contentParamName}>`)
				) {
					const contentStartTag = `<${contentParamName}>`
					const contentEndTag = `</${contentParamName}>`
					const contentStart = toolContentSlice.indexOf(contentStartTag)
					const contentEnd = toolContentSlice.lastIndexOf(contentEndTag)

					if (contentStart !== -1 && contentEnd !== -1 && contentEnd > contentStart) {
						currentToolUse.params[contentParamName] = toolContentSlice
							.slice(contentStart + contentStartTag.length, contentEnd)
							.replace(/^\n/, "")
							.replace(/\n$/, "")
					}
				}

				currentToolUse.partial = false
				contentBlocks.push(currentToolUse)
				currentToolUse = undefined
				currentTextContentStart = currentCharIndex + 1
				continue
			}

			continue
		}

		if (!currentToolUse) {
			let startedNewTool = false

			for (const [tag, toolName] of toolUseOpenTags.entries()) {
				if (currentCharIndex >= tag.length - 1 && assistantMessage.startsWith(tag, currentCharIndex - tag.length + 1)) {
					if (currentTextContent) {
						currentTextContent.content = assistantMessage
							.slice(currentTextContentStart, currentCharIndex - tag.length + 1)
							.trim()
						currentTextContent.partial = false

						if (currentTextContent.content.length > 0) {
							contentBlocks.push(currentTextContent)
						}

						currentTextContent = undefined
					} else {
						const potentialText = assistantMessage
							.slice(currentTextContentStart, currentCharIndex - tag.length + 1)
							.trim()

						if (potentialText.length > 0) {
							contentBlocks.push({
								type: "text",
								content: potentialText,
								partial: false,
							})
						}
					}

					currentToolUse = {
						type: "tool_use",
						name: toolName,
						params: {},
						partial: true,
					}

					currentToolUseStart = currentCharIndex + 1
					startedNewTool = true

					break
				}
			}

			if (startedNewTool) {
				continue
			}

			if (!currentTextContent) {
				currentTextContentStart = currentCharIndex
				currentTextContent = {
					type: "text",
					content: "",
					partial: true,
				}
			}
		}
	}

	if (currentToolUse && currentParamName) {
		const value = assistantMessage.slice(currentParamValueStart)
		currentToolUse.params[currentParamName] =
			currentParamName === "content" ? value.replace(/^\n/, "").replace(/\n$/, "") : value.trim()
	}

	if (currentToolUse) {
		contentBlocks.push(currentToolUse)
	} else if (currentTextContent) {
		currentTextContent.content = assistantMessage.slice(currentTextContentStart).trim()

		if (currentTextContent.content.length > 0) {
			contentBlocks.push(currentTextContent)
		}
	}

	return contentBlocks
}
