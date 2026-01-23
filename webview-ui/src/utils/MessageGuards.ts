import type { WebviewRequestMessage } from "@shared/schemas/MessageTypes"
import type {
  TaskCreate,
  TaskCancel,
  TaskClear,
  TaskAskResponse,
  TaskDeleteMessageConfirm,
  TaskEditMessageConfirm,
  TaskHumanRelayResponse,
  TaskHumanRelayCancel,
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
  DebugDownloadErrorDiagnostics
} from "@shared/schemas/MessageTypes"

export function isTaskCreate(message: WebviewRequestMessage): message is TaskCreate {
  return message.type === "task.create"
}

export function isTaskCancel(message: WebviewRequestMessage): message is TaskCancel {
  return message.type === "task.cancel"
}

export function isTaskClear(message: WebviewRequestMessage): message is TaskClear {
  return message.type === "task.clear"
}

export function isTaskAskResponse(message: WebviewRequestMessage): message is TaskAskResponse {
  return message.type === "task.askResponse"
}

export function isTaskDeleteMessageConfirm(message: WebviewRequestMessage): message is TaskDeleteMessageConfirm {
  return message.type === "task.deleteMessageConfirm"
}

export function isTaskEditMessageConfirm(message: WebviewRequestMessage): message is TaskEditMessageConfirm {
  return message.type === "task.editMessageConfirm"
}

export function isTaskHumanRelayResponse(message: WebviewRequestMessage): message is TaskHumanRelayResponse {
  return message.type === "task.humanRelayResponse"
}

export function isTaskHumanRelayCancel(message: WebviewRequestMessage): message is TaskHumanRelayCancel {
  return message.type === "task.humanRelayCancel"
}

export function isSettingsGet(message: WebviewRequestMessage): message is SettingsGet {
  return message.type === "settings.get"
}

export function isSettingsUpdate(message: WebviewRequestMessage): message is SettingsUpdate {
  return message.type === "settings.update"
}

export function isSettingsUpdateCustomInstructions(message: WebviewRequestMessage): message is SettingsUpdateCustomInstructions {
  return message.type === "settings.updateCustomInstructions"
}

export function isSettingsUpdateMode(message: WebviewRequestMessage): message is SettingsUpdateMode {
  return message.type === "settings.updateMode"
}

export function isMCPToggle(message: WebviewRequestMessage): message is MCPToggle {
  return message.type === "mcp.toggle"
}

export function isMCPRestart(message: WebviewRequestMessage): message is MCPRestart {
  return message.type === "mcp.restart"
}

export function isMCPRefreshAll(message: WebviewRequestMessage): message is MCPRefreshAll {
  return message.type === "mcp.refreshAll"
}

export function isMCPToggleToolAlwaysAllow(message: WebviewRequestMessage): message is MCPToggleToolAlwaysAllow {
  return message.type === "mcp.toggleToolAlwaysAllow"
}

export function isMCPToggleToolEnabledForPrompt(message: WebviewRequestMessage): message is MCPToggleToolEnabledForPrompt {
  return message.type === "mcp.toggleToolEnabledForPrompt"
}

export function isMCPUpdateTimeout(message: WebviewRequestMessage): message is MCPUpdateTimeout {
  return message.type === "mcp.updateTimeout"
}

export function isMCPDeleteServer(message: WebviewRequestMessage): message is MCPDeleteServer {
  return message.type === "mcp.deleteServer"
}

export function isBrowserTestConnection(message: WebviewRequestMessage): message is BrowserTestConnection {
  return message.type === "browser.testConnection"
}

export function isBrowserKillSession(message: WebviewRequestMessage): message is BrowserKillSession {
  return message.type === "browser.killSession"
}

export function isBrowserOpenSessionPanel(message: WebviewRequestMessage): message is BrowserOpenSessionPanel {
  return message.type === "browser.openSessionPanel"
}

export function isBrowserShowSessionPanelAtStep(message: WebviewRequestMessage): message is BrowserShowSessionPanelAtStep {
  return message.type === "browser.showSessionPanelAtStep"
}

export function isBrowserRefreshSessionPanel(message: WebviewRequestMessage): message is BrowserRefreshSessionPanel {
  return message.type === "browser.refreshSessionPanel"
}

export function isCheckpointDiff(message: WebviewRequestMessage): message is CheckpointDiff {
  return message.type === "checkpoint.diff"
}

export function isCheckpointRestore(message: WebviewRequestMessage): message is CheckpointRestore {
  return message.type === "checkpoint.restore"
}

export function isCommandRequestCommands(message: WebviewRequestMessage): message is CommandRequestCommands {
  return message.type === "command.requestCommands"
}

export function isCommandOpenCommandFile(message: WebviewRequestMessage): message is CommandOpenCommandFile {
  return message.type === "command.openCommandFile"
}

export function isCommandDeleteCommand(message: WebviewRequestMessage): message is CommandDeleteCommand {
  return message.type === "command.deleteCommand"
}

export function isCommandCreateCommand(message: WebviewRequestMessage): message is CommandCreateCommand {
  return message.type === "command.createCommand"
}

export function isFileOpenFile(message: WebviewRequestMessage): message is FileOpenFile {
  return message.type === "file.openFile"
}

export function isFileSaveImage(message: WebviewRequestMessage): message is FileSaveImage {
  return message.type === "file.saveImage"
}

export function isFileOpenImage(message: WebviewRequestMessage): message is FileOpenImage {
  return message.type === "file.openImage"
}

export function isFileSelectImages(message: WebviewRequestMessage): message is FileSelectImages {
  return message.type === "file.selectImages"
}

export function isFileSearchFiles(message: WebviewRequestMessage): message is FileSearchFiles {
  return message.type === "file.searchFiles"
}

export function isGitSearchCommits(message: WebviewRequestMessage): message is GitSearchCommits {
  return message.type === "git.searchCommits"
}

export function isCodeIndexRequestStatus(message: WebviewRequestMessage): message is CodeIndexRequestStatus {
  return message.type === "codeIndex.requestStatus"
}

export function isCodeIndexStartIndexing(message: WebviewRequestMessage): message is CodeIndexStartIndexing {
  return message.type === "codeIndex.startIndexing"
}

export function isCodeIndexClearIndexData(message: WebviewRequestMessage): message is CodeIndexClearIndexData {
  return message.type === "codeIndex.clearIndexData"
}

export function isCodeIndexSaveSettings(message: WebviewRequestMessage): message is CodeIndexSaveSettings {
  return message.type === "codeIndex.saveSettings"
}

export function isCodeIndexRequestSecretStatus(message: WebviewRequestMessage): message is CodeIndexRequestSecretStatus {
  return message.type === "codeIndex.requestSecretStatus"
}

export function isModeUpdateCustomMode(message: WebviewRequestMessage): message is ModeUpdateCustomMode {
  return message.type === "mode.updateCustomMode"
}

export function isModeDeleteCustomMode(message: WebviewRequestMessage): message is ModeDeleteCustomMode {
  return message.type === "mode.deleteCustomMode"
}

export function isModeImportMode(message: WebviewRequestMessage): message is ModeImportMode {
  return message.type === "mode.importMode"
}

export function isModeExportMode(message: WebviewRequestMessage): message is ModeExportMode {
  return message.type === "mode.exportMode"
}

export function isModeOpenCustomModesSettings(message: WebviewRequestMessage): message is ModeOpenCustomModesSettings {
  return message.type === "mode.openCustomModesSettings"
}

export function isTerminalOperation(message: WebviewRequestMessage): message is TerminalOperation {
  return message.type === "terminal.operation"
}

export function isAudioPlaySound(message: WebviewRequestMessage): message is AudioPlaySound {
  return message.type === "audio.playSound"
}

export function isAudioPlayTTS(message: WebviewRequestMessage): message is AudioPlayTTS {
  return message.type === "audio.playTTS"
}

export function isAudioStopTTS(message: WebviewRequestMessage): message is AudioStopTTS {
  return message.type === "audio.stopTTS"
}

export function isAudioSetTTSEnabled(message: WebviewRequestMessage): message is AudioSetTTSEnabled {
  return message.type === "audio.setTTSEnabled"
}

export function isAudioSetTTSSpeed(message: WebviewRequestMessage): message is AudioSetTTSSpeed {
  return message.type === "audio.setTTSSpeed"
}

export function isSystemWebviewDidLaunch(message: WebviewRequestMessage): message is SystemWebviewDidLaunch {
  return message.type === "system.webviewDidLaunch"
}

export function isSystemDidShowAnnouncement(message: WebviewRequestMessage): message is SystemDidShowAnnouncement {
  return message.type === "system.didShowAnnouncement"
}

export function isSystemFocusPanelRequest(message: WebviewRequestMessage): message is SystemFocusPanelRequest {
  return message.type === "system.focusPanelRequest"
}

export function isSystemOpenExternal(message: WebviewRequestMessage): message is SystemOpenExternal {
  return message.type === "system.openExternal"
}

export function isHistoryShowTaskWithId(message: WebviewRequestMessage): message is HistoryShowTaskWithId {
  return message.type === "history.showTaskWithId"
}

export function isHistoryDeleteTaskWithId(message: WebviewRequestMessage): message is HistoryDeleteTaskWithId {
  return message.type === "history.deleteTaskWithId"
}

export function isHistoryExportTaskWithId(message: WebviewRequestMessage): message is HistoryExportTaskWithId {
  return message.type === "history.exportTaskWithId"
}

export function isHistoryExportCurrentTask(message: WebviewRequestMessage): message is HistoryExportCurrentTask {
  return message.type === "history.exportCurrentTask"
}

export function isHistoryShareCurrentTask(message: WebviewRequestMessage): message is HistoryShareCurrentTask {
  return message.type === "history.shareCurrentTask"
}

export function isHistoryDeleteMultipleTasksWithIds(message: WebviewRequestMessage): message is HistoryDeleteMultipleTasksWithIds {
  return message.type === "history.deleteMultipleTasksWithIds"
}

export function isMessageQueueQueueMessage(message: WebviewRequestMessage): message is MessageQueueQueueMessage {
  return message.type === "messageQueue.queueMessage"
}

export function isMessageQueueRemoveQueuedMessage(message: WebviewRequestMessage): message is MessageQueueRemoveQueuedMessage {
  return message.type === "messageQueue.removeQueuedMessage"
}

export function isMessageQueueEditQueuedMessage(message: WebviewRequestMessage): message is MessageQueueEditQueuedMessage {
  return message.type === "messageQueue.editQueuedMessage"
}

export function isTodoUpdateTodoList(message: WebviewRequestMessage): message is TodoUpdateTodoList {
  return message.type === "todo.updateTodoList"
}

export function isCloudCloudButtonClicked(message: WebviewRequestMessage): message is CloudCloudButtonClicked {
  return message.type === "cloud.buttonClicked"
}

export function isCloudRooCloudSignIn(message: WebviewRequestMessage): message is CloudRooCloudSignIn {
  return message.type === "cloud.rooCloudSignIn"
}

export function isCloudCloudLandingPageSignIn(message: WebviewRequestMessage): message is CloudCloudLandingPageSignIn {
  return message.type === "cloud.cloudLandingPageSignIn"
}

export function isCloudRooCloudSignOut(message: WebviewRequestMessage): message is CloudRooCloudSignOut {
  return message.type === "cloud.rooCloudSignOut"
}

export function isCloudRooCloudManualUrl(message: WebviewRequestMessage): message is CloudRooCloudManualUrl {
  return message.type === "cloud.rooCloudManualUrl"
}

export function isCloudClaudeCodeSignIn(message: WebviewRequestMessage): message is CloudClaudeCodeSignIn {
  return message.type === "cloud.claudeCodeSignIn"
}

export function isCloudClaudeCodeSignOut(message: WebviewRequestMessage): message is CloudClaudeCodeSignOut {
  return message.type === "cloud.claudeCodeSignOut"
}

export function isCloudSwitchOrganization(message: WebviewRequestMessage): message is CloudSwitchOrganization {
  return message.type === "cloud.switchOrganization"
}

export function isContextCondenseTaskContextRequest(message: WebviewRequestMessage): message is ContextCondenseTaskContextRequest {
  return message.type === "context.condenseTaskContextRequest"
}

export function isUpsellDismissUpsell(message: WebviewRequestMessage): message is UpsellDismissUpsell {
  return message.type === "upsell.dismissUpsell"
}

export function isUpsellGetDismissedUpsells(message: WebviewRequestMessage): message is UpsellGetDismissedUpsells {
  return message.type === "upsell.getDismissedUpsells"
}

export function isVSCodeUpdateSetting(message: WebviewRequestMessage): message is VSCodeUpdateSetting {
  return message.type === "vscode.updateSetting"
}

export function isVSCodeGetSetting(message: WebviewRequestMessage): message is VSCodeGetSetting {
  return message.type === "vscode.getSetting"
}

export function isVSCodeOpenKeyboardShortcuts(message: WebviewRequestMessage): message is VSCodeOpenKeyboardShortcuts {
  return message.type === "vscode.openKeyboardShortcuts"
}

export function isAPIConfigSaveConfiguration(message: WebviewRequestMessage): message is APIConfigSaveConfiguration {
  return message.type === "apiConfig.saveConfiguration"
}

export function isAPIConfigUpsertConfiguration(message: WebviewRequestMessage): message is APIConfigUpsertConfiguration {
  return message.type === "apiConfig.upsertConfiguration"
}

export function isAPIConfigDeleteConfiguration(message: WebviewRequestMessage): message is APIConfigDeleteConfiguration {
  return message.type === "apiConfig.deleteConfiguration"
}

export function isAPIConfigLoadConfiguration(message: WebviewRequestMessage): message is APIConfigLoadConfiguration {
  return message.type === "apiConfig.loadConfiguration"
}

export function isAPIConfigLoadConfigurationById(message: WebviewRequestMessage): message is APIConfigLoadConfigurationById {
  return message.type === "apiConfig.loadConfigurationById"
}

export function isAPIConfigRenameConfiguration(message: WebviewRequestMessage): message is APIConfigRenameConfiguration {
  return message.type === "apiConfig.renameConfiguration"
}

export function isAPIConfigGetListConfiguration(message: WebviewRequestMessage): message is APIConfigGetListConfiguration {
  return message.type === "apiConfig.getListConfiguration"
}

export function isAPIConfigSetCurrentConfigurationName(message: WebviewRequestMessage): message is APIConfigSetCurrentConfigurationName {
  return message.type === "apiConfig.setCurrentConfigurationName"
}

export function isAPIConfigSetPassword(message: WebviewRequestMessage): message is APIConfigSetPassword {
  return message.type === "apiConfig.setPassword"
}

export function isAPIConfigTogglePin(message: WebviewRequestMessage): message is APIConfigTogglePin {
  return message.type === "apiConfig.togglePin"
}

export function isAPIConfigRequestOpenAIModels(message: WebviewRequestMessage): message is APIConfigRequestOpenAIModels {
  return message.type === "apiConfig.requestOpenAIModels"
}

export function isPromptUpdatePrompt(message: WebviewRequestMessage): message is PromptUpdatePrompt {
  return message.type === "prompt.updatePrompt"
}

export function isPromptGetSystemPrompt(message: WebviewRequestMessage): message is PromptGetSystemPrompt {
  return message.type === "prompt.getSystemPrompt"
}

export function isPromptCopySystemPrompt(message: WebviewRequestMessage): message is PromptCopySystemPrompt {
  return message.type === "prompt.copySystemPrompt"
}

export function isPromptEnhancePrompt(message: WebviewRequestMessage): message is PromptEnhancePrompt {
  return message.type === "prompt.enhancePrompt"
}

export function isImportExportImportSettings(message: WebviewRequestMessage): message is ImportExportImportSettings {
  return message.type === "importExport.importSettings"
}

export function isImportExportExportSettings(message: WebviewRequestMessage): message is ImportExportExportSettings {
  return message.type === "importExport.exportSettings"
}

export function isImportExportResetState(message: WebviewRequestMessage): message is ImportExportResetState {
  return message.type === "importExport.resetState"
}

export function isTabSwitchTab(message: WebviewRequestMessage): message is TabSwitchTab {
  return message.type === "tab.switchTab"
}

export function isRemoteControlSetRemoteControlEnabled(message: WebviewRequestMessage): message is RemoteControlSetRemoteControlEnabled {
  return message.type === "remoteControl.setEnabled"
}

export function isRemoteControlSetTaskSyncEnabled(message: WebviewRequestMessage): message is RemoteControlSetTaskSyncEnabled {
  return message.type === "remoteControl.setTaskSyncEnabled"
}

export function isDebugOpenDebugApiHistory(message: WebviewRequestMessage): message is DebugOpenDebugApiHistory {
  return message.type === "debug.openDebugApiHistory"
}

export function isDebugOpenDebugUiHistory(message: WebviewRequestMessage): message is DebugOpenDebugUiHistory {
  return message.type === "debug.openDebugUiHistory"
}

export function isDebugDownloadErrorDiagnostics(message: WebviewRequestMessage): message is DebugDownloadErrorDiagnostics {
  return message.type === "debug.downloadErrorDiagnostics"
}
