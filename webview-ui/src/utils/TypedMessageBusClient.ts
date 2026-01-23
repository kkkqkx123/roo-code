import type { WebviewRequestMessage } from "@shared/schemas/MessageTypes"
import { schemaRegistry } from "@shared/schemas/SchemaRegistry"
import { vscode } from "./vscode"

export interface MessageRequestOptions {
  timeout?: number
  expectResponse?: boolean
}

export class TypedMessageBusClient {
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void
    reject: (error: Error) => void
    timeout: NodeJS.Timeout
  }>()

  private readonly defaultTimeout = 30000

  constructor() {
    this.setupMessageListener()
    console.debug("[TypedMessageBusClient] Initialized")
  }

  private setupMessageListener(): void {
    window.addEventListener("message", (event: MessageEvent) => {
      const message = event.data as any & { requestId?: string }

      if (message.requestId && this.pendingRequests.has(message.requestId)) {
        const { resolve, reject, timeout } = this.pendingRequests.get(message.requestId)!

        clearTimeout(timeout)
        this.pendingRequests.delete(message.requestId)

        if (message.error) {
          reject(new Error(message.error))
        } else {
          resolve(message)
        }
      }
    })

    console.debug("[TypedMessageBusClient] Message listener set up")
  }

  async send<T = any>(
    message: WebviewRequestMessage,
    options: MessageRequestOptions = {}
  ): Promise<T> {
    const { timeout = this.defaultTimeout, expectResponse = true } = options

    this.validateMessage(message)

    if (!expectResponse) {
      vscode.postMessage(message)
      console.debug(`[TypedMessageBusClient] Sent message (no response expected): ${message.type}`)
      return undefined as T
    }

    const requestId = this.generateRequestId()
    const messageWithId = { ...message, requestId, timestamp: Date.now() }

    console.debug(`[TypedMessageBusClient] Sending message: ${message.type} with requestId: ${requestId}`)

    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error(`Message timeout: ${message.type}`))
        console.warn(`[TypedMessageBusClient] Message timeout: ${message.type}`)
      }, timeout)

      this.pendingRequests.set(requestId, { resolve, reject, timeout: timeoutId })
      vscode.postMessage(messageWithId)
    })
  }

  private validateMessage(message: WebviewRequestMessage): void {
    try {
      schemaRegistry.validate(message.type, message)
      console.debug(`[TypedMessageBusClient] Message validated: ${message.type}`)
    } catch (error) {
      console.error(`[TypedMessageBusClient] Message validation failed for type ${message.type}:`, error)
      throw new Error(`Invalid message format for type ${message.type}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  dispose(): void {
    console.debug("[TypedMessageBusClient] Disposing")
    for (const { timeout, reject } of this.pendingRequests.values()) {
      clearTimeout(timeout)
      reject(new Error("TypedMessageBusClient disposed"))
    }
    this.pendingRequests.clear()
  }
}

export const typedMessageBusClient = new TypedMessageBusClient()
