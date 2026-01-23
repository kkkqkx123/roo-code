import type {
  TaskCreate,
  TaskCancel,
  TaskClear,
  TaskAskResponse,
  TaskDeleteMessageConfirm,
  TaskEditMessageConfirm,
  TaskHumanRelayResponse,
  TaskHumanRelayCancel,
  TaskCancelAutoApproval,
  SettingsGet,
  SettingsUpdate,
  SettingsUpdateCustomInstructions,
  SettingsUpdateMode,
  MCPToggle,
  MCPRestart,
  MCPRefreshAll,
  MCPToggleToolAlwaysAllow,
  MCPToggleToolEnabledForPrompt,
  MCPUpdateTimeout,
  MCPDeleteServer,
  BrowserTestConnection,
  BrowserKillSession,
  BrowserOpenSessionPanel,
  BrowserShowSessionPanelAtStep,
  BrowserRefreshSessionPanel,
  CheckpointDiff,
  CheckpointRestore,
  CommandRequestCommands,
  CommandOpenCommandFile,
  CommandDeleteCommand,
  CommandCreateCommand,
  FileOpenFile,
  FileSaveImage,
  FileOpenImage,
  FileSelectImages,
  FileSearchFiles,
  GitSearchCommits,
  CodeIndexRequestStatus,
  CodeIndexStartIndexing,
  CodeIndexClearIndexData,
  CodeIndexSaveSettings,
  CodeIndexRequestSecretStatus,
  ModeUpdateCustomMode,
  ModeDeleteCustomMode,
  ModeImportMode,
  ModeExportMode,
  ModeOpenCustomModesSettings,
  TerminalOperation,
  AudioPlaySound,
  AudioPlayTTS,
  AudioStopTTS,
  AudioSetTTSEnabled,
  AudioSetTTSSpeed,
  SystemWebviewDidLaunch,
  SystemDidShowAnnouncement,
  SystemFocusPanelRequest,
  SystemOpenExternal,
  HistoryShowTaskWithId,
  HistoryDeleteTaskWithId,
  HistoryExportTaskWithId,
  HistoryExportCurrentTask,
  HistoryShareCurrentTask,
  HistoryDeleteMultipleTasksWithIds,
  MessageQueueQueueMessage,
  MessageQueueRemoveQueuedMessage,
  MessageQueueEditQueuedMessage,
  TodoUpdateTodoList,
  CloudCloudButtonClicked,
  CloudRooCloudSignIn,
  CloudCloudLandingPageSignIn,
  CloudRooCloudSignOut,
  CloudRooCloudManualUrl,
  CloudClaudeCodeSignIn,
  CloudClaudeCodeSignOut,
  CloudSwitchOrganization,
  ContextCondenseTaskContextRequest,
  UpsellDismissUpsell,
  UpsellGetDismissedUpsells,
  VSCodeUpdateSetting,
  VSCodeGetSetting,
  VSCodeOpenKeyboardShortcuts,
  APIConfigSaveConfiguration,
  APIConfigUpsertConfiguration,
  APIConfigDeleteConfiguration,
  APIConfigLoadConfiguration,
  APIConfigLoadConfigurationById,
  APIConfigRenameConfiguration,
  APIConfigGetListConfiguration,
  APIConfigSetCurrentConfigurationName,
  APIConfigSetPassword,
  APIConfigTogglePin,
  APIConfigRequestOpenAIModels,
  PromptUpdatePrompt,
  PromptGetSystemPrompt,
  PromptCopySystemPrompt,
  PromptEnhancePrompt,
  ImportExportImportSettings,
  ImportExportExportSettings,
  ImportExportResetState,
  TabSwitchTab,
  RemoteControlSetRemoteControlEnabled,
  RemoteControlSetTaskSyncEnabled,
  DebugOpenDebugApiHistory,
  DebugOpenDebugUiHistory,
  DebugDownloadErrorDiagnostics,
  WebviewRequestMessage
} from "@shared/schemas/MessageTypes"

export class MessageBuilder {
  static createTask(text: string, images?: string[]): TaskCreate {
    return {
      type: "task.create",
      text,
      images
    }
  }

  static cancelTask(taskId: string): TaskCancel {
    return {
      type: "task.cancel",
      taskId
    }
  }

  static cancelAutoApproval(): TaskCancelAutoApproval {
    return {
      type: "task.cancelAutoApproval"
    }
  }

  static clearTask(): TaskClear {
    return {
      type: "task.clear"
    }
  }

  static askResponse(
    askResponse: "yesButtonClicked" | "noButtonClicked" | "messageResponse" | "objectResponse",
    text?: string,
    images?: string[]
  ): TaskAskResponse {
    return {
      type: "task.askResponse",
      askResponse,
      text,
      images
    }
  }

  static deleteMessageConfirm(messageTs: number, restoreCheckpoint?: boolean): TaskDeleteMessageConfirm {
    return {
      type: "task.deleteMessageConfirm",
      messageTs,
      restoreCheckpoint
    }
  }

  static editMessageConfirm(
    messageTs: number,
    text: string,
    restoreCheckpoint?: boolean,
    images?: string[]
  ): TaskEditMessageConfirm {
    return {
      type: "task.editMessageConfirm",
      messageTs,
      text,
      restoreCheckpoint,
      images
    }
  }

  static humanRelayResponse(requestId: string, text: string): TaskHumanRelayResponse {
    return {
      type: "task.humanRelayResponse",
      requestId,
      text
    }
  }

  static humanRelayCancel(requestId: string): TaskHumanRelayCancel {
    return {
      type: "task.humanRelayCancel",
      requestId
    }
  }

  static getSettings(): SettingsGet {
    return {
      type: "settings.get"
    }
  }

  static updateSettings(settings: Record<string, any>): SettingsUpdate {
    return {
      type: "settings.update",
      settings
    }
  }

  static updateCustomInstructions(text?: string): SettingsUpdateCustomInstructions {
    return {
      type: "settings.updateCustomInstructions",
      text
    }
  }

  static updateMode(mode: string): SettingsUpdateMode {
    return {
      type: "settings.updateMode",
      mode
    }
  }

  static toggleMcpServer(serverName: string, enabled: boolean): MCPToggle {
    return {
      type: "mcp.toggle",
      serverName,
      enabled
    }
  }

  static restartMcpServer(serverName: string): MCPRestart {
    return {
      type: "mcp.restart",
      serverName
    }
  }

  static refreshAllMcpServers(): MCPRefreshAll {
    return {
      type: "mcp.refreshAll"
    }
  }

  static toggleToolAlwaysAllow(serverName: string, toolName: string, alwaysAllow: boolean): MCPToggleToolAlwaysAllow {
    return {
      type: "mcp.toggleToolAlwaysAllow",
      serverName,
      toolName,
      alwaysAllow
    }
  }

  static toggleToolEnabledForPrompt(serverName: string, toolName: string, isEnabled: boolean): MCPToggleToolEnabledForPrompt {
    return {
      type: "mcp.toggleToolEnabledForPrompt",
      serverName,
      toolName,
      isEnabled
    }
  }

  static updateMcpTimeout(serverName: string, timeout: number): MCPUpdateTimeout {
    return {
      type: "mcp.updateTimeout",
      serverName,
      timeout
    }
  }

  static deleteMcpServer(serverName: string): MCPDeleteServer {
    return {
      type: "mcp.deleteServer",
      serverName
    }
  }

  static testBrowserConnection(url?: string): BrowserTestConnection {
    return {
      type: "browser.testConnection",
      url
    }
  }

  static killBrowserSession(): BrowserKillSession {
    return {
      type: "browser.killSession"
    }
  }

  static openBrowserSessionPanel(): BrowserOpenSessionPanel {
    return {
      type: "browser.openSessionPanel"
    }
  }

  static showBrowserSessionPanelAtStep(stepIndex: number, forceShow?: boolean): BrowserShowSessionPanelAtStep {
    return {
      type: "browser.showSessionPanelAtStep",
      stepIndex,
      forceShow
    }
  }

  static refreshBrowserSessionPanel(): BrowserRefreshSessionPanel {
    return {
      type: "browser.refreshSessionPanel"
    }
  }

  static checkpointDiff(
    commitHash: string,
    mode: "full" | "checkpoint" | "from-init" | "to-current",
    ts?: number,
    previousCommitHash?: string
  ): CheckpointDiff {
    return {
      type: "checkpoint.diff",
      commitHash,
      mode,
      ts,
      previousCommitHash
    }
  }

  static checkpointRestore(
    commitHash: string,
    mode: "preview" | "restore",
    ts: number,
    restoreType?: "files_only" | "context_only" | "files_and_context",
    apiRequestId?: string
  ): CheckpointRestore {
    return {
      type: "checkpoint.restore",
      commitHash,
      mode,
      ts,
      restoreType,
      apiRequestId
    }
  }

  static requestCommands(): CommandRequestCommands {
    return {
      type: "command.requestCommands"
    }
  }

  static openCommandFile(source: "global" | "project" | "built-in", name: string): CommandOpenCommandFile {
    return {
      type: "command.openCommandFile",
      source,
      name
    }
  }

  static deleteCommand(source: "global" | "project" | "built-in", name: string): CommandDeleteCommand {
    return {
      type: "command.deleteCommand",
      source,
      name
    }
  }

  static createCommand(
    source: "global" | "project" | "built-in",
    name: string,
    description?: string,
    argumentHint?: string,
    content?: string
  ): CommandCreateCommand {
    return {
      type: "command.createCommand",
      source,
      name,
      description,
      argumentHint,
      content
    }
  }

  static openFile(path: string): FileOpenFile {
    return {
      type: "file.openFile",
      path
    }
  }

  static saveImage(dataUri: string): FileSaveImage {
    return {
      type: "file.saveImage",
      dataUri
    }
  }

  static openImage(dataUri: string): FileOpenImage {
    return {
      type: "file.openImage",
      dataUri
    }
  }

  static selectImages(): FileSelectImages {
    return {
      type: "file.selectImages"
    }
  }

  static searchFiles(query: string, include?: string, exclude?: string): FileSearchFiles {
    return {
      type: "file.searchFiles",
      query,
      include,
      exclude
    }
  }

  static searchCommits(query: string): GitSearchCommits {
    return {
      type: "git.searchCommits",
      query
    }
  }

  static requestCodeIndexStatus(): CodeIndexRequestStatus {
    return {
      type: "codeIndex.requestStatus"
    }
  }

  static startIndexing(): CodeIndexStartIndexing {
    return {
      type: "codeIndex.startIndexing"
    }
  }

  static clearIndexData(): CodeIndexClearIndexData {
    return {
      type: "codeIndex.clearIndexData"
    }
  }

  static saveCodeIndexSettings(settings: {
    codebaseIndexEnabled: boolean
    codebaseIndexQdrantUrl: string
    codebaseIndexEmbedderProvider: "openai" | "openai-compatible" | "gemini"
    codebaseIndexEmbedderBaseUrl?: string
    codebaseIndexEmbedderModelId: string
    codebaseIndexEmbedderModelDimension?: number
    codebaseIndexOpenAiCompatibleBaseUrl?: string
    codebaseIndexSearchMaxResults?: number
    codebaseIndexSearchMinScore?: number
    codebaseIndexRequireIndexingConfirmation?: boolean
  }): CodeIndexSaveSettings {
    return {
      type: "codeIndex.saveSettings",
      settings
    }
  }

  static requestCodeIndexSecretStatus(): CodeIndexRequestSecretStatus {
    return {
      type: "codeIndex.requestSecretStatus"
    }
  }

  static updateCustomMode(slug: string, modeConfig: any): ModeUpdateCustomMode {
    return {
      type: "mode.updateCustomMode",
      slug,
      modeConfig
    }
  }

  static deleteCustomMode(slug: string, checkOnly?: boolean): ModeDeleteCustomMode {
    return {
      type: "mode.deleteCustomMode",
      slug,
      checkOnly
    }
  }

  static importMode(modeConfig: any): ModeImportMode {
    return {
      type: "mode.importMode",
      modeConfig
    }
  }

  static exportMode(slug: string): ModeExportMode {
    return {
      type: "mode.exportMode",
      slug
    }
  }

  static openCustomModesSettings(): ModeOpenCustomModesSettings {
    return {
      type: "mode.openCustomModesSettings"
    }
  }

  static terminalOperation(terminalOperation: "continue" | "abort"): TerminalOperation {
    return {
      type: "terminal.operation",
      terminalOperation
    }
  }

  static playSound(audioType: "notification" | "celebration" | "progress_loop"): AudioPlaySound {
    return {
      type: "audio.playSound",
      audioType
    }
  }

  static playTTS(text: string): AudioPlayTTS {
    return {
      type: "audio.playTTS",
      text
    }
  }

  static stopTTS(): AudioStopTTS {
    return {
      type: "audio.stopTTS"
    }
  }

  static setTTSEnabled(enabled: boolean): AudioSetTTSEnabled {
    return {
      type: "audio.setTTSEnabled",
      enabled
    }
  }

  static setTTSSpeed(speed: number): AudioSetTTSSpeed {
    return {
      type: "audio.setTTSSpeed",
      speed
    }
  }

  static webviewDidLaunch(): SystemWebviewDidLaunch {
    return {
      type: "system.webviewDidLaunch"
    }
  }

  static didShowAnnouncement(): SystemDidShowAnnouncement {
    return {
      type: "system.didShowAnnouncement"
    }
  }

  static focusPanelRequest(): SystemFocusPanelRequest {
    return {
      type: "system.focusPanelRequest"
    }
  }

  static openExternal(url: string): SystemOpenExternal {
    return {
      type: "system.openExternal",
      url
    }
  }

  static showTaskWithId(taskId: string): HistoryShowTaskWithId {
    return {
      type: "history.showTaskWithId",
      taskId
    }
  }

  static deleteTaskWithId(taskId: string): HistoryDeleteTaskWithId {
    return {
      type: "history.deleteTaskWithId",
      taskId
    }
  }

  static exportTaskWithId(taskId: string): HistoryExportTaskWithId {
    return {
      type: "history.exportTaskWithId",
      taskId
    }
  }

  static exportCurrentTask(): HistoryExportCurrentTask {
    return {
      type: "history.exportCurrentTask"
    }
  }

  static shareCurrentTask(): HistoryShareCurrentTask {
    return {
      type: "history.shareCurrentTask"
    }
  }

  static deleteMultipleTasksWithIds(ids: string[]): HistoryDeleteMultipleTasksWithIds {
    return {
      type: "history.deleteMultipleTasksWithIds",
      ids
    }
  }

  static queueMessage(text: string, images?: string[]): MessageQueueQueueMessage {
    return {
      type: "messageQueue.queueMessage",
      text,
      images
    }
  }

  static removeQueuedMessage(text: string): MessageQueueRemoveQueuedMessage {
    return {
      type: "messageQueue.removeQueuedMessage",
      text
    }
  }

  static editQueuedMessage(payload: {
    id: string
    text: string
    images?: string[]
  }): MessageQueueEditQueuedMessage {
    return {
      type: "messageQueue.editQueuedMessage",
      payload
    }
  }

  static updateTodoList(todos: any[]): TodoUpdateTodoList {
    return {
      type: "todo.updateTodoList",
      todos
    }
  }

  static cloudButtonClicked(): CloudCloudButtonClicked {
    return {
      type: "cloud.buttonClicked"
    }
  }

  static rooCloudSignIn(useProviderSignup?: boolean): CloudRooCloudSignIn {
    return {
      type: "cloud.rooCloudSignIn",
      useProviderSignup
    }
  }

  static cloudLandingPageSignIn(): CloudCloudLandingPageSignIn {
    return {
      type: "cloud.cloudLandingPageSignIn"
    }
  }

  static rooCloudSignOut(): CloudRooCloudSignOut {
    return {
      type: "cloud.rooCloudSignOut"
    }
  }

  static rooCloudManualUrl(url: string): CloudRooCloudManualUrl {
    return {
      type: "cloud.rooCloudManualUrl",
      url
    }
  }

  static claudeCodeSignIn(): CloudClaudeCodeSignIn {
    return {
      type: "cloud.claudeCodeSignIn"
    }
  }

  static claudeCodeSignOut(): CloudClaudeCodeSignOut {
    return {
      type: "cloud.claudeCodeSignOut"
    }
  }

  static switchOrganization(organizationId: string | null): CloudSwitchOrganization {
    return {
      type: "cloud.switchOrganization",
      organizationId
    }
  }

  static condenseTaskContextRequest(text?: string): ContextCondenseTaskContextRequest {
    return {
      type: "context.condenseTaskContextRequest",
      text
    }
  }

  static dismissUpsell(upsellId: string): UpsellDismissUpsell {
    return {
      type: "upsell.dismissUpsell",
      upsellId
    }
  }

  static getDismissedUpsells(): UpsellGetDismissedUpsells {
    return {
      type: "upsell.getDismissedUpsells"
    }
  }

  static updateVSCodeSetting(setting: string, value: any): VSCodeUpdateSetting {
    return {
      type: "vscode.updateSetting",
      setting,
      value
    }
  }

  static getVSCodeSetting(setting: string): VSCodeGetSetting {
    return {
      type: "vscode.getSetting",
      setting
    }
  }

  static openKeyboardShortcuts(): VSCodeOpenKeyboardShortcuts {
    return {
      type: "vscode.openKeyboardShortcuts"
    }
  }

  static saveApiConfiguration(apiConfiguration: any): APIConfigSaveConfiguration {
    return {
      type: "apiConfig.saveConfiguration",
      apiConfiguration
    }
  }

  static upsertApiConfiguration(name: string, apiConfiguration: any): APIConfigUpsertConfiguration {
    return {
      type: "apiConfig.upsertConfiguration",
      name,
      apiConfiguration
    }
  }

  static deleteApiConfiguration(name: string): APIConfigDeleteConfiguration {
    return {
      type: "apiConfig.deleteConfiguration",
      name
    }
  }

  static loadApiConfiguration(name: string): APIConfigLoadConfiguration {
    return {
      type: "apiConfig.loadConfiguration",
      name
    }
  }

  static loadApiConfigurationById(id: string): APIConfigLoadConfigurationById {
    return {
      type: "apiConfig.loadConfigurationById",
      id
    }
  }

  static renameApiConfiguration(oldName: string, newName: string): APIConfigRenameConfiguration {
    return {
      type: "apiConfig.renameConfiguration",
      oldName,
      newName
    }
  }

  static getListApiConfiguration(): APIConfigGetListConfiguration {
    return {
      type: "apiConfig.getListConfiguration"
    }
  }

  static setCurrentApiConfigurationName(name: string): APIConfigSetCurrentConfigurationName {
    return {
      type: "apiConfig.setCurrentConfigurationName",
      name
    }
  }

  static setApiConfigurationPassword(name: string, password: string): APIConfigSetPassword {
    return {
      type: "apiConfig.setPassword",
      name,
      password
    }
  }

  static toggleApiConfigPin(name: string): APIConfigTogglePin {
    return {
      type: "apiConfig.togglePin",
      name
    }
  }

  static requestOpenAIModels(): APIConfigRequestOpenAIModels {
    return {
      type: "apiConfig.requestOpenAIModels"
    }
  }

  static updatePrompt(promptMode: "enhance" | string, customPrompt?: any): PromptUpdatePrompt {
    return {
      type: "prompt.updatePrompt",
      promptMode,
      customPrompt
    }
  }

  static getSystemPrompt(mode?: string): PromptGetSystemPrompt {
    return {
      type: "prompt.getSystemPrompt",
      mode
    }
  }

  static copySystemPrompt(mode?: string): PromptCopySystemPrompt {
    return {
      type: "prompt.copySystemPrompt",
      mode
    }
  }

  static enhancePrompt(text: string): PromptEnhancePrompt {
    return {
      type: "prompt.enhancePrompt",
      text
    }
  }

  static importSettings(): ImportExportImportSettings {
    return {
      type: "importExport.importSettings"
    }
  }

  static exportSettings(): ImportExportExportSettings {
    return {
      type: "importExport.exportSettings"
    }
  }

  static resetState(): ImportExportResetState {
    return {
      type: "importExport.resetState"
    }
  }

  static switchTab(
    tab: "settings" | "history" | "mcp" | "modes" | "chat" | "cloud",
    section?: string
  ): TabSwitchTab {
    return {
      type: "tab.switchTab",
      tab,
      section
    }
  }

  static setRemoteControlEnabled(enabled: boolean): RemoteControlSetRemoteControlEnabled {
    return {
      type: "remoteControl.setEnabled",
      enabled
    }
  }

  static setTaskSyncEnabled(enabled: boolean): RemoteControlSetTaskSyncEnabled {
    return {
      type: "remoteControl.setTaskSyncEnabled",
      enabled
    }
  }

  static openDebugApiHistory(): DebugOpenDebugApiHistory {
    return {
      type: "debug.openDebugApiHistory"
    }
  }

  static openDebugUiHistory(): DebugOpenDebugUiHistory {
    return {
      type: "debug.openDebugUiHistory"
    }
  }

  static downloadErrorDiagnostics(): DebugDownloadErrorDiagnostics {
    return {
      type: "debug.downloadErrorDiagnostics"
    }
  }
}
