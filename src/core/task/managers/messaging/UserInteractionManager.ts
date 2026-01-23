import type { ClineMessage, ClineAsk, ToolName, ClineSay, ToolProgressStatus, ContextCondense, ContextTruncation } from "@shared/types"
import type { ToolResponse } from "@shared/types/tool-config"
import { isBlockingAsk, isMutableAsk, isTerminalAsk } from "@core/task/managers/messaging/message-utils"
import { formatResponse } from "../../../prompts/responses"
import { t } from "../../../../i18n"
import type { TaskStateManager } from "../core/TaskStateManager"
import type { MessageManager } from "./MessageManager"
import type { ClineAskResponse } from "../../../../shared/WebviewMessage"

export interface UserInteractionManagerOptions {
	stateManager: TaskStateManager
	messageManager: MessageManager
	responseTimeout?: number // 响应超时时间（毫秒）
}

interface AskState {
	askResponse?: ClineAskResponse
	askResponseText?: string
	askResponseImages?: string[]
	timestamp: number
}

interface ResponseResolver {
	resolve: (value: void) => void
	timeout: NodeJS.Timeout
}

export class UserInteractionManager {
	private stateManager: TaskStateManager
	private messageManager: MessageManager
	private responseTimeout: number

	terminalAsk?: ClineMessage
	resumableAsk?: ClineMessage
	interactiveAsk?: ClineMessage

	private askState: AskState | null = null
	public lastMessageTs?: number
	private autoApprovalTimeoutRef?: NodeJS.Timeout
	private responseResolvers: Map<number, ResponseResolver> = new Map()

	constructor(options: UserInteractionManagerOptions) {
		this.stateManager = options.stateManager
		this.messageManager = options.messageManager
		this.responseTimeout = options.responseTimeout ?? 30000 // 默认 30 秒
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
			return {
				response: "yesButtonClicked",
				text: this.askState?.askResponseText,
				images: this.askState?.askResponseImages
			}
		} else {
			return {
				response: "messageResponse",
				text: this.askState?.askResponseText,
				images: this.askState?.askResponseImages
			}
		}
	}

	private async waitForApproval(
		type: ClineAsk,
		message?: string,
		images?: string[],
	): Promise<{ decision: "approve" | "deny" }> {
		const askTs = Date.now()
		const isBlocking = isBlockingAsk(type)
		const isStatusMutable = isMutableAsk(type)

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
				}
			} else if (isTerminalAsk(type)) {
				this.terminalAsk = askMessage
			} else {
				this.interactiveAsk = askMessage
			}

			await this.waitForResponse(askTs)
		}

		return { decision: "approve" }
	}

	private async waitForResponse(askTs: number): Promise<void> {
		return new Promise((resolve, reject) => {
			// 先检查是否已经有响应
			if (this.lastMessageTs !== undefined && this.lastMessageTs !== askTs) {
				resolve()
				return
			}

			// 设置超时
			const timeoutRef = setTimeout(() => {
				this.responseResolvers.delete(askTs)
				reject(new Error(`[UserInteractionManager] Response timeout after ${this.responseTimeout}ms`))
			}, this.responseTimeout)

			// 存储 resolver 和 timeout
			this.responseResolvers.set(askTs, { resolve, timeout: timeoutRef })
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
		const provider = this.stateManager.getProvider()
		provider?.log(`[UserInteractionManager#say] Starting say, type: ${type}, partial: ${partial}`)
		
		if (this.stateManager.abort) {
			provider?.log(`[UserInteractionManager#say] Aborted, returning undefined`)
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
					provider?.log(`[UserInteractionManager#say] Updated partial message`)
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
					provider?.log(`[UserInteractionManager#say] Added partial message`)
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
					provider?.log(`[UserInteractionManager#say] Finalized partial message`)
					return lastMessage
				}
				provider?.log(`[UserInteractionManager#say] No partial message to finalize, returning undefined`)
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

		provider?.log(`[UserInteractionManager#say] About to add message to clineMessages, current count: ${this.messageManager.getClineMessages().length}`)
		await this.messageManager.addToClineMessages(sayMessage)
		provider?.log(`[UserInteractionManager#say] Message added, new count: ${this.messageManager.getClineMessages().length}`)
		
		if (!options.isNonInteractive) {
			this.lastMessageTs = sayTs
		}
		return sayMessage
	}

	async sayAndCreateMissingParamError(toolName: ToolName, paramName: string, relPath?: string): Promise<ToolResponse> {
		const message = t("common:errors.missing_param", { toolName, paramName, relPath: relPath ?? "" })
		await this.say("error", message)
		return formatResponse.toolError(
			formatResponse.missingToolParameterError(paramName, this.stateManager.taskToolProtocol ?? "xml"),
		)
	}

	handleWebviewAskResponse(askResponse: ClineAskResponse, text?: string, images?: string[]): void {
		// 更新状态
		if (this.askState) {
			this.askState.askResponse = askResponse
			this.askState.askResponseText = text
			this.askState.askResponseImages = images
		}

		if (askResponse === "messageResponse" || askResponse === "yesButtonClicked") {
			this.lastMessageTs = Date.now()
		}

		if (this.terminalAsk || this.resumableAsk || this.interactiveAsk) {
			this.terminalAsk = undefined
			this.resumableAsk = undefined
			this.interactiveAsk = undefined
		}

		// 触发等待的 Promise - 使用正确的 key
		if (this.lastMessageTs) {
			const resolver = this.responseResolvers.get(this.lastMessageTs)
			if (resolver) {
				resolver.resolve()
				this.responseResolvers.delete(this.lastMessageTs)
			}
		}
	}

	cancelAutoApprovalTimeout(): void {
		if (this.autoApprovalTimeoutRef) {
			clearTimeout(this.autoApprovalTimeoutRef)
			this.autoApprovalTimeoutRef = undefined
		}
	}

	async approveAsk({ text, images }: { text?: string; images?: string[] } = {}): Promise<void> {
		if (this.askState) {
			this.askState.askResponse = "yesButtonClicked"
			this.askState.askResponseText = text
			this.askState.askResponseImages = images
		}
		this.lastMessageTs = Date.now()
	}

	async denyAsk({ text, images }: { text?: string; images?: string[] } = {}): Promise<void> {
		if (this.askState) {
			this.askState.askResponse = "messageResponse"
			this.askState.askResponseText = text
			this.askState.askResponseImages = images
		}
		this.lastMessageTs = Date.now()
	}

	clearAsks(): void {
		this.terminalAsk = undefined
		this.resumableAsk = undefined
		this.interactiveAsk = undefined
	}

	getTerminalAsk(): ClineMessage | undefined {
		return this.terminalAsk
	}

	getResumableAsk(): ClineMessage | undefined {
		return this.resumableAsk
	}

	getInteractiveAsk(): ClineMessage | undefined {
		return this.interactiveAsk
	}

	dispose(): void {
		this.cancelAutoApprovalTimeout()
		
		// 清理所有等待的 Promise，使用 try-catch 避免未处理的异常
		this.responseResolvers.forEach(({ resolve, timeout }) => {
			clearTimeout(timeout)
			try {
				resolve()
			} catch (error) {
				console.error('[UserInteractionManager] Error resolving promise during dispose:', error)
			}
		})
		this.responseResolvers.clear()

		// 清理状态
		this.terminalAsk = undefined
		this.resumableAsk = undefined
		this.interactiveAsk = undefined
		this.askState = null
		this.lastMessageTs = undefined
	}
}
