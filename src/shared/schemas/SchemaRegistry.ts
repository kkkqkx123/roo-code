import { z } from "zod"
import * as Schemas from "./MessageSchemas"

export class SchemaRegistry {
  private static instance: SchemaRegistry
  private schemas = new Map<string, z.ZodSchema>()

  private constructor() {
    this.registerSchemas()
  }

  static getInstance(): SchemaRegistry {
    if (!SchemaRegistry.instance) {
      SchemaRegistry.instance = new SchemaRegistry()
    }
    return SchemaRegistry.instance
  }

  private registerSchemas(): void {
    this.register("task.create", Schemas.TaskSchemas.create)
    this.register("task.cancel", Schemas.TaskSchemas.cancel)
    this.register("task.clear", Schemas.TaskSchemas.clear)
    this.register("task.askResponse", Schemas.TaskSchemas.askResponse)
    this.register("task.deleteMessageConfirm", Schemas.TaskSchemas.deleteMessageConfirm)
    this.register("task.editMessageConfirm", Schemas.TaskSchemas.editMessageConfirm)
    this.register("task.humanRelayResponse", Schemas.TaskSchemas.humanRelayResponse)
    this.register("task.humanRelayCancel", Schemas.TaskSchemas.humanRelayCancel)

    this.register("settings.get", Schemas.SettingsSchemas.get)
    this.register("settings.update", Schemas.SettingsSchemas.update)
    this.register("settings.updateCustomInstructions", Schemas.SettingsSchemas.updateCustomInstructions)
    this.register("settings.updateMode", Schemas.SettingsSchemas.updateMode)

    this.register("mcp.toggle", Schemas.MCPSchemas.toggle)
    this.register("mcp.restart", Schemas.MCPSchemas.restart)
    this.register("mcp.refreshAll", Schemas.MCPSchemas.refreshAll)
    this.register("mcp.toggleToolAlwaysAllow", Schemas.MCPSchemas.toggleToolAlwaysAllow)
    this.register("mcp.toggleToolEnabledForPrompt", Schemas.MCPSchemas.toggleToolEnabledForPrompt)
    this.register("mcp.updateTimeout", Schemas.MCPSchemas.updateTimeout)
    this.register("mcp.deleteServer", Schemas.MCPSchemas.deleteServer)

    this.register("browser.testConnection", Schemas.BrowserSchemas.testConnection)
    this.register("browser.killSession", Schemas.BrowserSchemas.killSession)
    this.register("browser.openSessionPanel", Schemas.BrowserSchemas.openSessionPanel)
    this.register("browser.showSessionPanelAtStep", Schemas.BrowserSchemas.showSessionPanelAtStep)
    this.register("browser.refreshSessionPanel", Schemas.BrowserSchemas.refreshSessionPanel)

    this.register("checkpoint.diff", Schemas.CheckpointSchemas.diff)
    this.register("checkpoint.restore", Schemas.CheckpointSchemas.restore)

    this.register("command.requestCommands", Schemas.CommandSchemas.requestCommands)
    this.register("command.openCommandFile", Schemas.CommandSchemas.openCommandFile)
    this.register("command.deleteCommand", Schemas.CommandSchemas.deleteCommand)
    this.register("command.createCommand", Schemas.CommandSchemas.createCommand)

    this.register("file.openFile", Schemas.FileSchemas.openFile)
    this.register("file.saveImage", Schemas.FileSchemas.saveImage)
    this.register("file.openImage", Schemas.FileSchemas.openImage)
    this.register("file.selectImages", Schemas.FileSchemas.selectImages)
    this.register("file.searchFiles", Schemas.FileSchemas.searchFiles)

    this.register("git.searchCommits", Schemas.GitSchemas.searchCommits)

    this.register("codeIndex.requestStatus", Schemas.CodeIndexSchemas.requestStatus)
    this.register("codeIndex.startIndexing", Schemas.CodeIndexSchemas.startIndexing)
    this.register("codeIndex.clearIndexData", Schemas.CodeIndexSchemas.clearIndexData)
    this.register("codeIndex.saveSettings", Schemas.CodeIndexSchemas.saveSettings)
    this.register("codeIndex.requestSecretStatus", Schemas.CodeIndexSchemas.requestSecretStatus)

    this.register("mode.updateCustomMode", Schemas.ModeSchemas.updateCustomMode)
    this.register("mode.deleteCustomMode", Schemas.ModeSchemas.deleteCustomMode)
    this.register("mode.importMode", Schemas.ModeSchemas.importMode)
    this.register("mode.exportMode", Schemas.ModeSchemas.exportMode)
    this.register("mode.openCustomModesSettings", Schemas.ModeSchemas.openCustomModesSettings)

    this.register("terminal.operation", Schemas.TerminalSchemas.operation)

    this.register("audio.playSound", Schemas.AudioSchemas.playSound)
    this.register("audio.playTTS", Schemas.AudioSchemas.playTTS)
    this.register("audio.stopTTS", Schemas.AudioSchemas.stopTTS)
    this.register("audio.setTTSEnabled", Schemas.AudioSchemas.setTTSEnabled)
    this.register("audio.setTTSSpeed", Schemas.AudioSchemas.setTTSSpeed)

    this.register("system.webviewDidLaunch", Schemas.SystemSchemas.webviewDidLaunch)
    this.register("system.didShowAnnouncement", Schemas.SystemSchemas.didShowAnnouncement)
    this.register("system.focusPanelRequest", Schemas.SystemSchemas.focusPanelRequest)
    this.register("system.openExternal", Schemas.SystemSchemas.openExternal)

    this.register("history.showTaskWithId", Schemas.HistorySchemas.showTaskWithId)
    this.register("history.deleteTaskWithId", Schemas.HistorySchemas.deleteTaskWithId)
    this.register("history.exportTaskWithId", Schemas.HistorySchemas.exportTaskWithId)
    this.register("history.exportCurrentTask", Schemas.HistorySchemas.exportCurrentTask)
    this.register("history.shareCurrentTask", Schemas.HistorySchemas.shareCurrentTask)
    this.register("history.deleteMultipleTasksWithIds", Schemas.HistorySchemas.deleteMultipleTasksWithIds)

    this.register("messageQueue.queueMessage", Schemas.MessageQueueSchemas.queueMessage)
    this.register("messageQueue.removeQueuedMessage", Schemas.MessageQueueSchemas.removeQueuedMessage)
    this.register("messageQueue.editQueuedMessage", Schemas.MessageQueueSchemas.editQueuedMessage)

    this.register("todo.updateTodoList", Schemas.TodoSchemas.updateTodoList)

    this.register("cloud.buttonClicked", Schemas.CloudSchemas.cloudButtonClicked)
    this.register("cloud.rooCloudSignIn", Schemas.CloudSchemas.rooCloudSignIn)
    this.register("cloud.cloudLandingPageSignIn", Schemas.CloudSchemas.cloudLandingPageSignIn)
    this.register("cloud.rooCloudSignOut", Schemas.CloudSchemas.rooCloudSignOut)
    this.register("cloud.rooCloudManualUrl", Schemas.CloudSchemas.rooCloudManualUrl)
    this.register("cloud.claudeCodeSignIn", Schemas.CloudSchemas.claudeCodeSignIn)
    this.register("cloud.claudeCodeSignOut", Schemas.CloudSchemas.claudeCodeSignOut)
    this.register("cloud.switchOrganization", Schemas.CloudSchemas.switchOrganization)

    this.register("context.condenseTaskContextRequest", Schemas.ContextSchemas.condenseTaskContextRequest)

    this.register("upsell.dismissUpsell", Schemas.UpsellSchemas.dismissUpsell)
    this.register("upsell.getDismissedUpsells", Schemas.UpsellSchemas.getDismissedUpsells)

    this.register("vscode.updateSetting", Schemas.VSCodeSchemas.updateSetting)
    this.register("vscode.getSetting", Schemas.VSCodeSchemas.getSetting)
    this.register("vscode.openKeyboardShortcuts", Schemas.VSCodeSchemas.openKeyboardShortcuts)

    this.register("apiConfig.saveConfiguration", Schemas.APIConfigSchemas.saveConfiguration)
    this.register("apiConfig.upsertConfiguration", Schemas.APIConfigSchemas.upsertConfiguration)
    this.register("apiConfig.deleteConfiguration", Schemas.APIConfigSchemas.deleteConfiguration)
    this.register("apiConfig.loadConfiguration", Schemas.APIConfigSchemas.loadConfiguration)
    this.register("apiConfig.loadConfigurationById", Schemas.APIConfigSchemas.loadConfigurationById)
    this.register("apiConfig.renameConfiguration", Schemas.APIConfigSchemas.renameConfiguration)
    this.register("apiConfig.getListConfiguration", Schemas.APIConfigSchemas.getListConfiguration)
    this.register("apiConfig.setCurrentConfigurationName", Schemas.APIConfigSchemas.setCurrentConfigurationName)
    this.register("apiConfig.setPassword", Schemas.APIConfigSchemas.setPassword)
    this.register("apiConfig.togglePin", Schemas.APIConfigSchemas.togglePin)
    this.register("apiConfig.requestOpenAIModels", Schemas.APIConfigSchemas.requestOpenAIModels)

    this.register("prompt.updatePrompt", Schemas.PromptSchemas.updatePrompt)
    this.register("prompt.getSystemPrompt", Schemas.PromptSchemas.getSystemPrompt)
    this.register("prompt.copySystemPrompt", Schemas.PromptSchemas.copySystemPrompt)
    this.register("prompt.enhancePrompt", Schemas.PromptSchemas.enhancePrompt)

    this.register("importExport.importSettings", Schemas.ImportExportSchemas.importSettings)
    this.register("importExport.exportSettings", Schemas.ImportExportSchemas.exportSettings)
    this.register("importExport.resetState", Schemas.ImportExportSchemas.resetState)

    this.register("tab.switchTab", Schemas.TabSchemas.switchTab)

    this.register("remoteControl.setEnabled", Schemas.RemoteControlSchemas.setRemoteControlEnabled)
    this.register("remoteControl.setTaskSyncEnabled", Schemas.RemoteControlSchemas.setTaskSyncEnabled)

    this.register("debug.openDebugApiHistory", Schemas.DebugSchemas.openDebugApiHistory)
    this.register("debug.openDebugUiHistory", Schemas.DebugSchemas.openDebugUiHistory)
    this.register("debug.downloadErrorDiagnostics", Schemas.DebugSchemas.downloadErrorDiagnostics)
  }

  register(messageType: string, schema: z.ZodSchema): void {
    this.schemas.set(messageType, schema)
  }

  get(messageType: string): z.ZodSchema | undefined {
    return this.schemas.get(messageType)
  }

  has(messageType: string): boolean {
    return this.schemas.has(messageType)
  }

  validate(messageType: string, data: unknown): any {
    const schema = this.get(messageType)
    if (!schema) {
      throw new Error(`No schema registered for message type: ${messageType}`)
    }
    return schema.parse(data)
  }
}

export const schemaRegistry = SchemaRegistry.getInstance()
