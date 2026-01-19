import { EventEmitter } from "events"

import { v4 as uuidv4 } from "uuid"

import { QueuedMessage } from "@shared/types"

export interface MessageQueueState {
	messages: QueuedMessage[]
	isProcessing: boolean
	isPaused: boolean
}

export interface QueueEvents {
	stateChanged: [messages: QueuedMessage[]]
}

export interface MessageQueueServiceOptions {
	maxSize?: number // 队列最大大小
}

export class MessageQueueService extends EventEmitter<QueueEvents> {
	private _messages: QueuedMessage[]
	public maxSize: number

	constructor(options: MessageQueueServiceOptions = {}) {
		super()
		this._messages = []
		this.maxSize = options.maxSize ?? 10 // 默认最多 10 条消息
	}

	private findMessage(id: string) {
		const index = this._messages.findIndex((msg) => msg.id === id)

		if (index === -1) {
			return { index, message: undefined }
		}

		return { index, message: this._messages[index] }
	}

	public addMessage(text: string, images?: string[]): { success: boolean; message?: QueuedMessage; reason?: string } {
		if (!text && !images?.length) {
			return { success: false, reason: 'Empty message' }
		}

		// 检查队列是否已满
		if (this._messages.length >= this.maxSize) {
			console.warn('[MessageQueueService] Queue is full, cannot add message')
			return { success: false, reason: 'Queue is full' }
		}

		const message: QueuedMessage = {
			timestamp: Date.now(),
			id: uuidv4(),
			text,
			images,
		}

		this._messages.push(message)
		this.emit("stateChanged", this._messages)

		return { success: true, message }
	}

	public removeMessage(id: string): boolean {
		const { index, message } = this.findMessage(id)

		if (!message) {
			return false
		}

		this._messages.splice(index, 1)
		this.emit("stateChanged", this._messages)
		return true
	}

	public updateMessage(id: string, text: string, images?: string[]): boolean {
		const { message } = this.findMessage(id)

		if (!message) {
			return false
		}

		message.timestamp = Date.now()
		message.text = text
		message.images = images
		this.emit("stateChanged", this._messages)
		return true
	}

	public dequeueMessage(): QueuedMessage | undefined {
		const message = this._messages.shift()
		this.emit("stateChanged", this._messages)
		return message
	}

	public get messages(): QueuedMessage[] {
		return this._messages
	}

	public isEmpty(): boolean {
		return this._messages.length === 0
	}

	public isFull(): boolean {
		return this._messages.length >= this.maxSize
	}

	public dispose(): void {
		this._messages = []
		this.removeAllListeners()
		// 清理所有定时器和异步操作
	}

	/**
	 * 动态设置队列最大大小
	 */
	public setMaxSize(newSize: number): void {
		if (newSize < 1) {
			console.warn('[MessageQueueService] Invalid maxSize, must be at least 1')
			return
		}
		
		this.maxSize = newSize
		
		// 如果当前队列超过新大小，移除最旧的消息
		while (this._messages.length > this.maxSize) {
			this._messages.shift()
		}
		
		this.emit("stateChanged", this._messages)
	}
}
