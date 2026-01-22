import { z } from "zod"

export namespace TaskMessages {
  export interface Create {
    type: "task.create"
    text: string
    images?: string[]
  }

  export interface Cancel {
    type: "task.cancel"
    taskId: string
  }

  export interface Clear {
    type: "task.clear"
  }

  export interface AskResponse {
    type: "task.askResponse"
    askResponse: "yesButtonClicked" | "noButtonClicked" | "messageResponse" | "objectResponse"
    text?: string
    images?: string[]
  }
}

export namespace SettingsMessages {
  export interface Get {
    type: "settings.get"
  }

  export interface Update {
    type: "settings.update"
    settings: Record<string, any>
  }

  export interface UpdateCustomInstructions {
    type: "settings.updateCustomInstructions"
    text?: string
  }

  export interface UpdateMode {
    type: "settings.updateMode"
    mode: string
  }
}

export namespace MCPMessages {
  export interface Toggle {
    type: "mcp.toggle"
    serverName: string
    enabled: boolean
  }

  export interface Restart {
    type: "mcp.restart"
    serverName: string
  }

  export interface RefreshAll {
    type: "mcp.refreshAll"
  }

  export interface ToggleToolAlwaysAllow {
    type: "mcp.toggleToolAlwaysAllow"
    serverName: string
    toolName: string
    alwaysAllow: boolean
  }

  export interface ToggleToolEnabledForPrompt {
    type: "mcp.toggleToolEnabledForPrompt"
    serverName: string
    toolName: string
    isEnabled: boolean
  }

  export interface UpdateTimeout {
    type: "mcp.updateTimeout"
    serverName: string
    timeout: number
  }

  export interface DeleteServer {
    type: "mcp.deleteServer"
    serverName: string
  }
}

export namespace BrowserMessages {
  export interface TestConnection {
    type: "browser.testConnection"
    url?: string
  }

  export interface KillSession {
    type: "browser.killSession"
  }

  export interface OpenSessionPanel {
    type: "browser.openSessionPanel"
  }

  export interface ShowSessionPanelAtStep {
    type: "browser.showSessionPanelAtStep"
    stepIndex: number
    forceShow?: boolean
  }

  export interface RefreshSessionPanel {
    type: "browser.refreshSessionPanel"
  }
}

export namespace CheckpointMessages {
  export interface Diff {
    type: "checkpoint.diff"
    commitHash: string
    mode: "full" | "checkpoint" | "from-init" | "to-current"
    ts?: number
    previousCommitHash?: string
  }

  export interface Restore {
    type: "checkpoint.restore"
    commitHash: string
    mode: "preview" | "restore"
    restoreType?: "files_only" | "context_only" | "files_and_context"
    ts: number
    apiRequestId?: string
  }
}

export namespace CommandMessages {
  export interface RequestCommands {
    type: "command.requestCommands"
  }

  export interface OpenCommandFile {
    type: "command.openCommandFile"
    source: "global" | "project" | "built-in"
    name: string
  }

  export interface DeleteCommand {
    type: "command.deleteCommand"
    source: "global" | "project" | "built-in"
    name: string
  }

  export interface CreateCommand {
    type: "command.createCommand"
    source: "global" | "project" | "built-in"
    name: string
    description?: string
    argumentHint?: string
    content?: string
  }
}

export namespace FileMessages {
  export interface OpenFile {
    type: "file.openFile"
    path: string
  }

  export interface SaveImage {
    type: "file.saveImage"
    dataUri: string
  }

  export interface OpenImage {
    type: "file.openImage"
    dataUri: string
  }

  export interface SelectImages {
    type: "file.selectImages"
  }

  export interface SearchFiles {
    type: "file.searchFiles"
    query: string
    include?: string
    exclude?: string
  }
}

export namespace GitMessages {
  export interface SearchCommits {
    type: "git.searchCommits"
    query: string
  }
}

export namespace CodeIndexMessages {
  export interface RequestStatus {
    type: "codeIndex.requestStatus"
  }

  export interface StartIndexing {
    type: "codeIndex.startIndexing"
  }

  export interface ClearIndexData {
    type: "codeIndex.clearIndexData"
  }

  export interface SaveSettings {
    type: "codeIndex.saveSettings"
    settings: {
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
    }
  }

  export interface RequestSecretStatus {
    type: "codeIndex.requestSecretStatus"
  }
}

export namespace ModeMessages {
  export interface UpdateCustomMode {
    type: "mode.updateCustomMode"
    slug: string
    modeConfig: any
  }

  export interface DeleteCustomMode {
    type: "mode.deleteCustomMode"
    slug: string
    checkOnly?: boolean
  }

  export interface ImportMode {
    type: "mode.importMode"
    modeConfig: any
  }

  export interface ExportMode {
    type: "mode.exportMode"
    slug: string
  }

  export interface OpenCustomModesSettings {
    type: "mode.openCustomModesSettings"
  }
}

export namespace TerminalMessages {
  export interface Operation {
    type: "terminal.operation"
    terminalOperation: "continue" | "abort"
  }
}

export namespace AudioMessages {
  export interface PlaySound {
    type: "audio.playSound"
    audioType: "notification" | "celebration" | "progress_loop"
  }

  export interface PlayTTS {
    type: "audio.playTTS"
    text: string
  }

  export interface StopTTS {
    type: "audio.stopTTS"
  }

  export interface SetTTSEnabled {
    type: "audio.setTTSEnabled"
    enabled: boolean
  }

  export interface SetTTSSpeed {
    type: "audio.setTTSSpeed"
    speed: number
  }
}

export namespace SystemMessages {
  export interface WebviewDidLaunch {
    type: "system.webviewDidLaunch"
  }

  export interface DidShowAnnouncement {
    type: "system.didShowAnnouncement"
  }

  export interface FocusPanelRequest {
    type: "system.focusPanelRequest"
  }

  export interface OpenExternal {
    type: "system.openExternal"
    url: string
  }
}

export namespace HistoryMessages {
  export interface ShowTaskWithId {
    type: "history.showTaskWithId"
    taskId: string
  }

  export interface DeleteTaskWithId {
    type: "history.deleteTaskWithId"
    taskId: string
  }

  export interface ExportTaskWithId {
    type: "history.exportTaskWithId"
    taskId: string
  }

  export interface ExportCurrentTask {
    type: "history.exportCurrentTask"
  }

  export interface ShareCurrentTask {
    type: "history.shareCurrentTask"
  }

  export interface DeleteMultipleTasksWithIds {
    type: "history.deleteMultipleTasksWithIds"
    ids: string[]
  }
}

export namespace MessageQueueMessages {
  export interface QueueMessage {
    type: "messageQueue.queueMessage"
    text: string
    images?: string[]
  }

  export interface RemoveQueuedMessage {
    type: "messageQueue.removeQueuedMessage"
    text: string
  }

  export interface EditQueuedMessage {
    type: "messageQueue.editQueuedMessage"
    payload: {
      id: string
      text: string
      images?: string[]
    }
  }
}

export namespace TodoMessages {
  export interface UpdateTodoList {
    type: "todo.updateTodoList"
    todos: any[]
  }
}

export namespace CloudMessages {
  export interface CloudButtonClicked {
    type: "cloud.buttonClicked"
  }

  export interface RooCloudSignIn {
    type: "cloud.rooCloudSignIn"
    useProviderSignup?: boolean
  }

  export interface CloudLandingPageSignIn {
    type: "cloud.cloudLandingPageSignIn"
  }

  export interface RooCloudSignOut {
    type: "cloud.rooCloudSignOut"
  }

  export interface RooCloudManualUrl {
    type: "cloud.rooCloudManualUrl"
    url: string
  }

  export interface ClaudeCodeSignIn {
    type: "cloud.claudeCodeSignIn"
  }

  export interface ClaudeCodeSignOut {
    type: "cloud.claudeCodeSignOut"
  }

  export interface SwitchOrganization {
    type: "cloud.switchOrganization"
    organizationId: string | null
  }
}

export namespace ContextMessages {
  export interface CondenseTaskContextRequest {
    type: "context.condenseTaskContextRequest"
    text?: string
  }
}

export namespace UpsellMessages {
  export interface DismissUpsell {
    type: "upsell.dismissUpsell"
    upsellId: string
  }

  export interface GetDismissedUpsells {
    type: "upsell.getDismissedUpsells"
  }
}

export namespace VSCodeMessages {
  export interface UpdateSetting {
    type: "vscode.updateSetting"
    setting: string
    value: any
  }

  export interface GetSetting {
    type: "vscode.getSetting"
    setting: string
  }

  export interface OpenKeyboardShortcuts {
    type: "vscode.openKeyboardShortcuts"
  }
}

export namespace APIConfigMessages {
  export interface SaveConfiguration {
    type: "apiConfig.saveConfiguration"
    apiConfiguration: any
  }

  export interface UpsertConfiguration {
    type: "apiConfig.upsertConfiguration"
    name?: string
    apiConfiguration: any
  }

  export interface DeleteConfiguration {
    type: "apiConfig.deleteConfiguration"
    name: string
  }

  export interface LoadConfiguration {
    type: "apiConfig.loadConfiguration"
    name: string
  }

  export interface LoadConfigurationById {
    type: "apiConfig.loadConfigurationById"
    id: string
  }

  export interface RenameConfiguration {
    type: "apiConfig.renameConfiguration"
    oldName: string
    newName: string
  }

  export interface GetListConfiguration {
    type: "apiConfig.getListConfiguration"
  }

  export interface SetCurrentConfigurationName {
    type: "apiConfig.setCurrentConfigurationName"
    name: string
  }

  export interface SetPassword {
    type: "apiConfig.setPassword"
    name: string
    password: string
  }

  export interface TogglePin {
    type: "apiConfig.togglePin"
    name: string
  }

  export interface RequestOpenAIModels {
    type: "apiConfig.requestOpenAIModels"
  }
}

export namespace PromptMessages {
  export interface UpdatePrompt {
    type: "prompt.updatePrompt"
    promptMode: "enhance" | string
    customPrompt?: any
  }

  export interface GetSystemPrompt {
    type: "prompt.getSystemPrompt"
    mode?: string
  }

  export interface CopySystemPrompt {
    type: "prompt.copySystemPrompt"
    mode?: string
  }

  export interface EnhancePrompt {
    type: "prompt.enhancePrompt"
    text: string
  }
}

export namespace ImportExportMessages {
  export interface ImportSettings {
    type: "importExport.importSettings"
  }

  export interface ExportSettings {
    type: "importExport.exportSettings"
  }

  export interface ResetState {
    type: "importExport.resetState"
  }
}

export namespace TabMessages {
  export interface SwitchTab {
    type: "tab.switchTab"
    tab: "settings" | "history" | "mcp" | "modes" | "chat" | "cloud"
    section?: string
  }
}

export namespace RemoteControlMessages {
  export interface SetRemoteControlEnabled {
    type: "remoteControl.setEnabled"
    enabled: boolean
  }

  export interface SetTaskSyncEnabled {
    type: "remoteControl.setTaskSyncEnabled"
    enabled: boolean
  }
}

export namespace DebugMessages {
  export interface OpenDebugApiHistory {
    type: "debug.openDebugApiHistory"
  }

  export interface OpenDebugUiHistory {
    type: "debug.openDebugUiHistory"
  }

  export interface DownloadErrorDiagnostics {
    type: "debug.downloadErrorDiagnostics"
  }
}

export type WebviewRequestMessage =
  | TaskMessages.Create
  | TaskMessages.Cancel
  | TaskMessages.Clear
  | TaskMessages.AskResponse
  | SettingsMessages.Get
  | SettingsMessages.Update
  | SettingsMessages.UpdateCustomInstructions
  | SettingsMessages.UpdateMode
  | MCPMessages.Toggle
  | MCPMessages.Restart
  | MCPMessages.RefreshAll
  | MCPMessages.ToggleToolAlwaysAllow
  | MCPMessages.ToggleToolEnabledForPrompt
  | MCPMessages.UpdateTimeout
  | MCPMessages.DeleteServer
  | BrowserMessages.TestConnection
  | BrowserMessages.KillSession
  | BrowserMessages.OpenSessionPanel
  | BrowserMessages.ShowSessionPanelAtStep
  | BrowserMessages.RefreshSessionPanel
  | CheckpointMessages.Diff
  | CheckpointMessages.Restore
  | CommandMessages.RequestCommands
  | CommandMessages.OpenCommandFile
  | CommandMessages.DeleteCommand
  | CommandMessages.CreateCommand
  | FileMessages.OpenFile
  | FileMessages.SaveImage
  | FileMessages.OpenImage
  | FileMessages.SelectImages
  | FileMessages.SearchFiles
  | GitMessages.SearchCommits
  | CodeIndexMessages.RequestStatus
  | CodeIndexMessages.StartIndexing
  | CodeIndexMessages.ClearIndexData
  | CodeIndexMessages.SaveSettings
  | CodeIndexMessages.RequestSecretStatus
  | ModeMessages.UpdateCustomMode
  | ModeMessages.DeleteCustomMode
  | ModeMessages.ImportMode
  | ModeMessages.ExportMode
  | ModeMessages.OpenCustomModesSettings
  | TerminalMessages.Operation
  | AudioMessages.PlaySound
  | AudioMessages.PlayTTS
  | AudioMessages.StopTTS
  | AudioMessages.SetTTSEnabled
  | AudioMessages.SetTTSSpeed
  | SystemMessages.WebviewDidLaunch
  | SystemMessages.DidShowAnnouncement
  | SystemMessages.FocusPanelRequest
  | SystemMessages.OpenExternal
  | HistoryMessages.ShowTaskWithId
  | HistoryMessages.DeleteTaskWithId
  | HistoryMessages.ExportTaskWithId
  | HistoryMessages.ExportCurrentTask
  | HistoryMessages.ShareCurrentTask
  | HistoryMessages.DeleteMultipleTasksWithIds
  | MessageQueueMessages.QueueMessage
  | MessageQueueMessages.RemoveQueuedMessage
  | MessageQueueMessages.EditQueuedMessage
  | TodoMessages.UpdateTodoList
  | CloudMessages.CloudButtonClicked
  | CloudMessages.RooCloudSignIn
  | CloudMessages.CloudLandingPageSignIn
  | CloudMessages.RooCloudSignOut
  | CloudMessages.RooCloudManualUrl
  | CloudMessages.ClaudeCodeSignIn
  | CloudMessages.ClaudeCodeSignOut
  | CloudMessages.SwitchOrganization
  | ContextMessages.CondenseTaskContextRequest
  | UpsellMessages.DismissUpsell
  | UpsellMessages.GetDismissedUpsells
  | VSCodeMessages.UpdateSetting
  | VSCodeMessages.GetSetting
  | VSCodeMessages.OpenKeyboardShortcuts
  | APIConfigMessages.SaveConfiguration
  | APIConfigMessages.UpsertConfiguration
  | APIConfigMessages.DeleteConfiguration
  | APIConfigMessages.LoadConfiguration
  | APIConfigMessages.LoadConfigurationById
  | APIConfigMessages.RenameConfiguration
  | APIConfigMessages.GetListConfiguration
  | APIConfigMessages.SetCurrentConfigurationName
  | APIConfigMessages.SetPassword
  | APIConfigMessages.TogglePin
  | APIConfigMessages.RequestOpenAIModels
  | PromptMessages.UpdatePrompt
  | PromptMessages.GetSystemPrompt
  | PromptMessages.CopySystemPrompt
  | PromptMessages.EnhancePrompt
  | ImportExportMessages.ImportSettings
  | ImportExportMessages.ExportSettings
  | ImportExportMessages.ResetState
  | TabMessages.SwitchTab
  | RemoteControlMessages.SetRemoteControlEnabled
  | RemoteControlMessages.SetTaskSyncEnabled
  | DebugMessages.OpenDebugApiHistory
  | DebugMessages.OpenDebugUiHistory
  | DebugMessages.DownloadErrorDiagnostics

export namespace TaskResponses {
  export interface Created {
    type: "task.created"
    taskId: string
  }

  export interface Cancelled {
    type: "task.cancelled"
    taskId: string
  }

  export interface Cleared {
    type: "task.cleared"
  }
}

export namespace SettingsResponses {
  export interface Got {
    type: "settings.got"
    settings: Record<string, any>
  }

  export interface Updated {
    type: "settings.updated"
    settings: Record<string, any>
  }

  export interface CustomInstructionsUpdated {
    type: "settings.customInstructionsUpdated"
    text?: string
  }

  export interface ModeUpdated {
    type: "settings.modeUpdated"
    mode: string
  }
}

export namespace MCPResponses {
  export interface Toggled {
    type: "mcp.toggled"
    serverName: string
    enabled: boolean
  }

  export interface Restarted {
    type: "mcp.restarted"
    serverName: string
  }

  export interface Refreshed {
    type: "mcp.refreshed"
    servers: any[]
  }

  export interface ToolAlwaysAllowToggled {
    type: "mcp.toolAlwaysAllowToggled"
    serverName: string
    toolName: string
    alwaysAllow: boolean
  }

  export interface ToolEnabledForPromptToggled {
    type: "mcp.toolEnabledForPromptToggled"
    serverName: string
    toolName: string
    isEnabled: boolean
  }

  export interface TimeoutUpdated {
    type: "mcp.timeoutUpdated"
    serverName: string
    timeout: number
  }

  export interface ServerDeleted {
    type: "mcp.serverDeleted"
    serverName: string
  }
}

export namespace BrowserResponses {
  export interface ConnectionResult {
    type: "browser.connectionResult"
    success: boolean
    result?: any
    error?: string
  }

  export interface SessionKilled {
    type: "browser.sessionKilled"
  }

  export interface SessionPanelOpened {
    type: "browser.sessionPanelOpened"
  }

  export interface SessionPanelShownAtStep {
    type: "browser.sessionPanelShownAtStep"
    stepIndex: number
  }

  export interface SessionPanelRefreshed {
    type: "browser.sessionPanelRefreshed"
  }
}

export namespace CheckpointResponses {
  export interface DiffResult {
    type: "checkpoint.diffResult"
    diff: any
  }

  export interface Restored {
    type: "checkpoint.restored"
    commitHash: string
  }
}

export namespace CommandResponses {
  export interface Commands {
    type: "command.commands"
    commands: any[]
  }

  export interface CommandFileOpened {
    type: "command.commandFileOpened"
    path: string
  }

  export interface CommandDeleted {
    type: "command.commandDeleted"
    source: string
    name: string
  }

  export interface CommandCreated {
    type: "command.commandCreated"
    source: string
    name: string
  }
}

export namespace FileResponses {
  export interface FileOpened {
    type: "file.fileOpened"
    path: string
  }

  export interface ImageSaved {
    type: "file.imageSaved"
    path: string
  }

  export interface ImageOpened {
    type: "file.imageOpened"
    path: string
  }

  export interface ImagesSelected {
    type: "file.imagesSelected"
    images: string[]
  }

  export interface FilesSearched {
    type: "file.filesSearched"
    results: any[]
  }
}

export namespace GitResponses {
  export interface CommitsSearched {
    type: "git.commitsSearched"
    commits: any[]
  }
}

export namespace CodeIndexResponses {
  export interface Status {
    type: "codeIndex.status"
    status: any
  }

  export interface IndexingStarted {
    type: "codeIndex.indexingStarted"
  }

  export interface IndexDataCleared {
    type: "codeIndex.indexDataCleared"
    success: boolean
    error?: string
  }

  export interface SettingsSaved {
    type: "codeIndex.settingsSaved"
    settings: any
  }

  export interface SecretStatus {
    type: "codeIndex.secretStatus"
    status: any
  }
}

export namespace ModeResponses {
  export interface CustomModeUpdated {
    type: "mode.customModeUpdated"
    slug: string
    modeConfig: any
  }

  export interface CustomModeDeleted {
    type: "mode.customModeDeleted"
    slug: string
  }

  export interface ModeImported {
    type: "mode.modeImported"
    modeConfig: any
  }

  export interface ModeExported {
    type: "mode.modeExported"
    slug: string
    modeConfig: any
  }

  export interface CustomModesSettingsOpened {
    type: "mode.customModesSettingsOpened"
  }
}

export namespace AudioResponses {
  export interface SoundPlayed {
    type: "audio.soundPlayed"
    audioType: string
  }

  export interface TTSPlayed {
    type: "audio.ttsPlayed"
    text: string
  }

  export interface TTSStopped {
    type: "audio.ttsStopped"
  }

  export interface TTSEnabledSet {
    type: "audio.ttsEnabledSet"
    enabled: boolean
  }

  export interface TTSSpeedSet {
    type: "audio.ttsSpeedSet"
    speed: number
  }
}

export namespace SystemResponses {
  export interface PanelFocused {
    type: "system.panelFocused"
  }

  export interface ExternalOpened {
    type: "system.externalOpened"
    url: string
  }
}

export namespace HistoryResponses {
  export interface TaskShown {
    type: "history.taskShown"
    taskId: string
  }

  export interface TaskDeleted {
    type: "history.taskDeleted"
    taskId: string
  }

  export interface TaskExported {
    type: "history.taskExported"
    taskId: string
    path: string
  }

  export interface CurrentTaskExported {
    type: "history.currentTaskExported"
    path: string
  }

  export interface CurrentTaskShared {
    type: "history.currentTaskShared"
    url: string
  }

  export interface MultipleTasksDeleted {
    type: "history.multipleTasksDeleted"
    ids: string[]
  }
}

export namespace MessageQueueResponses {
  export interface MessageQueued {
    type: "messageQueue.messageQueued"
    text: string
    images?: string[]
  }

  export interface QueuedMessageRemoved {
    type: "messageQueue.queuedMessageRemoved"
    text: string
  }

  export interface QueuedMessageEdited {
    type: "messageQueue.queuedMessageEdited"
    id: string
    text: string
    images?: string[]
  }
}

export namespace TodoResponses {
  export interface TodoListUpdated {
    type: "todo.todoListUpdated"
    todos: any[]
  }
}

export namespace CloudResponses {
  export interface ButtonClicked {
    type: "cloud.buttonClicked"
  }

  export interface RooCloudSignedIn {
    type: "cloud.rooCloudSignedIn"
  }

  export interface CloudLandingPageSignedIn {
    type: "cloud.cloudLandingPageSignedIn"
  }

  export interface RooCloudSignedOut {
    type: "cloud.rooCloudSignedOut"
  }

  export interface RooCloudManualUrlSet {
    type: "cloud.rooCloudManualUrlSet"
    url: string
  }

  export interface ClaudeCodeSignedIn {
    type: "cloud.claudeCodeSignedIn"
  }

  export interface ClaudeCodeSignedOut {
    type: "cloud.claudeCodeSignedOut"
  }

  export interface OrganizationSwitched {
    type: "cloud.organizationSwitched"
    organizationId: string | null
  }
}

export namespace ContextResponses {
  export interface TaskContextCondensed {
    type: "context.taskContextCondensed"
    result: any
  }
}

export namespace UpsellResponses {
  export interface UpsellDismissed {
    type: "upsell.upsellDismissed"
    upsellId: string
  }

  export interface DismissedUpsellsGot {
    type: "upsell.dismissedUpsellsGot"
    list: string[]
  }
}

export namespace VSCodeResponses {
  export interface SettingUpdated {
    type: "vscode.settingUpdated"
    setting: string
    value: any
  }

  export interface SettingGot {
    type: "vscode.settingGot"
    setting: string
    value: any
  }

  export interface KeyboardShortcutsOpened {
    type: "vscode.keyboardShortcutsOpened"
  }
}

export namespace APIConfigResponses {
  export interface ConfigurationSaved {
    type: "apiConfig.configurationSaved"
    name: string
  }

  export interface ConfigurationUpserted {
    type: "apiConfig.configurationUpserted"
    name: string
  }

  export interface ConfigurationDeleted {
    type: "apiConfig.configurationDeleted"
    name: string
  }

  export interface ConfigurationLoaded {
    type: "apiConfig.configurationLoaded"
    name: string
    configuration: any
  }

  export interface ConfigurationLoadedById {
    type: "apiConfig.configurationLoadedById"
    id: string
    configuration: any
  }

  export interface ConfigurationRenamed {
    type: "apiConfig.configurationRenamed"
    oldName: string
    newName: string
  }

  export interface ListConfigurationGot {
    type: "apiConfig.listConfigurationGot"
    configurations: any[]
  }

  export interface CurrentConfigurationNameSet {
    type: "apiConfig.currentConfigurationNameSet"
    name: string
  }

  export interface PasswordSet {
    type: "apiConfig.passwordSet"
    name: string
  }

  export interface PinToggled {
    type: "apiConfig.pinToggled"
    name: string
    pinned: boolean
  }

  export interface OpenAIModelsRequested {
    type: "apiConfig.openAIModelsRequested"
    models: string[]
  }
}

export namespace PromptResponses {
  export interface PromptUpdated {
    type: "prompt.promptUpdated"
    promptMode: string
    customPrompt?: any
  }

  export interface SystemPromptGot {
    type: "prompt.systemPromptGot"
    mode?: string
    systemPrompt: string
  }

  export interface SystemPromptCopied {
    type: "prompt.systemPromptCopied"
    mode?: string
  }

  export interface PromptEnhanced {
    type: "prompt.promptEnhanced"
    text: string
    enhancedText?: string
  }
}

export namespace ImportExportResponses {
  export interface SettingsImported {
    type: "importExport.settingsImported"
  }

  export interface SettingsExported {
    type: "importExport.settingsExported"
    path: string
  }

  export interface StateReset {
    type: "importExport.stateReset"
  }
}

export namespace TabResponses {
  export interface TabSwitched {
    type: "tab.tabSwitched"
    tab: string
    section?: string
  }
}

export namespace RemoteControlResponses {
  export interface RemoteControlEnabledSet {
    type: "remoteControl.remoteControlEnabledSet"
    enabled: boolean
  }

  export interface TaskSyncEnabledSet {
    type: "remoteControl.taskSyncEnabledSet"
    enabled: boolean
  }
}

export namespace DebugResponses {
  export interface DebugApiHistoryOpened {
    type: "debug.debugApiHistoryOpened"
  }

  export interface DebugUiHistoryOpened {
    type: "debug.debugUiHistoryOpened"
  }

  export interface ErrorDiagnosticsDownloaded {
    type: "debug.errorDiagnosticsDownloaded"
    path: string
  }
}

export namespace ErrorResponses {
  export interface Error {
    type: "error"
    error: string
    requestId?: string
  }
}

export namespace CommonResponses {
  export interface Success {
    type: "success"
    requestId?: string
  }

  export interface State {
    type: "state"
    state: any
  }

  export interface Action {
    type: "action"
    action: string
    tab?: string
    values?: any
  }

  export interface Invoke {
    type: "invoke"
    invoke: string
  }
}

export type ExtensionResponseMessage =
  | TaskResponses.Created
  | TaskResponses.Cancelled
  | TaskResponses.Cleared
  | SettingsResponses.Got
  | SettingsResponses.Updated
  | SettingsResponses.CustomInstructionsUpdated
  | SettingsResponses.ModeUpdated
  | MCPResponses.Toggled
  | MCPResponses.Restarted
  | MCPResponses.Refreshed
  | MCPResponses.ToolAlwaysAllowToggled
  | MCPResponses.ToolEnabledForPromptToggled
  | MCPResponses.TimeoutUpdated
  | MCPResponses.ServerDeleted
  | BrowserResponses.ConnectionResult
  | BrowserResponses.SessionKilled
  | BrowserResponses.SessionPanelOpened
  | BrowserResponses.SessionPanelShownAtStep
  | BrowserResponses.SessionPanelRefreshed
  | CheckpointResponses.DiffResult
  | CheckpointResponses.Restored
  | CommandResponses.Commands
  | CommandResponses.CommandFileOpened
  | CommandResponses.CommandDeleted
  | CommandResponses.CommandCreated
  | FileResponses.FileOpened
  | FileResponses.ImageSaved
  | FileResponses.ImageOpened
  | FileResponses.ImagesSelected
  | FileResponses.FilesSearched
  | GitResponses.CommitsSearched
  | CodeIndexResponses.Status
  | CodeIndexResponses.IndexingStarted
  | CodeIndexResponses.IndexDataCleared
  | CodeIndexResponses.SettingsSaved
  | CodeIndexResponses.SecretStatus
  | ModeResponses.CustomModeUpdated
  | ModeResponses.CustomModeDeleted
  | ModeResponses.ModeImported
  | ModeResponses.ModeExported
  | ModeResponses.CustomModesSettingsOpened
  | AudioResponses.SoundPlayed
  | AudioResponses.TTSPlayed
  | AudioResponses.TTSStopped
  | AudioResponses.TTSEnabledSet
  | AudioResponses.TTSSpeedSet
  | SystemResponses.PanelFocused
  | SystemResponses.ExternalOpened
  | HistoryResponses.TaskShown
  | HistoryResponses.TaskDeleted
  | HistoryResponses.TaskExported
  | HistoryResponses.CurrentTaskExported
  | HistoryResponses.CurrentTaskShared
  | HistoryResponses.MultipleTasksDeleted
  | MessageQueueResponses.MessageQueued
  | MessageQueueResponses.QueuedMessageRemoved
  | MessageQueueResponses.QueuedMessageEdited
  | TodoResponses.TodoListUpdated
  | CloudResponses.ButtonClicked
  | CloudResponses.RooCloudSignedIn
  | CloudResponses.CloudLandingPageSignedIn
  | CloudResponses.RooCloudSignedOut
  | CloudResponses.RooCloudManualUrlSet
  | CloudResponses.ClaudeCodeSignedIn
  | CloudResponses.ClaudeCodeSignedOut
  | CloudResponses.OrganizationSwitched
  | ContextResponses.TaskContextCondensed
  | UpsellResponses.UpsellDismissed
  | UpsellResponses.DismissedUpsellsGot
  | VSCodeResponses.SettingUpdated
  | VSCodeResponses.SettingGot
  | VSCodeResponses.KeyboardShortcutsOpened
  | APIConfigResponses.ConfigurationSaved
  | APIConfigResponses.ConfigurationUpserted
  | APIConfigResponses.ConfigurationDeleted
  | APIConfigResponses.ConfigurationLoaded
  | APIConfigResponses.ConfigurationLoadedById
  | APIConfigResponses.ConfigurationRenamed
  | APIConfigResponses.ListConfigurationGot
  | APIConfigResponses.CurrentConfigurationNameSet
  | APIConfigResponses.PasswordSet
  | APIConfigResponses.PinToggled
  | APIConfigResponses.OpenAIModelsRequested
  | PromptResponses.PromptUpdated
  | PromptResponses.SystemPromptGot
  | PromptResponses.SystemPromptCopied
  | PromptResponses.PromptEnhanced
  | ImportExportResponses.SettingsImported
  | ImportExportResponses.SettingsExported
  | ImportExportResponses.StateReset
  | TabResponses.TabSwitched
  | RemoteControlResponses.RemoteControlEnabledSet
  | RemoteControlResponses.TaskSyncEnabledSet
  | DebugResponses.DebugApiHistoryOpened
  | DebugResponses.DebugUiHistoryOpened
  | DebugResponses.ErrorDiagnosticsDownloaded
  | ErrorResponses.Error
  | CommonResponses.Success
  | CommonResponses.State
  | CommonResponses.Action
  | CommonResponses.Invoke

export interface BaseMessage {
  requestId?: string
  timestamp?: number
}

export type RequestMessage = WebviewRequestMessage & BaseMessage
export type ResponseMessage = ExtensionResponseMessage & BaseMessage
