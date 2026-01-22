import { MessageBusServer } from "./MessageBusServer"
import { ClineProvider } from "../webview/ClineProvider"
import { webviewMessageHandler } from "../webview/webviewMessageHandler"
import type { WebviewMessage } from "../../shared/WebviewMessage"
import { createLogger } from "../../utils/logger"
import * as vscode from "vscode"

export class MessageBusIntegration {
  private messageBus: MessageBusServer
  private provider: ClineProvider
  private logger: ReturnType<typeof createLogger>
  private outputChannel: vscode.OutputChannel

  constructor(messageBus: MessageBusServer, provider: ClineProvider, outputChannel: vscode.OutputChannel) {
    this.messageBus = messageBus
    this.provider = provider
    this.outputChannel = outputChannel
    this.logger = createLogger(outputChannel, "MessageBusIntegration")
  }

  async handleMessage(message: WebviewMessage): Promise<void> {
    this.logger.debug(`Handling message: ${message.type}`)

    try {
      const result = await this.messageBus.handle(message)
      this.logger.debug(`Message handled successfully: ${message.type}`)
    } catch (error) {
      this.logger.error(`Error handling message ${message.type}:`, error)
    }
  }

  async postMessage(message: any): Promise<boolean> {
    this.logger.debug(`Posting message: ${message.type}`)
    return await this.messageBus.publish(message)
  }

  processQueuedMessages(): Promise<void> {
    return this.messageBus.processQueuedMessages()
  }

  getStats(): { handlers: number; pendingMessages: number; queuedMessages: number } {
    return this.messageBus.getStats()
  }

  dispose(): void {
    this.logger.info("Disposing MessageBusIntegration")
    this.messageBus.dispose()
  }
}
