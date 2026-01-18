import type { ClineProvider } from "../../../webview/ClineProvider"
import { MessageQueueService } from "./MessageQueueService"
import type { QueuedMessage } from "@roo-code/types"

export interface MessageQueueManagerOptions {
	taskId: string
	providerRef: WeakRef<ClineProvider>
	onUserMessage?: (taskId: string) => void
	maxQueueSize?: number // 队列最大大小
	maxRetries?: number // 最大重试次数
	retryDelay?: number // 重试延迟（毫秒）
}

export class MessageQueueManager {
	readonly taskId: string
	private providerRef: WeakRef<ClineProvider>
	private messageQueueService: MessageQueueService
	private messageQueueStateChangedHandler: (() => void) | undefined
	private onUserMessage?: (taskId: string) => void
	private maxRetries: number
	private retryDelay: number
	private processing: boolean = false

	constructor(options: MessageQueueManagerOptions) {
		this.taskId = options.taskId
		this.providerRef = options.providerRef
		this.onUserMessage = options.onUserMessage
		this.maxRetries = options.maxRetries ?? 3
		this.retryDelay = options.retryDelay ?? 1000

		this.messageQueueService = new MessageQueueService({ maxSize: options.maxQueueSize ?? 10 })

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
		if (this.processing || this.messageQueueService.isEmpty()) {
			return
		}

		this.processing = true

		try {
			const queued = this.messageQueueService.dequeueMessage()
			if (queued) {
				await this.processMessageWithRetry(queued, 0)
			}
		} catch (error) {
			console.error('[MessageQueueManager#processQueuedMessages] Error processing queue:', error)
		} finally {
			this.processing = false
		}
	}

	private async processMessageWithRetry(queued: QueuedMessage, retryCount: number): Promise<void> {
		try {
			await this.submitUserMessage(queued.text, queued.images)
		} catch (error) {
			console.error(`[MessageQueueManager] Failed to submit message (attempt ${retryCount + 1}):`, error)
			
			if (retryCount < this.maxRetries) {
				// 重新加入队列
				this.messageQueueService.addMessage(queued.text, queued.images)
				
				// 延迟重试
				await new Promise(resolve => setTimeout(resolve, this.retryDelay * (retryCount + 1)))
				
				// 重新处理
				await this.processQueuedMessages()
			} else {
				console.error('[MessageQueueManager] Max retries exceeded, message dropped:', queued)
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
