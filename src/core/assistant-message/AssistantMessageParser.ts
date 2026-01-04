import { type ToolName, toolNames } from "@roo-code/types"
import { TextContent, ToolUse, ToolParamName, toolParamNames } from "../../shared/tools"
import { AssistantMessageContent } from "./parseAssistantMessage"

/**
 * Parser for assistant messages. Maintains state between chunks
 * to avoid reprocessing the entire message on each update.
 */
export class AssistantMessageParser {
	private contentBlocks: AssistantMessageContent[] = []
	private currentTextContent: TextContent | undefined = undefined
	private currentTextContentStart = 0
	private currentToolUse: ToolUse | undefined = undefined
	private currentToolUseStart = 0
	private currentParamValueStart = 0
	private currentParamName: ToolParamName | undefined = undefined
	private readonly MAX_ACCUMULATOR_SIZE = 1024 * 1024 // 1MB limit
	private readonly MAX_PARAM_LENGTH = 1024 * 100 // 100KB per parameter limit
	private accumulator = ""

	private toolUseOpenTags = new Map<string, ToolName>()
	private toolParamOpenTags = new Map<string, ToolParamName>()

	/**
	 * Initialize a new AssistantMessageParser instance.
	 */
	constructor() {
		for (const name of toolNames) {
			this.toolUseOpenTags.set(`<${name}>`, name)
		}

		for (const name of toolParamNames) {
			this.toolParamOpenTags.set(`<${name}>`, name)
		}

		this.reset()
	}

	/**
	 * Reset the parser state.
	 */
	public reset(): void {
		this.contentBlocks = []
		this.currentTextContent = undefined
		this.currentTextContentStart = 0
		this.currentToolUse = undefined
		this.currentToolUseStart = 0
		this.currentParamName = undefined
		this.currentParamValueStart = 0
		this.accumulator = ""
	}

	/**
	 * Returns the current parsed content blocks
	 */

	public getContentBlocks(): AssistantMessageContent[] {
		// Return a shallow copy to prevent external mutation
		return this.contentBlocks.slice()
	}
	/**
	 * Process a new chunk of text and update the parser state.
	 * @param chunk The new chunk of text to process.
	 */
	public processChunk(chunk: string): AssistantMessageContent[] {
		if (this.accumulator.length + chunk.length > this.MAX_ACCUMULATOR_SIZE) {
			throw new Error("Assistant message exceeds maximum allowed size")
		}

		const accumulatorStartLength = this.accumulator.length
		this.accumulator += chunk

		for (let i = 0; i < chunk.length; i++) {
			const currentCharIndex = accumulatorStartLength + i

			if (this.currentToolUse && this.currentParamName) {
				const closeTag = `</${this.currentParamName}>`
				if (
					currentCharIndex >= closeTag.length - 1 &&
					this.accumulator.startsWith(closeTag, currentCharIndex - closeTag.length + 1)
				) {
					const value = this.accumulator.slice(this.currentParamValueStart, currentCharIndex - closeTag.length + 1)
					this.currentToolUse.params[this.currentParamName] =
						this.currentParamName === "content" ? value.replace(/^\n/, "").replace(/\n$/, "") : value.trim()
					this.currentParamName = undefined
				} else {
					const currentParamValue = this.accumulator.slice(this.currentParamValueStart)
					if (currentParamValue.length > this.MAX_PARAM_LENGTH) {
						this.currentParamName = undefined
						this.currentParamValueStart = 0
						continue
					}
					this.currentToolUse.params[this.currentParamName] = currentParamValue
					continue
				}
			}

			if (this.currentToolUse && !this.currentParamName) {
				let startedNewParam = false

				for (const [tag, paramName] of this.toolParamOpenTags.entries()) {
					if (
						currentCharIndex >= tag.length - 1 &&
						this.accumulator.startsWith(tag, currentCharIndex - tag.length + 1)
					) {
						this.currentParamName = paramName
						this.currentParamValueStart = currentCharIndex + 1
						startedNewParam = true
						break
					}
				}

				if (startedNewParam) {
					continue
				}

				const toolCloseTag = `</${this.currentToolUse.name}>`

				if (
					currentCharIndex >= toolCloseTag.length - 1 &&
					this.accumulator.startsWith(toolCloseTag, currentCharIndex - toolCloseTag.length + 1)
				) {
					const toolContentSlice = this.accumulator.slice(
						this.currentToolUseStart,
						currentCharIndex - toolCloseTag.length + 1,
					)

					const contentParamName: ToolParamName = "content"
					if (
						this.currentToolUse.name === "write_to_file" &&
						toolContentSlice.includes(`<${contentParamName}>`)
					) {
						const contentStartTag = `<${contentParamName}>`
						const contentEndTag = `</${contentParamName}>`
						const contentStart = toolContentSlice.indexOf(contentStartTag)
						const contentEnd = toolContentSlice.lastIndexOf(contentEndTag)

						if (contentStart !== -1 && contentEnd !== -1 && contentEnd > contentStart) {
							this.currentToolUse.params[contentParamName] = toolContentSlice
								.slice(contentStart + contentStartTag.length, contentEnd)
								.replace(/^\n/, "")
								.replace(/\n$/, "")
						}
					}

					this.currentToolUse.partial = false
					this.currentToolUse = undefined
					this.currentTextContentStart = currentCharIndex + 1
					continue
				}

				continue
			}

			if (!this.currentToolUse) {
				let startedNewTool = false

				for (const [tag, toolName] of this.toolUseOpenTags.entries()) {
					if (
						currentCharIndex >= tag.length - 1 &&
						this.accumulator.startsWith(tag, currentCharIndex - tag.length + 1)
					) {
						if (this.currentTextContent) {
							this.currentTextContent.content = this.accumulator
								.slice(this.currentTextContentStart, currentCharIndex - tag.length + 1)
								.trim()
							this.currentTextContent.partial = false

							this.currentTextContent = undefined
						} else {
							const potentialText = this.accumulator
								.slice(this.currentTextContentStart, currentCharIndex - tag.length + 1)
								.trim()

							if (potentialText.length > 0) {
								this.contentBlocks.push({
									type: "text",
									content: potentialText,
									partial: false,
								})
							}
						}

						this.currentToolUse = {
							type: "tool_use",
							name: toolName,
							params: {},
							partial: true,
						}

						this.currentToolUseStart = currentCharIndex + 1
						startedNewTool = true

						let idx = this.contentBlocks.findIndex((block) => block === this.currentToolUse)
						if (idx === -1) {
							this.contentBlocks.push(this.currentToolUse)
						}

						break
					}
				}

				if (startedNewTool) {
					continue
				}

				if (!this.currentTextContent) {
					this.currentTextContentStart = currentCharIndex
					this.currentTextContent = {
						type: "text",
						content: "",
						partial: true,
					}

					this.contentBlocks.push(this.currentTextContent)
				} else {
					this.currentTextContent.content = this.accumulator.slice(this.currentTextContentStart).trim()
				}
			}
		}

		return this.getContentBlocks()
	}

	/**
	 * Finalize any partial content blocks.
	 * Should be called after processing the last chunk.
	 */
	public finalizeContentBlocks(): void {
		// Mark all partial blocks as complete
		for (const block of this.contentBlocks) {
			if (block.partial) {
				block.partial = false
			}
			if (block.type === "text" && typeof block.content === "string") {
				block.content = block.content.trim()
			}
		}
	}
}
