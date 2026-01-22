import * as vscode from "vscode"
import { MessageBus, type MessageBusOptions } from "./MessageBus"
import type { ExtensionResponseMessage } from "./MessageTypes"

export interface MessageBusServerOptions extends MessageBusOptions {
  webview?: vscode.WebviewView | vscode.WebviewPanel
}

export class MessageBusServer extends MessageBus {
  private webview?: vscode.WebviewView | vscode.WebviewPanel

  constructor(outputChannel: any, options: MessageBusServerOptions = {}) {
    super(outputChannel, options)
    this.webview = options.webview
    this.logger.info("MessageBusServer initialized")
  }

  setWebview(webview: vscode.WebviewView | vscode.WebviewPanel): void {
    this.webview = webview
    this.logger.info("Webview set in MessageBusServer")
  }

  protected override async sendMessage(message: ExtensionResponseMessage): Promise<void> {
    if (!this.webview) {
      throw new Error("Webview not available")
    }

    try {
      await this.webview.webview.postMessage(message)
      this.logger.debug(`Message sent to webview: ${message.type}`)
    } catch (error) {
      this.logger.error(`Failed to send message to webview: ${message.type}`, error)
      throw error
    }
  }

  async processQueuedMessages(): Promise<void> {
    if (!this.webview || this.pendingMessages.size === 0) {
      return
    }

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
  }

  override dispose(): void {
    this.logger.info("Disposing MessageBusServer")
    this.webview = undefined
    super.dispose()
  }
}
