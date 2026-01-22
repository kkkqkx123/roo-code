import type { ClineProvider } from "../../../webview/ClineProvider"
import { MessageQueueService } from "./MessageQueueService"
import type { QueuedMessage } from "@shared/types"
import { ErrorHandler } from "../../../error/ErrorHandler"

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
	private errorHandler: ErrorHandler
	private maxRetries: number
	private retryDelay: number
	private processing: boolean = false

	constructor(options: MessageQueueManagerOptions) {
		this.taskId = options.taskId
		this.providerRef = options.providerRef
		this.onUserMessage = options.onUserMessage
		this.maxRetries = options.maxRetries ?? 3
		this.retryDelay = options.retryDelay ?? 1000
		this.errorHandler = new ErrorHandler()

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
			const success = await this.validateMessageDelivery()
			
			if (success) {
				this.messageQueueService.removeMessage(queued.id)
			} else {
				throw new Error("Message delivery validation failed")
			}
		} catch (error) {
			console.error(`[MessageQueueManager] Failed to submit message (attempt ${retryCount + 1}):`, error)
			
			const result = await this.errorHandler.handleError(
				error instanceof Error ? error : new Error(String(error)),
				{
					operation: "processMessageWithRetry",
					taskId: this.taskId,
					timestamp: Date.now()
				}
			)
			
			if (retryCount < this.maxRetries && result.shouldRetry) {
				const delay = this.retryDelay * Math.pow(2, retryCount)
				console.log(`[MessageQueueManager] Retrying after ${delay}ms`)
				await this.delay(delay)
				
				await this.processMessageWithRetry(queued, retryCount + 1)
			} else {
				console.error('[MessageQueueManager] Max retries exceeded or no retry allowed, message dropped:', queued)
				this.messageQueueService.removeMessage(queued.id)
			}
		}
	}

	private async validateMessageDelivery(): Promise<boolean> {
		const provider = this.providerRef.deref()
		if (!provider) {
			return false
		}

		try {
			const state = await provider.getState()
			return state !== undefined && state !== null
		} catch (error) {
			console.error('[MessageQueueManager] Failed to validate message delivery:', error)
			return false
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

	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms))
	}
}
