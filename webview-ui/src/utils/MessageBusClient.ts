import type { WebviewRequestMessage, ExtensionResponseMessage } from "@shared/MessageTypes"
import type { WebviewMessage } from "@shared/WebviewMessage"
import { vscode } from "./vscode"

export interface MessageRequestOptions {
  timeout?: number
  expectResponse?: boolean
}

export class MessageBusClient {
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void
    reject: (error: Error) => void
    timeout: NodeJS.Timeout
  }>()

  private readonly defaultTimeout = 30000

  constructor() {
    this.setupMessageListener()
    console.debug("[MessageBusClient] Initialized")
  }

  private setupMessageListener(): void {
    window.addEventListener("message", (event: MessageEvent) => {
      const message = event.data as ExtensionResponseMessage & { requestId?: string }

      if (message.requestId && this.pendingRequests.has(message.requestId)) {
        const { resolve, reject, timeout } = this.pendingRequests.get(message.requestId)!

        clearTimeout(timeout)
        this.pendingRequests.delete(message.requestId)

        if ((message as any).error) {
          reject(new Error((message as any).error))
        } else {
          resolve(message)
        }
      }
    })

    console.debug("[MessageBusClient] Message listener set up")
  }

  async send<T = any>(
    message: WebviewRequestMessage,
    options: MessageRequestOptions = {}
  ): Promise<T> {
    const { timeout = this.defaultTimeout, expectResponse = true } = options

    if (!expectResponse) {
      vscode.postMessage(this.convertToWebviewMessage(message))
      console.debug(`[MessageBusClient] Sent message (no response expected): ${message.type}`)
      return undefined as T
    }

    const requestId = this.generateRequestId()
    const messageWithId = { ...message, requestId, timestamp: Date.now() }

    console.debug(`[MessageBusClient] Sending message: ${message.type} with requestId: ${requestId}`)

    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error(`Message timeout: ${message.type}`))
        console.warn(`[MessageBusClient] Message timeout: ${message.type}`)
      }, timeout)

      this.pendingRequests.set(requestId, { resolve, reject, timeout: timeoutId })
      vscode.postMessage(this.convertToWebviewMessage(messageWithId))
    })
  }

  private convertToWebviewMessage(message: WebviewRequestMessage | (WebviewRequestMessage & { requestId?: string; timestamp?: number })): WebviewMessage {
    const baseMessage: any = {
      type: message.type
    }

    if ("requestId" in message) {
      baseMessage.requestId = message.requestId
    }
    if ("timestamp" in message) {
      baseMessage.timestamp = message.timestamp
    }

    switch (message.type) {
      case "task.create":
        return { ...baseMessage, text: message.text, images: message.images } as any
      case "task.cancel":
        return { ...baseMessage, taskId: message.taskId } as any
      case "task.clear":
        return baseMessage
      case "task.askResponse":
        return { ...baseMessage, askResponse: message.askResponse, text: message.text, images: message.images } as any
      case "settings.get":
        return baseMessage
      case "settings.update":
        return { ...baseMessage, settings: message.settings } as any
      case "settings.updateCustomInstructions":
        return { ...baseMessage, text: message.text } as any
      case "settings.updateMode":
        return { ...baseMessage, mode: message.mode } as any
      case "mcp.toggle":
        return { ...baseMessage, serverName: message.serverName, isEnabled: message.enabled } as any
      case "mcp.restart":
        return { ...baseMessage, serverName: message.serverName } as any
      case "mcp.refreshAll":
        return baseMessage
      case "mcp.toggleToolAlwaysAllow":
        return { ...baseMessage, serverName: message.serverName, toolName: message.toolName, alwaysAllow: message.alwaysAllow } as any
      case "mcp.toggleToolEnabledForPrompt":
        return { ...baseMessage, serverName: message.serverName, toolName: message.toolName, isEnabled: message.isEnabled } as any
      case "mcp.updateTimeout":
        return { ...baseMessage, serverName: message.serverName, timeout: message.timeout } as any
      case "mcp.deleteServer":
        return { ...baseMessage, serverName: message.serverName } as any
      case "browser.testConnection":
        return { ...baseMessage, url: message.url } as any
      case "browser.killSession":
        return baseMessage
      case "browser.openSessionPanel":
        return baseMessage
      case "browser.showSessionPanelAtStep":
        return { ...baseMessage, stepIndex: message.stepIndex, forceShow: message.forceShow } as any
      case "browser.refreshSessionPanel":
        return baseMessage
      case "checkpoint.diff":
        return { ...baseMessage, commitHash: message.commitHash, mode: message.mode, ts: message.ts, previousCommitHash: message.previousCommitHash } as any
      case "checkpoint.restore":
        return { ...baseMessage, commitHash: message.commitHash, mode: message.mode, restoreType: message.restoreType, ts: message.ts, apiRequestId: message.apiRequestId } as any
      case "command.requestCommands":
        return baseMessage
      case "command.openCommandFile":
        return { ...baseMessage, source: message.source, name: message.name } as any
      case "command.deleteCommand":
        return { ...baseMessage, source: message.source, name: message.name } as any
      case "command.createCommand":
        return { ...baseMessage, source: message.source, name: message.name, description: message.description, argumentHint: message.argumentHint, content: message.content } as any
      case "file.openFile":
        return { ...baseMessage, path: message.path } as any
      case "file.saveImage":
        return { ...baseMessage, dataUri: message.dataUri } as any
      case "file.openImage":
        return { ...baseMessage, dataUri: message.dataUri } as any
      case "file.selectImages":
        return baseMessage
      case "file.searchFiles":
        return { ...baseMessage, query: message.query, include: message.include, exclude: message.exclude } as any
      case "git.searchCommits":
        return { ...baseMessage, query: message.query } as any
      case "codeIndex.requestStatus":
        return baseMessage
      case "codeIndex.startIndexing":
        return baseMessage
      case "codeIndex.clearIndexData":
        return baseMessage
      case "codeIndex.saveSettings":
        return { ...baseMessage, settings: message.settings } as any
      case "codeIndex.requestSecretStatus":
        return baseMessage
      case "mode.updateCustomMode":
        return { ...baseMessage, slug: message.slug, modeConfig: message.modeConfig } as any
      case "mode.deleteCustomMode":
        return { ...baseMessage, slug: message.slug, checkOnly: message.checkOnly } as any
      case "mode.importMode":
        return { ...baseMessage, modeConfig: message.modeConfig } as any
      case "mode.exportMode":
        return { ...baseMessage, slug: message.slug } as any
      case "mode.openCustomModesSettings":
        return baseMessage
      case "terminal.operation":
        return { ...baseMessage, terminalOperation: message.terminalOperation } as any
      case "audio.playSound":
        return { ...baseMessage, audioType: message.audioType } as any
      case "audio.playTTS":
        return { ...baseMessage, text: message.text } as any
      case "audio.stopTTS":
        return baseMessage
      case "audio.setTTSEnabled":
        return { ...baseMessage, isEnabled: message.enabled } as any
      case "audio.setTTSSpeed":
        return { ...baseMessage, value: message.speed } as any
      case "system.webviewDidLaunch":
        return baseMessage
      case "system.didShowAnnouncement":
        return baseMessage
      case "system.focusPanelRequest":
        return baseMessage
      case "system.openExternal":
        return { ...baseMessage, url: message.url } as any
      case "history.showTaskWithId":
        return { ...baseMessage, taskId: message.taskId } as any
      case "history.deleteTaskWithId":
        return { ...baseMessage, taskId: message.taskId } as any
      case "history.exportTaskWithId":
        return { ...baseMessage, taskId: message.taskId } as any
      case "history.exportCurrentTask":
        return baseMessage
      case "history.shareCurrentTask":
        return baseMessage
      case "history.deleteMultipleTasksWithIds":
        return { ...baseMessage, ids: message.ids } as any
      case "messageQueue.queueMessage":
        return { ...baseMessage, text: message.text, images: message.images } as any
      case "messageQueue.removeQueuedMessage":
        return { ...baseMessage, text: message.text } as any
      case "messageQueue.editQueuedMessage":
        return { ...baseMessage, payload: message.payload } as any
      case "todo.updateTodoList":
        return { ...baseMessage, todos: message.todos } as any
      case "cloud.buttonClicked":
        return baseMessage
      case "cloud.rooCloudSignIn":
        return { ...baseMessage, useProviderSignup: message.useProviderSignup } as any
      case "cloud.cloudLandingPageSignIn":
        return baseMessage
      case "cloud.rooCloudSignOut":
        return baseMessage
      case "cloud.rooCloudManualUrl":
        return { ...baseMessage, url: message.url } as any
      case "cloud.claudeCodeSignIn":
        return baseMessage
      case "cloud.claudeCodeSignOut":
        return baseMessage
      case "cloud.switchOrganization":
        return { ...baseMessage, organizationId: message.organizationId } as any
      case "context.condenseTaskContextRequest":
        return { ...baseMessage, text: message.text } as any
      case "upsell.dismissUpsell":
        return { ...baseMessage, upsellId: message.upsellId } as any
      case "upsell.getDismissedUpsells":
        return baseMessage
      case "vscode.updateSetting":
        return { ...baseMessage, setting: message.setting, value: message.value } as any
      case "vscode.getSetting":
        return { ...baseMessage, setting: message.setting } as any
      case "vscode.openKeyboardShortcuts":
        return baseMessage
      case "apiConfig.saveConfiguration":
        return { ...baseMessage, apiConfiguration: message.apiConfiguration } as any
      case "apiConfig.upsertConfiguration":
        return { ...baseMessage, name: message.name, apiConfiguration: message.apiConfiguration } as any
      case "apiConfig.deleteConfiguration":
        return { ...baseMessage, name: message.name } as any
      case "apiConfig.loadConfiguration":
        return { ...baseMessage, name: message.name } as any
      case "apiConfig.loadConfigurationById":
        return { ...baseMessage, id: message.id } as any
      case "apiConfig.renameConfiguration":
        return { ...baseMessage, oldName: message.oldName, newName: message.newName } as any
      case "apiConfig.getListConfiguration":
        return baseMessage
      case "apiConfig.setCurrentConfigurationName":
        return { ...baseMessage, name: message.name } as any
      case "apiConfig.setPassword":
        return { ...baseMessage, name: message.name, password: message.password } as any
      case "apiConfig.togglePin":
        return { ...baseMessage, name: message.name } as any
      case "apiConfig.requestOpenAIModels":
        return baseMessage
      case "prompt.updatePrompt":
        return { ...baseMessage, promptMode: message.promptMode, customPrompt: message.customPrompt } as any
      case "prompt.getSystemPrompt":
        return { ...baseMessage, mode: message.mode } as any
      case "prompt.copySystemPrompt":
        return { ...baseMessage, mode: message.mode } as any
      case "prompt.enhancePrompt":
        return { ...baseMessage, text: message.text } as any
      case "importExport.importSettings":
        return baseMessage
      case "importExport.exportSettings":
        return baseMessage
      case "importExport.resetState":
        return baseMessage
      case "tab.switchTab":
        return { ...baseMessage, tab: message.tab, section: message.section } as any
      case "remoteControl.setEnabled":
        return { ...baseMessage, isEnabled: message.enabled } as any
      case "remoteControl.setTaskSyncEnabled":
        return { ...baseMessage, isEnabled: message.enabled } as any
      case "debug.openDebugApiHistory":
        return baseMessage
      case "debug.openDebugUiHistory":
        return baseMessage
      case "debug.downloadErrorDiagnostics":
        return baseMessage
      default:
        return baseMessage as any
    }
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  dispose(): void {
    console.debug("[MessageBusClient] Disposing")
    for (const { timeout, reject } of this.pendingRequests.values()) {
      clearTimeout(timeout)
      reject(new Error("MessageBusClient disposed"))
    }
    this.pendingRequests.clear()
  }
}

export const messageBusClient = new MessageBusClient()
