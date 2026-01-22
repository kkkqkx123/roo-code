import { MessageBusServer } from "./MessageBusServer"
import { WebviewMessageHandlerAdapter } from "./WebviewMessageHandlerAdapter"
import { ClineProvider } from "../webview/ClineProvider"
import * as vscode from "vscode"
import type { WebviewMessage } from "../../shared/WebviewMessage"
import { TaskHandlers } from "./handlers/TaskHandlers"
import { SettingsHandlers } from "./handlers/SettingsHandlers"
import { MCPHandlers } from "./handlers/MCPHandlers"
import { BrowserHandlers } from "./handlers/BrowserHandlers"
import { CheckpointHandlers } from "./handlers/CheckpointHandlers"

export class MessageHandlerRegistry {
  private messageBus: MessageBusServer
  private adapter: WebviewMessageHandlerAdapter
  private provider: ClineProvider
  private outputChannel: vscode.OutputChannel

  constructor(messageBus: MessageBusServer, provider: ClineProvider, outputChannel: vscode.OutputChannel) {
    this.messageBus = messageBus
    this.provider = provider
    this.outputChannel = outputChannel
    this.adapter = new WebviewMessageHandlerAdapter(provider, outputChannel)

    new TaskHandlers(messageBus, provider)
    new SettingsHandlers(messageBus, provider)
    new MCPHandlers(messageBus, provider)
    new BrowserHandlers(messageBus, provider)
    new CheckpointHandlers(messageBus, provider)
  }

  registerAll(): void {
    console.info("[MessageHandlerRegistry] Registering all message handlers...")

    this.registerCommandHandlers()
    this.registerFileHandlers()
    this.registerGitHandlers()
    this.registerCodeIndexHandlers()
    this.registerModeHandlers()
    this.registerTerminalHandlers()
    this.registerAudioHandlers()
    this.registerSystemHandlers()
    this.registerHistoryHandlers()
    this.registerMessageQueueHandlers()
    this.registerTodoHandlers()
    this.registerCloudHandlers()
    this.registerContextHandlers()
    this.registerUpsellHandlers()
    this.registerVSCodeHandlers()
    this.registerAPIConfigHandlers()
    this.registerPromptHandlers()
    this.registerImportExportHandlers()
    this.registerTabHandlers()
    this.registerRemoteControlHandlers()
    this.registerDebugHandlers()

    console.info("[MessageHandlerRegistry] All message handlers registered successfully")
  }

  private registerCommandHandlers(): void {
    console.debug("[MessageHandlerRegistry] Registering command handlers")

    this.messageBus.register("command.requestCommands", async () => {
      console.debug("[MessageHandlerRegistry] Requesting commands")
      return await this.adapter.handle({ type: "allowedCommands" })
    })

    this.messageBus.register("command.openCommandFile", async (message) => {
      const { source, name } = message as any
      console.debug(`[MessageHandlerRegistry] Opening command file: ${source}/${name}`)
      return await this.adapter.handle({ type: "openMention", context: name })
    })

    this.messageBus.register("command.deleteCommand", async (message) => {
      const { source, name } = message as any
      console.debug(`[MessageHandlerRegistry] Deleting command: ${source}/${name}`)
      return await this.adapter.handle({ type: "deniedCommands", commands: [name] })
    })

    this.messageBus.register("command.createCommand", async (message) => {
      const { source, name, description, argumentHint, content } = message as any
      console.debug(`[MessageHandlerRegistry] Creating command: ${source}/${name}`)
      return await this.adapter.handle({ type: "openCustomModesSettings" })
    })
  }

  private registerFileHandlers(): void {
    console.debug("[MessageHandlerRegistry] Registering file handlers")

    this.messageBus.register("file.openFile", async (message) => {
      const { path } = message as any
      console.debug(`[MessageHandlerRegistry] Opening file: ${path}`)
      return await this.adapter.handle({ type: "openFile", context: path })
    })

    this.messageBus.register("file.saveImage", async (message) => {
      const { dataUri } = message as any
      console.debug("[MessageHandlerRegistry] Saving image")
      return await this.adapter.handle({ type: "saveImage", dataUri })
    })

    this.messageBus.register("file.openImage", async (message) => {
      const { dataUri } = message as any
      console.debug("[MessageHandlerRegistry] Opening image")
      return await this.adapter.handle({ type: "openImage", dataUri })
    })

    this.messageBus.register("file.selectImages", async () => {
      console.debug("[MessageHandlerRegistry] Selecting images")
      return await this.adapter.handle({ type: "selectImages" })
    })

    this.messageBus.register("file.searchFiles", async (message) => {
      const { query, include, exclude } = message as any
      console.debug(`[MessageHandlerRegistry] Searching files: ${query}`)
      return await this.adapter.handle({ type: "searchFiles", query })
    })
  }

  private registerGitHandlers(): void {
    console.debug("[MessageHandlerRegistry] Registering git handlers")

    this.messageBus.register("git.searchCommits", async (message) => {
      const { query } = message as any
      console.debug(`[MessageHandlerRegistry] Searching commits: ${query}`)
      return await this.adapter.handle({ type: "searchCommits", query })
    })
  }

  private registerCodeIndexHandlers(): void {
    console.debug("[MessageHandlerRegistry] Registering code index handlers")

    this.messageBus.register("codeIndex.requestStatus", async () => {
      console.debug("[MessageHandlerRegistry] Requesting code index status")
      return await this.adapter.handle({ type: "requestIndexingStatus" })
    })

    this.messageBus.register("codeIndex.startIndexing", async () => {
      console.debug("[MessageHandlerRegistry] Starting code indexing")
      return await this.adapter.handle({ type: "startIndexing" })
    })

    this.messageBus.register("codeIndex.clearIndexData", async () => {
      console.debug("[MessageHandlerRegistry] Clearing code index data")
      return await this.adapter.handle({ type: "clearIndexData" })
    })

    this.messageBus.register("codeIndex.saveSettings", async (message) => {
      const { settings } = message as any
      console.debug("[MessageHandlerRegistry] Saving code index settings")
      return await this.adapter.handle({ type: "saveCodeIndexSettingsAtomic", settings })
    })

    this.messageBus.register("codeIndex.requestSecretStatus", async () => {
      console.debug("[MessageHandlerRegistry] Requesting code index secret status")
      return await this.adapter.handle({ type: "requestCodeIndexSecretStatus" })
    })
  }

  private registerModeHandlers(): void {
    console.debug("[MessageHandlerRegistry] Registering mode handlers")

    this.messageBus.register("mode.updateCustomMode", async (message) => {
      const { slug, modeConfig } = message as any
      console.debug(`[MessageHandlerRegistry] Updating custom mode: ${slug}`)
      return await this.adapter.handle({ type: "updateCustomMode", slug, modeConfig })
    })

    this.messageBus.register("mode.deleteCustomMode", async (message) => {
      const { slug, checkOnly } = message as any
      console.debug(`[MessageHandlerRegistry] Deleting custom mode: ${slug}`)
      return await this.adapter.handle({ type: "deleteCustomMode", slug, checkOnly })
    })

    this.messageBus.register("mode.importMode", async (message) => {
      const { modeConfig } = message as any
      console.debug("[MessageHandlerRegistry] Importing mode")
      return await this.adapter.handle({ type: "importMode", modeConfig })
    })

    this.messageBus.register("mode.exportMode", async (message) => {
      const { slug } = message as any
      console.debug(`[MessageHandlerRegistry] Exporting mode: ${slug}`)
      return await this.adapter.handle({ type: "exportMode", slug })
    })

    this.messageBus.register("mode.openCustomModesSettings", async () => {
      console.debug("[MessageHandlerRegistry] Opening custom modes settings")
      return await this.adapter.handle({ type: "openCustomModesSettings" })
    })
  }

  private registerTerminalHandlers(): void {
    console.debug("[MessageHandlerRegistry] Registering terminal handlers")

    this.messageBus.register("terminal.operation", async (message) => {
      const { terminalOperation } = message as any
      console.debug(`[MessageHandlerRegistry] Terminal operation: ${terminalOperation}`)
      return await this.adapter.handle({ type: "terminalOperation", terminalOperation })
    })
  }

  private registerAudioHandlers(): void {
    console.debug("[MessageHandlerRegistry] Registering audio handlers")

    this.messageBus.register("audio.playSound", async (message) => {
      const { audioType } = message as any
      console.debug(`[MessageHandlerRegistry] Playing sound: ${audioType}`)
      return { type: "audio.soundPlayed", audioType }
    })

    this.messageBus.register("audio.playTTS", async (message) => {
      const { text } = message as any
      console.debug("[MessageHandlerRegistry] Playing TTS")
      return await this.adapter.handle({ type: "playTts", text })
    })

    this.messageBus.register("audio.stopTTS", async () => {
      console.debug("[MessageHandlerRegistry] Stopping TTS")
      return await this.adapter.handle({ type: "stopTts" })
    })

    this.messageBus.register("audio.setTTSEnabled", async (message) => {
      const { enabled } = message as any
      console.debug(`[MessageHandlerRegistry] Setting TTS enabled: ${enabled}`)
      return await this.adapter.handle({ type: "ttsEnabled", isEnabled: enabled })
    })

    this.messageBus.register("audio.setTTSSpeed", async (message) => {
      const { speed } = message as any
      console.debug(`[MessageHandlerRegistry] Setting TTS speed: ${speed}`)
      return await this.adapter.handle({ type: "ttsSpeed", value: speed })
    })
  }

  private registerSystemHandlers(): void {
    console.debug("[MessageHandlerRegistry] Registering system handlers")

    this.messageBus.register("system.webviewDidLaunch", async () => {
      console.debug("[MessageHandlerRegistry] Webview did launch")
      return await this.adapter.handle({ type: "webviewDidLaunch" })
    })

    this.messageBus.register("system.didShowAnnouncement", async () => {
      console.debug("[MessageHandlerRegistry] Did show announcement")
      return await this.adapter.handle({ type: "didShowAnnouncement" })
    })

    this.messageBus.register("system.focusPanelRequest", async () => {
      console.debug("[MessageHandlerRegistry] Focus panel request")
      return { type: "system.panelFocused" }
    })

    this.messageBus.register("system.openExternal", async (message) => {
      const { url } = message as any
      console.debug(`[MessageHandlerRegistry] Opening external: ${url}`)
      return await this.adapter.handle({ type: "openExternal", url })
    })
  }

  private registerHistoryHandlers(): void {
    console.debug("[MessageHandlerRegistry] Registering history handlers")

    this.messageBus.register("history.showTaskWithId", async (message) => {
      const { taskId } = message as any
      console.debug(`[MessageHandlerRegistry] Showing task with id: ${taskId}`)
      return await this.adapter.handle({ type: "showTaskWithId", ids: [taskId] })
    })

    this.messageBus.register("history.deleteTaskWithId", async (message) => {
      const { taskId } = message as any
      console.debug(`[MessageHandlerRegistry] Deleting task with id: ${taskId}`)
      return await this.adapter.handle({ type: "deleteTaskWithId", ids: [taskId] })
    })

    this.messageBus.register("history.exportTaskWithId", async (message) => {
      const { taskId } = message as any
      console.debug(`[MessageHandlerRegistry] Exporting task with id: ${taskId}`)
      return await this.adapter.handle({ type: "exportTaskWithId", ids: [taskId] })
    })

    this.messageBus.register("history.exportCurrentTask", async () => {
      console.debug("[MessageHandlerRegistry] Exporting current task")
      return await this.adapter.handle({ type: "exportCurrentTask" })
    })

    this.messageBus.register("history.shareCurrentTask", async () => {
      console.debug("[MessageHandlerRegistry] Sharing current task")
      return await this.adapter.handle({ type: "shareCurrentTask" })
    })

    this.messageBus.register("history.deleteMultipleTasksWithIds", async (message) => {
      const { ids } = message as any
      console.debug(`[MessageHandlerRegistry] Deleting multiple tasks: ${ids.join(", ")}`)
      return await this.adapter.handle({ type: "deleteMultipleTasksWithIds", ids })
    })
  }

  private registerMessageQueueHandlers(): void {
    console.debug("[MessageHandlerRegistry] Registering message queue handlers")

    this.messageBus.register("messageQueue.queueMessage", async (message) => {
      const { text, images } = message as any
      console.debug("[MessageHandlerRegistry] Queueing message")
      return { type: "messageQueue.messageQueued", text, images }
    })

    this.messageBus.register("messageQueue.removeQueuedMessage", async (message) => {
      const { text } = message as any
      console.debug("[MessageHandlerRegistry] Removing queued message")
      return { type: "messageQueue.queuedMessageRemoved", text }
    })

    this.messageBus.register("messageQueue.editQueuedMessage", async (message) => {
      const { payload } = message as any
      console.debug("[MessageHandlerRegistry] Editing queued message")
      return { type: "messageQueue.queuedMessageEdited", ...payload }
    })
  }

  private registerTodoHandlers(): void {
    console.debug("[MessageHandlerRegistry] Registering todo handlers")

    this.messageBus.register("todo.updateTodoList", async (message) => {
      const { todos } = message as any
      console.debug("[MessageHandlerRegistry] Updating todo list")
      return await this.adapter.handle({ type: "updateTodoList", payload: { todos } })
    })
  }

  private registerCloudHandlers(): void {
    console.debug("[MessageHandlerRegistry] Registering cloud handlers")

    this.messageBus.register("cloud.buttonClicked", async () => {
      console.debug("[MessageHandlerRegistry] Cloud button clicked")
      return { type: "cloud.buttonClicked" }
    })

    this.messageBus.register("cloud.rooCloudSignIn", async (message) => {
      const { useProviderSignup } = message as any
      console.debug("[MessageHandlerRegistry] Roo Cloud sign in")
      return await this.adapter.handle({ type: "rooCloudSignIn", useProviderSignup })
    })

    this.messageBus.register("cloud.cloudLandingPageSignIn", async () => {
      console.debug("[MessageHandlerRegistry] Cloud landing page sign in")
      return await this.adapter.handle({ type: "cloudLandingPageSignIn" })
    })

    this.messageBus.register("cloud.rooCloudSignOut", async () => {
      console.debug("[MessageHandlerRegistry] Roo Cloud sign out")
      return await this.adapter.handle({ type: "rooCloudSignOut" })
    })

    this.messageBus.register("cloud.rooCloudManualUrl", async (message) => {
      const { url } = message as any
      console.debug(`[MessageHandlerRegistry] Roo Cloud manual URL: ${url}`)
      return await this.adapter.handle({ type: "rooCloudManualUrl", url })
    })

    this.messageBus.register("cloud.claudeCodeSignIn", async () => {
      console.debug("[MessageHandlerRegistry] Claude Code sign in")
      return await this.adapter.handle({ type: "claudeCodeSignIn" })
    })

    this.messageBus.register("cloud.claudeCodeSignOut", async () => {
      console.debug("[MessageHandlerRegistry] Claude Code sign out")
      return await this.adapter.handle({ type: "claudeCodeSignOut" })
    })

    this.messageBus.register("cloud.switchOrganization", async (message) => {
      const { organizationId } = message as any
      console.debug(`[MessageHandlerRegistry] Switching organization: ${organizationId}`)
      return await this.adapter.handle({ type: "switchOrganization", organizationId })
    })
  }

  private registerContextHandlers(): void {
    console.debug("[MessageHandlerRegistry] Registering context handlers")

    this.messageBus.register("context.condenseTaskContextRequest", async (message) => {
      const { text } = message as any
      console.debug("[MessageHandlerRegistry] Condensing task context")
      return await this.adapter.handle({ type: "condenseTaskContextRequest", text })
    })
  }

  private registerUpsellHandlers(): void {
    console.debug("[MessageHandlerRegistry] Registering upsell handlers")

    this.messageBus.register("upsell.dismissUpsell", async (message) => {
      const { upsellId } = message as any
      console.debug(`[MessageHandlerRegistry] Dismissing upsell: ${upsellId}`)
      return { type: "upsell.upsellDismissed", upsellId }
    })

    this.messageBus.register("upsell.getDismissedUpsells", async () => {
      console.debug("[MessageHandlerRegistry] Getting dismissed upsells")
      return { type: "upsell.dismissedUpsellsGot", list: [] }
    })
  }

  private registerVSCodeHandlers(): void {
    console.debug("[MessageHandlerRegistry] Registering VSCode handlers")

    this.messageBus.register("vscode.updateSetting", async (message) => {
      const { setting, value } = message as any
      console.debug(`[MessageHandlerRegistry] Updating VSCode setting: ${setting}`)
      return await this.adapter.handle({ type: "updateVSCodeSetting", setting, value })
    })

    this.messageBus.register("vscode.getSetting", async (message) => {
      const { setting } = message as any
      console.debug(`[MessageHandlerRegistry] Getting VSCode setting: ${setting}`)
      return await this.adapter.handle({ type: "getVSCodeSetting", setting })
    })

    this.messageBus.register("vscode.openKeyboardShortcuts", async () => {
      console.debug("[MessageHandlerRegistry] Opening keyboard shortcuts")
      return await this.adapter.handle({ type: "openKeyboardShortcuts" })
    })
  }

  private registerAPIConfigHandlers(): void {
    console.debug("[MessageHandlerRegistry] Registering API config handlers")

    this.messageBus.register("apiConfig.saveConfiguration", async (message) => {
      const { apiConfiguration } = message as any
      console.debug("[MessageHandlerRegistry] Saving API configuration")
      return await this.adapter.handle({ type: "saveApiConfiguration", apiConfiguration })
    })

    this.messageBus.register("apiConfig.upsertConfiguration", async (message) => {
      const { name, apiConfiguration } = message as any
      console.debug(`[MessageHandlerRegistry] Upserting API configuration: ${name}`)
      return await this.adapter.handle({ type: "upsertApiConfiguration", apiConfiguration })
    })

    this.messageBus.register("apiConfig.deleteConfiguration", async (message) => {
      const { name } = message as any
      console.debug(`[MessageHandlerRegistry] Deleting API configuration: ${name}`)
      return await this.adapter.handle({ type: "deleteApiConfiguration", ids: [name] })
    })

    this.messageBus.register("apiConfig.loadConfiguration", async (message) => {
      const { name } = message as any
      console.debug(`[MessageHandlerRegistry] Loading API configuration: ${name}`)
      return await this.adapter.handle({ type: "loadApiConfiguration", ids: [name] })
    })

    this.messageBus.register("apiConfig.loadConfigurationById", async (message) => {
      const { id } = message as any
      console.debug(`[MessageHandlerRegistry] Loading API configuration by id: ${id}`)
      return await this.adapter.handle({ type: "loadApiConfigurationById", ids: [id] })
    })

    this.messageBus.register("apiConfig.renameConfiguration", async (message) => {
      const { oldName, newName } = message as any
      console.debug(`[MessageHandlerRegistry] Renaming API configuration: ${oldName} -> ${newName}`)
      return await this.adapter.handle({ type: "renameApiConfiguration", ids: [oldName, newName] })
    })

    this.messageBus.register("apiConfig.getListConfiguration", async () => {
      console.debug("[MessageHandlerRegistry] Getting list of API configurations")
      return await this.adapter.handle({ type: "getListApiConfiguration" })
    })

    this.messageBus.register("apiConfig.setCurrentConfigurationName", async (message) => {
      const { name } = message as any
      console.debug(`[MessageHandlerRegistry] Setting current API configuration: ${name}`)
      return await this.adapter.handle({ type: "toggleApiConfigPin", ids: [name] })
    })

    this.messageBus.register("apiConfig.setPassword", async (message) => {
      const { name, password } = message as any
      console.debug(`[MessageHandlerRegistry] Setting password for API configuration: ${name}`)
      return { type: "apiConfig.passwordSet", name }
    })

    this.messageBus.register("apiConfig.togglePin", async (message) => {
      const { name } = message as any
      console.debug(`[MessageHandlerRegistry] Toggling pin for API configuration: ${name}`)
      return await this.adapter.handle({ type: "toggleApiConfigPin", ids: [name] })
    })

    this.messageBus.register("apiConfig.requestOpenAIModels", async () => {
      console.debug("[MessageHandlerRegistry] Requesting OpenAI models")
      return await this.adapter.handle({ type: "enhancementApiConfigId" })
    })
  }

  private registerPromptHandlers(): void {
    console.debug("[MessageHandlerRegistry] Registering prompt handlers")

    this.messageBus.register("prompt.updatePrompt", async (message) => {
      const { promptMode, customPrompt } = message as any
      console.debug(`[MessageHandlerRegistry] Updating prompt: ${promptMode}`)
      return await this.adapter.handle({ type: "updatePrompt", promptMode, customPrompt })
    })

    this.messageBus.register("prompt.getSystemPrompt", async (message) => {
      const { mode } = message as any
      console.debug(`[MessageHandlerRegistry] Getting system prompt for mode: ${mode}`)
      return await this.adapter.handle({ type: "getSystemPrompt", mode })
    })

    this.messageBus.register("prompt.copySystemPrompt", async (message) => {
      const { mode } = message as any
      console.debug(`[MessageHandlerRegistry] Copying system prompt for mode: ${mode}`)
      return await this.adapter.handle({ type: "copySystemPrompt", mode })
    })

    this.messageBus.register("prompt.enhancePrompt", async (message) => {
      const { text } = message as any
      console.debug("[MessageHandlerRegistry] Enhancing prompt")
      return await this.adapter.handle({ type: "enhancePrompt", text })
    })
  }

  private registerImportExportHandlers(): void {
    console.debug("[MessageHandlerRegistry] Registering import/export handlers")

    this.messageBus.register("importExport.importSettings", async () => {
      console.debug("[MessageHandlerRegistry] Importing settings")
      return await this.adapter.handle({ type: "importSettings" })
    })

    this.messageBus.register("importExport.exportSettings", async () => {
      console.debug("[MessageHandlerRegistry] Exporting settings")
      return await this.adapter.handle({ type: "exportSettings" })
    })

    this.messageBus.register("importExport.resetState", async () => {
      console.debug("[MessageHandlerRegistry] Resetting state")
      return await this.adapter.handle({ type: "resetState" })
    })
  }

  private registerTabHandlers(): void {
    console.debug("[MessageHandlerRegistry] Registering tab handlers")

    this.messageBus.register("tab.switchTab", async (message) => {
      const { tab, section } = message as any
      console.debug(`[MessageHandlerRegistry] Switching tab: ${tab}`)
      return { type: "tab.tabSwitched", tab, section }
    })
  }

  private registerRemoteControlHandlers(): void {
    console.debug("[MessageHandlerRegistry] Registering remote control handlers")

    this.messageBus.register("remoteControl.setEnabled", async (message) => {
      const { enabled } = message as any
      console.debug(`[MessageHandlerRegistry] Setting remote control enabled: ${enabled}`)
      return await this.adapter.handle({ type: "remoteControlEnabled", isEnabled: enabled })
    })

    this.messageBus.register("remoteControl.setTaskSyncEnabled", async (message) => {
      const { enabled } = message as any
      console.debug(`[MessageHandlerRegistry] Setting task sync enabled: ${enabled}`)
      return await this.adapter.handle({ type: "taskSyncEnabled", isEnabled: enabled })
    })
  }

  private registerDebugHandlers(): void {
    console.debug("[MessageHandlerRegistry] Registering debug handlers")

    this.messageBus.register("debug.openDebugApiHistory", async () => {
      console.debug("[MessageHandlerRegistry] Opening debug API history")
      return { type: "debug.debugApiHistoryOpened" }
    })

    this.messageBus.register("debug.openDebugUiHistory", async () => {
      console.debug("[MessageHandlerRegistry] Opening debug UI history")
      return { type: "debug.debugUiHistoryOpened" }
    })

    this.messageBus.register("debug.downloadErrorDiagnostics", async () => {
      console.debug("[MessageHandlerRegistry] Downloading error diagnostics")
      return { type: "debug.errorDiagnosticsDownloaded", path: "" }
    })
  }
}
