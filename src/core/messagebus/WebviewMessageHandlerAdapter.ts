import { ClineProvider } from "../webview/ClineProvider"
import { webviewMessageHandler } from "../webview/webviewMessageHandler"
import type { WebviewMessage } from "../../shared/WebviewMessage"
import * as vscode from "vscode"

export class WebviewMessageHandlerAdapter {
  private provider: ClineProvider
  private outputChannel: vscode.OutputChannel

  constructor(provider: ClineProvider, outputChannel: vscode.OutputChannel) {
    this.provider = provider
    this.outputChannel = outputChannel
  }

  async handle(message: WebviewMessage): Promise<any> {
    console.debug(`[WebviewMessageHandlerAdapter] Adapting message: ${message.type}`)

    try {
      await webviewMessageHandler(this.provider, message)
      console.debug(`[WebviewMessageHandlerAdapter] Message handled successfully: ${message.type}`)
      return { type: "success", requestId: (message as any).requestId }
    } catch (error) {
      console.error(`[WebviewMessageHandlerAdapter] Error handling message ${message.type}:`, error)
      throw error
    }
  }
}
