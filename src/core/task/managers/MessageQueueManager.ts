import type { ClineProvider } from "../../webview/ClineProvider"
import { MessageQueueService } from "./MessageQueueService"
import type { QueuedMessage } from "@roo-code/types"

export interface MessageQueueManagerOptions {
	taskId: string
	providerRef: WeakRef<ClineProvider>
	onUserMessage?: (taskId: string) => void
}

export class MessageQueueManager {
	readonly taskId: string
	private providerRef: WeakRef<ClineProvider>
	private messageQueueService: MessageQueueService
	private messageQueueStateChangedHandler: (() => void) | undefined
	private onUserMessage?: (taskId: string) => void

	constructor(options: MessageQueueManagerOptions) {
		this.taskId = options.taskId
		this.providerRef = options.providerRef
		this.onUserMessage = options.onUserMessage

		this.messageQueueService = new MessageQueueService()

		this.messageQueueStateChangedHandler = () => {
			this.onUserMessage?.(this.taskId)
			this.providerRef.deref()?.postStateToWebview()
		}

		this.messageQueueService.on("stateChanged", this.messageQueueStateChangedHandler)
	}

	public async submitUserMessage(
		text: string,
		images: string[] = [],
		mode?: string,
		providerProfile?: string,
	): Promise<void> {
		try {
			text = (text ?? "").trim()
			images = images ?? []

			if (text.length === 0 && images.length === 0) {
				return
			}

			const provider = this.providerRef.deref()

			if (provider) {
				if (mode) {
					await provider.setMode(mode)
				}

				if (providerProfile) {
					await provider.setProviderProfile(providerProfile)
				}

				this.onUserMessage?.(this.taskId)

				provider.postMessageToWebview({ type: "invoke", invoke: "sendMessage", text, images })
			} else {
				console.error("[MessageQueueManager#submitUserMessage] Provider reference lost")
			}
		} catch (error) {
			console.error("[MessageQueueManager#submitUserMessage] Failed to submit user message:", error)
		}
	}

	public async processQueuedMessages(): Promise<void> {
		if (!this.messageQueueService.isEmpty()) {
			const queued = this.messageQueueService.dequeueMessage()
			if (queued) {
				setTimeout(() => {
					this.submitUserMessage(queued.text, queued.images)
				}, 100)
			}
		}
	}

	public validateUserMessage(text: string, images: string[]): boolean {
		text = (text ?? "").trim()
		images = images ?? []

		if (text.length === 0 && images.length === 0) {
			return false
		}

		return true
	}

	public hasQueuedMessages(): boolean {
		return !this.messageQueueService.isEmpty()
	}

	public getQueuedMessageCount(): number {
		return this.messageQueueService.messages.length
	}

	public get queuedMessages(): QueuedMessage[] {
		return this.messageQueueService.messages
	}

	public getMessageQueueService(): MessageQueueService {
		return this.messageQueueService
	}

	public dispose(): void {
		this.messageQueueService.dispose()
		if (this.messageQueueStateChangedHandler) {
			this.messageQueueService.off("stateChanged", this.messageQueueStateChangedHandler)
		}
	}
}
