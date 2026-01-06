import type { ClineMessage, ClineAsk, ToolName, ClineSay, ToolProgressStatus, ContextCondense, ContextTruncation } from "@roo-code/types"
import type { ToolResponse } from "../../../shared/tools"
import { isIdleAsk, isInteractiveAsk, isResumableAsk } from "@roo-code/types"
import { formatResponse } from "../../prompts/responses"
import { t } from "../../../i18n"
import type { TaskStateManager } from "./TaskStateManager"
import type { MessageManager } from "./MessageManager"
import type { ClineAskResponse } from "../../../shared/WebviewMessage"

export interface UserInteractionManagerOptions {
	stateManager: TaskStateManager
	messageManager: MessageManager
}

export class UserInteractionManager {
	private stateManager: TaskStateManager
	private messageManager: MessageManager

	idleAsk?: ClineMessage
	resumableAsk?: ClineMessage
	interactiveAsk?: ClineMessage

	private askResponse?: ClineAskResponse
	private askResponseText?: string
	private askResponseImages?: string[]
	public lastMessageTs?: number
	private autoApprovalTimeoutRef?: NodeJS.Timeout

	constructor(options: UserInteractionManagerOptions) {
		this.stateManager = options.stateManager
		this.messageManager = options.messageManager
	}

	async ask(
		type: ClineAsk,
		message?: string,
		images?: string[],
		partial?: boolean,
		isUpdatingPreviousPartial?: boolean,
	): Promise<{ response: ClineAskResponse; text?: string; images?: string[] }> {
		if (this.stateManager.abort) {
			throw new Error("Task aborted")
		}

		const askTs = Date.now()
		const provider = this.stateManager.getProvider()

		if (partial !== undefined) {
			if (partial) {
				if (isUpdatingPreviousPartial) {
					const lastMessage = this.messageManager.getClineMessages().at(-1)
					if (lastMessage && lastMessage.partial) {
						lastMessage.ask = type
						lastMessage.text = message
						lastMessage.images = images
						await this.messageManager.updateClineMessage(lastMessage)
					}
				} else {
					const partialMessage: ClineMessage = {
						type: "ask",
						ask: type,
						ts: askTs,
						partial: true,
						text: message,
						images,
					}
					await this.messageManager.addToClineMessages(partialMessage)
				}
			} else {
				const lastMessage = this.messageManager.getClineMessages().at(-1)
				if (lastMessage && lastMessage.partial) {
					lastMessage.partial = false
					await this.messageManager.updateClineMessage(lastMessage)
				}
			}
			return { response: "messageResponse", text: message, images }
		}

		const approval = await this.waitForApproval(type, message, images)

		if (approval.decision === "approve") {
			return { response: "yesButtonClicked", text: this.askResponseText, images: this.askResponseImages }
		} else {
			return { response: "messageResponse", text: this.askResponseText, images: this.askResponseImages }
		}
	}

	private async waitForApproval(
		type: ClineAsk,
		message?: string,
		images?: string[],
	): Promise<{ decision: "approve" | "deny" }> {
		const askTs = Date.now()
		const isBlocking = !isIdleAsk(type)
		const isStatusMutable = isResumableAsk(type)

		const askMessage: ClineMessage = {
			type: "ask",
			ask: type,
			ts: askTs,
			text: message,
			images,
		}

		await this.messageManager.addToClineMessages(askMessage)

		if (isBlocking) {
			if (isStatusMutable) {
				if (type === "resume_task") {
					this.resumableAsk = askMessage
				} else if (type === "command") {
					this.interactiveAsk = askMessage
				} else if (isInteractiveAsk(type)) {
					this.idleAsk = askMessage
				}
			}

			await this.waitForResponse(askTs)
		}

		return { decision: "approve" }
	}

	private async waitForResponse(askTs: number): Promise<void> {
		return new Promise((resolve) => {
			const checkResponse = () => {
				if (this.lastMessageTs !== askTs) {
					resolve()
				} else {
					setTimeout(checkResponse, 100)
				}
			}
			checkResponse()
		})
	}

	async say(
		type: ClineSay,
		text?: string,
		images?: string[],
		partial?: boolean,
		checkpoint?: Record<string, unknown>,
		progressStatus?: ToolProgressStatus,
		options: {
			isNonInteractive?: boolean
		} = {},
		contextCondense?: ContextCondense,
		contextTruncation?: ContextTruncation,
	): Promise<ClineMessage | undefined> {
		if (this.stateManager.abort) {
			return undefined
		}

		const sayTs = Date.now()

		if (partial !== undefined) {
			if (partial) {
				const lastMessage = this.messageManager.getClineMessages().at(-1)
				const isUpdatingPreviousPartial =
					lastMessage && lastMessage.partial && lastMessage.type === "say" && lastMessage.say === type

				if (isUpdatingPreviousPartial) {
					lastMessage.text = text
					lastMessage.images = images
					lastMessage.partial = partial
					lastMessage.progressStatus = progressStatus
					lastMessage.contextCondense = contextCondense
					lastMessage.contextTruncation = contextTruncation
					await this.messageManager.updateClineMessage(lastMessage)
					return lastMessage
				} else {
					const partialMessage: ClineMessage = {
						type: "say",
						say: type,
						ts: sayTs,
						partial: true,
						text,
						images,
						checkpoint,
						progressStatus,
						contextCondense,
						contextTruncation,
					}
					await this.messageManager.addToClineMessages(partialMessage)
					if (!options.isNonInteractive) {
						this.lastMessageTs = sayTs
					}
					return partialMessage
				}
			} else {
				const lastMessage = this.messageManager.getClineMessages().at(-1)
				if (lastMessage && lastMessage.partial) {
					lastMessage.partial = false
					lastMessage.progressStatus = progressStatus
					await this.messageManager.updateClineMessage(lastMessage)
					return lastMessage
				}
				return undefined
			}
		}

		const sayMessage: ClineMessage = {
			type: "say",
			say: type,
			ts: sayTs,
			text,
			images,
			checkpoint,
			progressStatus,
			contextCondense,
			contextTruncation,
		}

		await this.messageManager.addToClineMessages(sayMessage)
		if (!options.isNonInteractive) {
			this.lastMessageTs = sayTs
		}
		return sayMessage
	}

	async sayAndCreateMissingParamError(toolName: ToolName, paramName: string, relPath?: string): Promise<ToolResponse> {
		const message = t("common:errors.missing_param", { toolName, paramName, relPath })
		await this.say("error", message)
		return formatResponse.toolError(
			formatResponse.missingToolParameterError(paramName, this.stateManager.taskToolProtocol ?? "xml"),
		)
	}

	handleWebviewAskResponse(askResponse: ClineAskResponse, text?: string, images?: string[]): void {
		this.askResponse = askResponse
		this.askResponseText = text
		this.askResponseImages = images

		if (askResponse === "messageResponse" || askResponse === "yesButtonClicked") {
			this.lastMessageTs = Date.now()
		}

		if (this.idleAsk || this.resumableAsk || this.interactiveAsk) {
			this.idleAsk = undefined
			this.resumableAsk = undefined
			this.interactiveAsk = undefined
		}
	}

	cancelAutoApprovalTimeout(): void {
		if (this.autoApprovalTimeoutRef) {
			clearTimeout(this.autoApprovalTimeoutRef)
			this.autoApprovalTimeoutRef = undefined
		}
	}

	async approveAsk({ text, images }: { text?: string; images?: string[] } = {}): Promise<void> {
		this.askResponse = "yesButtonClicked"
		this.askResponseText = text
		this.askResponseImages = images
		this.lastMessageTs = Date.now()
	}

	async denyAsk({ text, images }: { text?: string; images?: string[] } = {}): Promise<void> {
		this.askResponse = "messageResponse"
		this.askResponseText = text
		this.askResponseImages = images
		this.lastMessageTs = Date.now()
	}

	clearAsks(): void {
		this.idleAsk = undefined
		this.resumableAsk = undefined
		this.interactiveAsk = undefined
	}

	getIdleAsk(): ClineMessage | undefined {
		return this.idleAsk
	}

	getResumableAsk(): ClineMessage | undefined {
		return this.resumableAsk
	}

	getInteractiveAsk(): ClineMessage | undefined {
		return this.interactiveAsk
	}
}
