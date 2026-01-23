import { z } from "zod"
import * as Schemas from "./MessageSchemas"

export type AudioType = "notification" | "celebration" | "progress_loop"

export type TaskCreate = z.infer<typeof Schemas.TaskSchemas.create>
export type TaskCancel = z.infer<typeof Schemas.TaskSchemas.cancel>
export type TaskClear = z.infer<typeof Schemas.TaskSchemas.clear>
export type TaskAskResponse = z.infer<typeof Schemas.TaskSchemas.askResponse>
export type TaskDeleteMessageConfirm = z.infer<typeof Schemas.TaskSchemas.deleteMessageConfirm>
export type TaskEditMessageConfirm = z.infer<typeof Schemas.TaskSchemas.editMessageConfirm>
export type TaskHumanRelayResponse = z.infer<typeof Schemas.TaskSchemas.humanRelayResponse>
export type TaskHumanRelayCancel = z.infer<typeof Schemas.TaskSchemas.humanRelayCancel>
export type TaskCancelAutoApproval = z.infer<typeof Schemas.TaskSchemas.cancelAutoApproval>

export type SettingsGet = z.infer<typeof Schemas.SettingsSchemas.get>
export type SettingsUpdate = z.infer<typeof Schemas.SettingsSchemas.update>
export type SettingsUpdateCustomInstructions = z.infer<typeof Schemas.SettingsSchemas.updateCustomInstructions>
export type SettingsUpdateMode = z.infer<typeof Schemas.SettingsSchemas.updateMode>

export type MCPToggle = z.infer<typeof Schemas.MCPSchemas.toggle>
export type MCPRestart = z.infer<typeof Schemas.MCPSchemas.restart>
export type MCPRefreshAll = z.infer<typeof Schemas.MCPSchemas.refreshAll>
export type MCPToggleToolAlwaysAllow = z.infer<typeof Schemas.MCPSchemas.toggleToolAlwaysAllow>
export type MCPToggleToolEnabledForPrompt = z.infer<typeof Schemas.MCPSchemas.toggleToolEnabledForPrompt>
export type MCPUpdateTimeout = z.infer<typeof Schemas.MCPSchemas.updateTimeout>
export type MCPDeleteServer = z.infer<typeof Schemas.MCPSchemas.deleteServer>

export type BrowserTestConnection = z.infer<typeof Schemas.BrowserSchemas.testConnection>
export type BrowserKillSession = z.infer<typeof Schemas.BrowserSchemas.killSession>
export type BrowserOpenSessionPanel = z.infer<typeof Schemas.BrowserSchemas.openSessionPanel>
export type BrowserShowSessionPanelAtStep = z.infer<typeof Schemas.BrowserSchemas.showSessionPanelAtStep>
export type BrowserRefreshSessionPanel = z.infer<typeof Schemas.BrowserSchemas.refreshSessionPanel>

export type CheckpointDiff = z.infer<typeof Schemas.CheckpointSchemas.diff>
export type CheckpointRestore = z.infer<typeof Schemas.CheckpointSchemas.restore>

export type CommandRequestCommands = z.infer<typeof Schemas.CommandSchemas.requestCommands>
export type CommandOpenCommandFile = z.infer<typeof Schemas.CommandSchemas.openCommandFile>
export type CommandDeleteCommand = z.infer<typeof Schemas.CommandSchemas.deleteCommand>
export type CommandCreateCommand = z.infer<typeof Schemas.CommandSchemas.createCommand>

export type FileOpenFile = z.infer<typeof Schemas.FileSchemas.openFile>
export type FileSaveImage = z.infer<typeof Schemas.FileSchemas.saveImage>
export type FileOpenImage = z.infer<typeof Schemas.FileSchemas.openImage>
export type FileSelectImages = z.infer<typeof Schemas.FileSchemas.selectImages>
export type FileSearchFiles = z.infer<typeof Schemas.FileSchemas.searchFiles>

export type GitSearchCommits = z.infer<typeof Schemas.GitSchemas.searchCommits>

export type CodeIndexRequestStatus = z.infer<typeof Schemas.CodeIndexSchemas.requestStatus>
export type CodeIndexStartIndexing = z.infer<typeof Schemas.CodeIndexSchemas.startIndexing>
export type CodeIndexClearIndexData = z.infer<typeof Schemas.CodeIndexSchemas.clearIndexData>
export type CodeIndexSaveSettings = z.infer<typeof Schemas.CodeIndexSchemas.saveSettings>
export type CodeIndexRequestSecretStatus = z.infer<typeof Schemas.CodeIndexSchemas.requestSecretStatus>

export type ModeUpdateCustomMode = z.infer<typeof Schemas.ModeSchemas.updateCustomMode>
export type ModeDeleteCustomMode = z.infer<typeof Schemas.ModeSchemas.deleteCustomMode>
export type ModeImportMode = z.infer<typeof Schemas.ModeSchemas.importMode>
export type ModeExportMode = z.infer<typeof Schemas.ModeSchemas.exportMode>
export type ModeOpenCustomModesSettings = z.infer<typeof Schemas.ModeSchemas.openCustomModesSettings>

export type TerminalOperation = z.infer<typeof Schemas.TerminalSchemas.operation>

export type AudioPlaySound = z.infer<typeof Schemas.AudioSchemas.playSound>
export type AudioPlayTTS = z.infer<typeof Schemas.AudioSchemas.playTTS>
export type AudioStopTTS = z.infer<typeof Schemas.AudioSchemas.stopTTS>
export type AudioSetTTSEnabled = z.infer<typeof Schemas.AudioSchemas.setTTSEnabled>
export type AudioSetTTSSpeed = z.infer<typeof Schemas.AudioSchemas.setTTSSpeed>

export type SystemWebviewDidLaunch = z.infer<typeof Schemas.SystemSchemas.webviewDidLaunch>
export type SystemDidShowAnnouncement = z.infer<typeof Schemas.SystemSchemas.didShowAnnouncement>
export type SystemFocusPanelRequest = z.infer<typeof Schemas.SystemSchemas.focusPanelRequest>
export type SystemOpenExternal = z.infer<typeof Schemas.SystemSchemas.openExternal>

export type HistoryShowTaskWithId = z.infer<typeof Schemas.HistorySchemas.showTaskWithId>
export type HistoryDeleteTaskWithId = z.infer<typeof Schemas.HistorySchemas.deleteTaskWithId>
export type HistoryExportTaskWithId = z.infer<typeof Schemas.HistorySchemas.exportTaskWithId>
export type HistoryExportCurrentTask = z.infer<typeof Schemas.HistorySchemas.exportCurrentTask>
export type HistoryShareCurrentTask = z.infer<typeof Schemas.HistorySchemas.shareCurrentTask>
export type HistoryDeleteMultipleTasksWithIds = z.infer<typeof Schemas.HistorySchemas.deleteMultipleTasksWithIds>

export type MessageQueueQueueMessage = z.infer<typeof Schemas.MessageQueueSchemas.queueMessage>
export type MessageQueueRemoveQueuedMessage = z.infer<typeof Schemas.MessageQueueSchemas.removeQueuedMessage>
export type MessageQueueEditQueuedMessage = z.infer<typeof Schemas.MessageQueueSchemas.editQueuedMessage>

export type TodoUpdateTodoList = z.infer<typeof Schemas.TodoSchemas.updateTodoList>

export type CloudCloudButtonClicked = z.infer<typeof Schemas.CloudSchemas.cloudButtonClicked>
export type CloudRooCloudSignIn = z.infer<typeof Schemas.CloudSchemas.rooCloudSignIn>
export type CloudCloudLandingPageSignIn = z.infer<typeof Schemas.CloudSchemas.cloudLandingPageSignIn>
export type CloudRooCloudSignOut = z.infer<typeof Schemas.CloudSchemas.rooCloudSignOut>
export type CloudRooCloudManualUrl = z.infer<typeof Schemas.CloudSchemas.rooCloudManualUrl>
export type CloudClaudeCodeSignIn = z.infer<typeof Schemas.CloudSchemas.claudeCodeSignIn>
export type CloudClaudeCodeSignOut = z.infer<typeof Schemas.CloudSchemas.claudeCodeSignOut>
export type CloudSwitchOrganization = z.infer<typeof Schemas.CloudSchemas.switchOrganization>

export type ContextCondenseTaskContextRequest = z.infer<typeof Schemas.ContextSchemas.condenseTaskContextRequest>

export type UpsellDismissUpsell = z.infer<typeof Schemas.UpsellSchemas.dismissUpsell>
export type UpsellGetDismissedUpsells = z.infer<typeof Schemas.UpsellSchemas.getDismissedUpsells>

export type VSCodeUpdateSetting = z.infer<typeof Schemas.VSCodeSchemas.updateSetting>
export type VSCodeGetSetting = z.infer<typeof Schemas.VSCodeSchemas.getSetting>
export type VSCodeOpenKeyboardShortcuts = z.infer<typeof Schemas.VSCodeSchemas.openKeyboardShortcuts>

export type APIConfigSaveConfiguration = z.infer<typeof Schemas.APIConfigSchemas.saveConfiguration>
export type APIConfigUpsertConfiguration = z.infer<typeof Schemas.APIConfigSchemas.upsertConfiguration>
export type APIConfigDeleteConfiguration = z.infer<typeof Schemas.APIConfigSchemas.deleteConfiguration>
export type APIConfigLoadConfiguration = z.infer<typeof Schemas.APIConfigSchemas.loadConfiguration>
export type APIConfigLoadConfigurationById = z.infer<typeof Schemas.APIConfigSchemas.loadConfigurationById>
export type APIConfigRenameConfiguration = z.infer<typeof Schemas.APIConfigSchemas.renameConfiguration>
export type APIConfigGetListConfiguration = z.infer<typeof Schemas.APIConfigSchemas.getListConfiguration>
export type APIConfigSetCurrentConfigurationName = z.infer<typeof Schemas.APIConfigSchemas.setCurrentConfigurationName>
export type APIConfigSetPassword = z.infer<typeof Schemas.APIConfigSchemas.setPassword>
export type APIConfigTogglePin = z.infer<typeof Schemas.APIConfigSchemas.togglePin>
export type APIConfigRequestOpenAIModels = z.infer<typeof Schemas.APIConfigSchemas.requestOpenAIModels>

export type PromptUpdatePrompt = z.infer<typeof Schemas.PromptSchemas.updatePrompt>
export type PromptGetSystemPrompt = z.infer<typeof Schemas.PromptSchemas.getSystemPrompt>
export type PromptCopySystemPrompt = z.infer<typeof Schemas.PromptSchemas.copySystemPrompt>
export type PromptEnhancePrompt = z.infer<typeof Schemas.PromptSchemas.enhancePrompt>

export type ImportExportImportSettings = z.infer<typeof Schemas.ImportExportSchemas.importSettings>
export type ImportExportExportSettings = z.infer<typeof Schemas.ImportExportSchemas.exportSettings>
export type ImportExportResetState = z.infer<typeof Schemas.ImportExportSchemas.resetState>

export type TabSwitchTab = z.infer<typeof Schemas.TabSchemas.switchTab>

export type RemoteControlSetRemoteControlEnabled = z.infer<typeof Schemas.RemoteControlSchemas.setRemoteControlEnabled>
export type RemoteControlSetTaskSyncEnabled = z.infer<typeof Schemas.RemoteControlSchemas.setTaskSyncEnabled>

export type DebugOpenDebugApiHistory = z.infer<typeof Schemas.DebugSchemas.openDebugApiHistory>
export type DebugOpenDebugUiHistory = z.infer<typeof Schemas.DebugSchemas.openDebugUiHistory>
export type DebugDownloadErrorDiagnostics = z.infer<typeof Schemas.DebugSchemas.downloadErrorDiagnostics>

export type WebviewRequestMessage =
  | TaskCreate
  | TaskCancel
  | TaskClear
  | TaskAskResponse
  | TaskDeleteMessageConfirm
  | TaskEditMessageConfirm
  | TaskHumanRelayResponse
  | TaskHumanRelayCancel
  | TaskCancelAutoApproval
  | SettingsGet
  | SettingsUpdate
  | SettingsUpdateCustomInstructions
  | SettingsUpdateMode
  | MCPToggle
  | MCPRestart
  | MCPRefreshAll
  | MCPToggleToolAlwaysAllow
  | MCPToggleToolEnabledForPrompt
  | MCPUpdateTimeout
  | MCPDeleteServer
  | BrowserTestConnection
  | BrowserKillSession
  | BrowserOpenSessionPanel
  | BrowserShowSessionPanelAtStep
  | BrowserRefreshSessionPanel
  | CheckpointDiff
  | CheckpointRestore
  | CommandRequestCommands
  | CommandOpenCommandFile
  | CommandDeleteCommand
  | CommandCreateCommand
  | FileOpenFile
  | FileSaveImage
  | FileOpenImage
  | FileSelectImages
  | FileSearchFiles
  | GitSearchCommits
  | CodeIndexRequestStatus
  | CodeIndexStartIndexing
  | CodeIndexClearIndexData
  | CodeIndexSaveSettings
  | CodeIndexRequestSecretStatus
  | ModeUpdateCustomMode
  | ModeDeleteCustomMode
  | ModeImportMode
  | ModeExportMode
  | ModeOpenCustomModesSettings
  | TerminalOperation
  | AudioPlaySound
  | AudioPlayTTS
  | AudioStopTTS
  | AudioSetTTSEnabled
  | AudioSetTTSSpeed
  | SystemWebviewDidLaunch
  | SystemDidShowAnnouncement
  | SystemFocusPanelRequest
  | SystemOpenExternal
  | HistoryShowTaskWithId
  | HistoryDeleteTaskWithId
  | HistoryExportTaskWithId
  | HistoryExportCurrentTask
  | HistoryShareCurrentTask
  | HistoryDeleteMultipleTasksWithIds
  | MessageQueueQueueMessage
  | MessageQueueRemoveQueuedMessage
  | MessageQueueEditQueuedMessage
  | TodoUpdateTodoList
  | CloudCloudButtonClicked
  | CloudRooCloudSignIn
  | CloudCloudLandingPageSignIn
  | CloudRooCloudSignOut
  | CloudRooCloudManualUrl
  | CloudClaudeCodeSignIn
  | CloudClaudeCodeSignOut
  | CloudSwitchOrganization
  | ContextCondenseTaskContextRequest
  | UpsellDismissUpsell
  | UpsellGetDismissedUpsells
  | VSCodeUpdateSetting
  | VSCodeGetSetting
  | VSCodeOpenKeyboardShortcuts
  | APIConfigSaveConfiguration
  | APIConfigUpsertConfiguration
  | APIConfigDeleteConfiguration
  | APIConfigLoadConfiguration
  | APIConfigLoadConfigurationById
  | APIConfigRenameConfiguration
  | APIConfigGetListConfiguration
  | APIConfigSetCurrentConfigurationName
  | APIConfigSetPassword
  | APIConfigTogglePin
  | APIConfigRequestOpenAIModels
  | PromptUpdatePrompt
  | PromptGetSystemPrompt
  | PromptCopySystemPrompt
  | PromptEnhancePrompt
  | ImportExportImportSettings
  | ImportExportExportSettings
  | ImportExportResetState
  | TabSwitchTab
  | RemoteControlSetRemoteControlEnabled
  | RemoteControlSetTaskSyncEnabled
  | DebugOpenDebugApiHistory
  | DebugOpenDebugUiHistory
  | DebugDownloadErrorDiagnostics
