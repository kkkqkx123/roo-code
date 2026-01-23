import { z } from "zod"

export const TaskSchemas = {
  create: z.object({
    type: z.literal("task.create"),
    text: z.string(),
    images: z.array(z.string()).optional()
  }),

  cancel: z.object({
    type: z.literal("task.cancel"),
    taskId: z.string().optional()
  }),

  clear: z.object({
    type: z.literal("task.clear")
  }),

  askResponse: z.object({
    type: z.literal("task.askResponse"),
    askResponse: z.enum(["yesButtonClicked", "noButtonClicked", "messageResponse", "objectResponse"]),
    text: z.string().optional(),
    images: z.array(z.string()).optional()
  }),

  deleteMessageConfirm: z.object({
    type: z.literal("task.deleteMessageConfirm"),
    messageTs: z.number(),
    restoreCheckpoint: z.boolean().optional()
  }),

  editMessageConfirm: z.object({
    type: z.literal("task.editMessageConfirm"),
    messageTs: z.number(),
    text: z.string(),
    restoreCheckpoint: z.boolean().optional(),
    images: z.array(z.string()).optional()
  }),

  humanRelayResponse: z.object({
    type: z.literal("task.humanRelayResponse"),
    requestId: z.string(),
    text: z.string()
  }),

  humanRelayCancel: z.object({
    type: z.literal("task.humanRelayCancel"),
    requestId: z.string()
  }),

  cancelAutoApproval: z.object({
    type: z.literal("task.cancelAutoApproval")
  })
}

export const SettingsSchemas = {
  get: z.object({
    type: z.literal("settings.get")
  }),

  update: z.object({
    type: z.literal("settings.update"),
    settings: z.record(z.any())
  }),

  updateCustomInstructions: z.object({
    type: z.literal("settings.updateCustomInstructions"),
    text: z.string().optional()
  }),

  updateMode: z.object({
    type: z.literal("settings.updateMode"),
    mode: z.string()
  })
}

export const MCPSchemas = {
  toggle: z.object({
    type: z.literal("mcp.toggle"),
    serverName: z.string(),
    enabled: z.boolean()
  }),

  restart: z.object({
    type: z.literal("mcp.restart"),
    serverName: z.string()
  }),

  refreshAll: z.object({
    type: z.literal("mcp.refreshAll")
  }),

  toggleToolAlwaysAllow: z.object({
    type: z.literal("mcp.toggleToolAlwaysAllow"),
    serverName: z.string(),
    toolName: z.string(),
    alwaysAllow: z.boolean()
  }),

  toggleToolEnabledForPrompt: z.object({
    type: z.literal("mcp.toggleToolEnabledForPrompt"),
    serverName: z.string(),
    toolName: z.string(),
    isEnabled: z.boolean()
  }),

  updateTimeout: z.object({
    type: z.literal("mcp.updateTimeout"),
    serverName: z.string(),
    timeout: z.number()
  }),

  deleteServer: z.object({
    type: z.literal("mcp.deleteServer"),
    serverName: z.string()
  })
}

export const BrowserSchemas = {
  testConnection: z.object({
    type: z.literal("browser.testConnection"),
    url: z.string().optional()
  }),

  killSession: z.object({
    type: z.literal("browser.killSession")
  }),

  openSessionPanel: z.object({
    type: z.literal("browser.openSessionPanel")
  }),

  showSessionPanelAtStep: z.object({
    type: z.literal("browser.showSessionPanelAtStep"),
    stepIndex: z.number(),
    forceShow: z.boolean().optional()
  }),

  refreshSessionPanel: z.object({
    type: z.literal("browser.refreshSessionPanel")
  })
}

export const CheckpointSchemas = {
  diff: z.object({
    type: z.literal("checkpoint.diff"),
    commitHash: z.string(),
    mode: z.enum(["full", "checkpoint", "from-init", "to-current"]),
    ts: z.number().optional(),
    previousCommitHash: z.string().optional()
  }),

  restore: z.object({
    type: z.literal("checkpoint.restore"),
    commitHash: z.string(),
    mode: z.enum(["preview", "restore"]),
    restoreType: z.enum(["files_only", "context_only", "files_and_context"]).optional(),
    ts: z.number(),
    apiRequestId: z.string().optional()
  })
}

export const CommandSchemas = {
  requestCommands: z.object({
    type: z.literal("command.requestCommands")
  }),

  openCommandFile: z.object({
    type: z.literal("command.openCommandFile"),
    source: z.enum(["global", "project", "built-in"]),
    name: z.string()
  }),

  deleteCommand: z.object({
    type: z.literal("command.deleteCommand"),
    source: z.enum(["global", "project", "built-in"]),
    name: z.string()
  }),

  createCommand: z.object({
    type: z.literal("command.createCommand"),
    source: z.enum(["global", "project", "built-in"]),
    name: z.string(),
    description: z.string().optional(),
    argumentHint: z.string().optional(),
    content: z.string().optional()
  })
}

export const FileSchemas = {
  openFile: z.object({
    type: z.literal("file.openFile"),
    path: z.string()
  }),

  saveImage: z.object({
    type: z.literal("file.saveImage"),
    dataUri: z.string()
  }),

  openImage: z.object({
    type: z.literal("file.openImage"),
    dataUri: z.string()
  }),

  selectImages: z.object({
    type: z.literal("file.selectImages")
  }),

  searchFiles: z.object({
    type: z.literal("file.searchFiles"),
    query: z.string(),
    include: z.string().optional(),
    exclude: z.string().optional()
  })
}

export const GitSchemas = {
  searchCommits: z.object({
    type: z.literal("git.searchCommits"),
    query: z.string()
  })
}

export const CodeIndexSchemas = {
  requestStatus: z.object({
    type: z.literal("codeIndex.requestStatus")
  }),

  startIndexing: z.object({
    type: z.literal("codeIndex.startIndexing")
  }),

  clearIndexData: z.object({
    type: z.literal("codeIndex.clearIndexData")
  }),

  saveSettings: z.object({
    type: z.literal("codeIndex.saveSettings"),
    settings: z.object({
      codebaseIndexEnabled: z.boolean(),
      codebaseIndexQdrantUrl: z.string(),
      codebaseIndexEmbedderProvider: z.enum(["openai", "openai-compatible", "gemini"]),
      codebaseIndexEmbedderBaseUrl: z.string().optional(),
      codebaseIndexEmbedderModelId: z.string(),
      codebaseIndexEmbedderModelDimension: z.number().optional(),
      codebaseIndexOpenAiCompatibleBaseUrl: z.string().optional(),
      codebaseIndexSearchMaxResults: z.number().optional(),
      codebaseIndexSearchMinScore: z.number().optional(),
      codebaseIndexRequireIndexingConfirmation: z.boolean().optional()
    })
  }),

  requestSecretStatus: z.object({
    type: z.literal("codeIndex.requestSecretStatus")
  })
}

export const ModeSchemas = {
  updateCustomMode: z.object({
    type: z.literal("mode.updateCustomMode"),
    slug: z.string(),
    modeConfig: z.any()
  }),

  deleteCustomMode: z.object({
    type: z.literal("mode.deleteCustomMode"),
    slug: z.string(),
    checkOnly: z.boolean().optional()
  }),

  importMode: z.object({
    type: z.literal("mode.importMode"),
    modeConfig: z.any()
  }),

  exportMode: z.object({
    type: z.literal("mode.exportMode"),
    slug: z.string()
  }),

  openCustomModesSettings: z.object({
    type: z.literal("mode.openCustomModesSettings")
  })
}

export const TerminalSchemas = {
  operation: z.object({
    type: z.literal("terminal.operation"),
    terminalOperation: z.enum(["continue", "abort"])
  })
}

export const AudioSchemas = {
  playSound: z.object({
    type: z.literal("audio.playSound"),
    audioType: z.enum(["notification", "celebration", "progress_loop"])
  }),

  playTTS: z.object({
    type: z.literal("audio.playTTS"),
    text: z.string()
  }),

  stopTTS: z.object({
    type: z.literal("audio.stopTTS")
  }),

  setTTSEnabled: z.object({
    type: z.literal("audio.setTTSEnabled"),
    enabled: z.boolean()
  }),

  setTTSSpeed: z.object({
    type: z.literal("audio.setTTSSpeed"),
    speed: z.number()
  })
}

export const SystemSchemas = {
  webviewDidLaunch: z.object({
    type: z.literal("system.webviewDidLaunch")
  }),

  didShowAnnouncement: z.object({
    type: z.literal("system.didShowAnnouncement")
  }),

  focusPanelRequest: z.object({
    type: z.literal("system.focusPanelRequest")
  }),

  openExternal: z.object({
    type: z.literal("system.openExternal"),
    url: z.string()
  })
}

export const HistorySchemas = {
  showTaskWithId: z.object({
    type: z.literal("history.showTaskWithId"),
    taskId: z.string()
  }),

  deleteTaskWithId: z.object({
    type: z.literal("history.deleteTaskWithId"),
    taskId: z.string()
  }),

  exportTaskWithId: z.object({
    type: z.literal("history.exportTaskWithId"),
    taskId: z.string()
  }),

  exportCurrentTask: z.object({
    type: z.literal("history.exportCurrentTask")
  }),

  shareCurrentTask: z.object({
    type: z.literal("history.shareCurrentTask")
  }),

  deleteMultipleTasksWithIds: z.object({
    type: z.literal("history.deleteMultipleTasksWithIds"),
    ids: z.array(z.string())
  })
}

export const MessageQueueSchemas = {
  queueMessage: z.object({
    type: z.literal("messageQueue.queueMessage"),
    text: z.string(),
    images: z.array(z.string()).optional()
  }),

  removeQueuedMessage: z.object({
    type: z.literal("messageQueue.removeQueuedMessage"),
    text: z.string()
  }),

  editQueuedMessage: z.object({
    type: z.literal("messageQueue.editQueuedMessage"),
    payload: z.object({
      id: z.string(),
      text: z.string(),
      images: z.array(z.string()).optional()
    })
  })
}

export const TodoSchemas = {
  updateTodoList: z.object({
    type: z.literal("todo.updateTodoList"),
    todos: z.array(z.any())
  })
}

export const CloudSchemas = {
  cloudButtonClicked: z.object({
    type: z.literal("cloud.buttonClicked")
  }),

  rooCloudSignIn: z.object({
    type: z.literal("cloud.rooCloudSignIn"),
    useProviderSignup: z.boolean().optional()
  }),

  cloudLandingPageSignIn: z.object({
    type: z.literal("cloud.cloudLandingPageSignIn")
  }),

  rooCloudSignOut: z.object({
    type: z.literal("cloud.rooCloudSignOut")
  }),

  rooCloudManualUrl: z.object({
    type: z.literal("cloud.rooCloudManualUrl"),
    url: z.string()
  }),

  claudeCodeSignIn: z.object({
    type: z.literal("cloud.claudeCodeSignIn")
  }),

  claudeCodeSignOut: z.object({
    type: z.literal("cloud.claudeCodeSignOut")
  }),

  switchOrganization: z.object({
    type: z.literal("cloud.switchOrganization"),
    organizationId: z.string().nullable()
  })
}

export const ContextSchemas = {
  condenseTaskContextRequest: z.object({
    type: z.literal("context.condenseTaskContextRequest"),
    text: z.string().optional()
  })
}

export const UpsellSchemas = {
  dismissUpsell: z.object({
    type: z.literal("upsell.dismissUpsell"),
    upsellId: z.string()
  }),

  getDismissedUpsells: z.object({
    type: z.literal("upsell.getDismissedUpsells")
  })
}

export const VSCodeSchemas = {
  updateSetting: z.object({
    type: z.literal("vscode.updateSetting"),
    setting: z.string(),
    value: z.any()
  }),

  getSetting: z.object({
    type: z.literal("vscode.getSetting"),
    setting: z.string()
  }),

  openKeyboardShortcuts: z.object({
    type: z.literal("vscode.openKeyboardShortcuts")
  })
}

export const APIConfigSchemas = {
  saveConfiguration: z.object({
    type: z.literal("apiConfig.saveConfiguration"),
    apiConfiguration: z.any()
  }),

  upsertConfiguration: z.object({
    type: z.literal("apiConfig.upsertConfiguration"),
    name: z.string().optional(),
    apiConfiguration: z.any()
  }),

  deleteConfiguration: z.object({
    type: z.literal("apiConfig.deleteConfiguration"),
    name: z.string()
  }),

  loadConfiguration: z.object({
    type: z.literal("apiConfig.loadConfiguration"),
    name: z.string()
  }),

  loadConfigurationById: z.object({
    type: z.literal("apiConfig.loadConfigurationById"),
    id: z.string()
  }),

  renameConfiguration: z.object({
    type: z.literal("apiConfig.renameConfiguration"),
    oldName: z.string(),
    newName: z.string()
  }),

  getListConfiguration: z.object({
    type: z.literal("apiConfig.getListConfiguration")
  }),

  setCurrentConfigurationName: z.object({
    type: z.literal("apiConfig.setCurrentConfigurationName"),
    name: z.string()
  }),

  setPassword: z.object({
    type: z.literal("apiConfig.setPassword"),
    name: z.string(),
    password: z.string()
  }),

  togglePin: z.object({
    type: z.literal("apiConfig.togglePin"),
    name: z.string()
  }),

  requestOpenAIModels: z.object({
    type: z.literal("apiConfig.requestOpenAIModels")
  })
}

export const PromptSchemas = {
  updatePrompt: z.object({
    type: z.literal("prompt.updatePrompt"),
    promptMode: z.union([z.literal("enhance"), z.string()]),
    customPrompt: z.any().optional()
  }),

  getSystemPrompt: z.object({
    type: z.literal("prompt.getSystemPrompt"),
    mode: z.string().optional()
  }),

  copySystemPrompt: z.object({
    type: z.literal("prompt.copySystemPrompt"),
    mode: z.string().optional()
  }),

  enhancePrompt: z.object({
    type: z.literal("prompt.enhancePrompt"),
    text: z.string()
  })
}

export const ImportExportSchemas = {
  importSettings: z.object({
    type: z.literal("importExport.importSettings")
  }),

  exportSettings: z.object({
    type: z.literal("importExport.exportSettings")
  }),

  resetState: z.object({
    type: z.literal("importExport.resetState")
  })
}

export const TabSchemas = {
  switchTab: z.object({
    type: z.literal("tab.switchTab"),
    tab: z.enum(["settings", "history", "mcp", "modes", "chat", "cloud"]),
    section: z.string().optional()
  })
}

export const RemoteControlSchemas = {
  setRemoteControlEnabled: z.object({
    type: z.literal("remoteControl.setEnabled"),
    enabled: z.boolean()
  }),

  setTaskSyncEnabled: z.object({
    type: z.literal("remoteControl.setTaskSyncEnabled"),
    enabled: z.boolean()
  })
}

export const DebugSchemas = {
  openDebugApiHistory: z.object({
    type: z.literal("debug.openDebugApiHistory")
  }),

  openDebugUiHistory: z.object({
    type: z.literal("debug.openDebugUiHistory")
  }),

  downloadErrorDiagnostics: z.object({
    type: z.literal("debug.downloadErrorDiagnostics")
  })
}
