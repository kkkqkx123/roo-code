import { createLogger } from "../../utils/logger"
import type { ExtensionResponseMessage } from "./MessageTypes"

export interface PendingMessage {
  message: ExtensionResponseMessage
  retryCount: number
  maxRetries: number
  timestamp: number
  messageId: string
}

export interface MessageHandler<T = any> {
  (message: T): Promise<any>
}

export interface MessageSubscription {
  unsubscribe(): void
}

export interface MessageBusOptions {
  maxRetries?: number
  retryDelay?: number
  maxQueueAge?: number
  cleanupInterval?: number
}

export class MessageBus {
  protected handlers = new Map<string, Set<MessageHandler>>()
  protected pendingMessages = new Map<string, PendingMessage>()
  protected messageQueue: ExtensionResponseMessage[] = []
  protected isProcessingQueue = false

  private readonly maxRetries: number
  private readonly retryDelay: number
  protected readonly maxQueueAge: number
  private readonly cleanupInterval: number

  protected logger: ReturnType<typeof createLogger>

  constructor(outputChannel: any, options: MessageBusOptions = {}) {
    this.logger = createLogger(outputChannel, "MessageBus")

    this.maxRetries = options.maxRetries ?? 3
    this.retryDelay = options.retryDelay ?? 1000
    this.maxQueueAge = options.maxQueueAge ?? 60000
    this.cleanupInterval = options.cleanupInterval ?? 5000

    this.logger.info(`MessageBus initialized with options: ${JSON.stringify(options)}`)
  }

  register<T>(messageType: string, handler: MessageHandler<T>): MessageSubscription {
    if (!this.handlers.has(messageType)) {
      this.handlers.set(messageType, new Set())
    }

    this.handlers.get(messageType)!.add(handler)
    this.logger.debug(`Registered handler for message type: ${messageType}`)

    return {
      unsubscribe: () => {
        const handlers = this.handlers.get(messageType)
        if (handlers) {
          handlers.delete(handler)
          if (handlers.size === 0) {
            this.handlers.delete(messageType)
          }
          this.logger.debug(`Unregistered handler for message type: ${messageType}`)
        }
      }
    }
  }

  async handle<T>(message: T): Promise<any> {
    const messageType = (message as any).type
    const handlers = this.handlers.get(messageType)

    if (!handlers || handlers.size === 0) {
      this.logger.warn(`No handler registered for message type: ${messageType}`)
      throw new Error(`No handler for message type: ${messageType}`)
    }

    this.logger.debug(`Handling message: ${messageType}`)

    try {
      const results = await Promise.all(
        Array.from(handlers).map(handler => handler(message))
      )

      this.logger.debug(`Message handled successfully: ${messageType}`)
      return results[0]
    } catch (error) {
      this.logger.error(`Error handling message ${messageType}:`, error)
      throw error
    }
  }

  publish(message: ExtensionResponseMessage): Promise<boolean> {
    const messageId = this.generateMessageId()

    const pendingMessage: PendingMessage = {
      message,
      retryCount: 0,
      maxRetries: this.maxRetries,
      timestamp: Date.now(),
      messageId
    }

    this.pendingMessages.set(messageId, pendingMessage)
    this.logger.debug(`Published message: ${message.type} with ID: ${messageId}`)

    return this.sendWithRetry(messageId)
  }

  protected async sendMessage(message: ExtensionResponseMessage): Promise<void> {
    throw new Error("sendMessage must be implemented by subclass")
  }

  protected async sendWithRetry(messageId: string): Promise<boolean> {
    const pendingMessage = this.pendingMessages.get(messageId)
    if (!pendingMessage) {
      return false
    }

    const { message, retryCount, maxRetries } = pendingMessage

    for (let attempt = retryCount; attempt < maxRetries; attempt++) {
      try {
        await this.sendMessage(message)
        this.pendingMessages.delete(messageId)
        this.logger.debug(`Message sent successfully: ${message.type}`)
        return true
      } catch (error) {
        this.logger.error(`Failed to send message (attempt ${attempt + 1}): ${message.type}`, error)

        if (attempt < maxRetries - 1) {
          const delay = this.retryDelay * Math.pow(2, attempt)
          this.logger.debug(`Retrying after ${delay}ms`)
          await this.delay(delay)
        }
      }
    }

    this.logger.error(`Failed to send message after ${maxRetries} attempts: ${message.type}`)
    return false
  }

  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.pendingMessages.size === 0) {
      return
    }

    this.isProcessingQueue = true
    this.logger.info(`Processing ${this.pendingMessages.size} queued messages`)

    const now = Date.now()
    const processedMessages: string[] = []

    for (const [messageId, pendingMessage] of this.pendingMessages) {
      if (now - pendingMessage.timestamp > this.maxQueueAge) {
        this.logger.warn(`Removing expired message: ${pendingMessage.message.type}`)
        processedMessages.push(messageId)
        continue
      }

      const success = await this.sendWithRetry(messageId)
      if (success) {
        processedMessages.push(messageId)
      }
    }

    for (const messageId of processedMessages) {
      this.pendingMessages.delete(messageId)
    }

    this.logger.debug(`Processed ${processedMessages.length} messages, remaining: ${this.pendingMessages.size}`)
    this.isProcessingQueue = false
  }

  getStats(): { handlers: number; pendingMessages: number; queuedMessages: number } {
    let totalHandlers = 0
    for (const handlers of this.handlers.values()) {
      totalHandlers += handlers.size
    }

    return {
      handlers: totalHandlers,
      pendingMessages: this.pendingMessages.size,
      queuedMessages: this.messageQueue.length
    }
  }

  dispose(): void {
    this.logger.info("Disposing MessageBus")
    this.handlers.clear()
    this.pendingMessages.clear()
    this.messageQueue = []
  }
}
