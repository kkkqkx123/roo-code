import * as vscode from "vscode"

import {
	type GlobalState,
	type RooCodeSettings,
	type HistoryItem,
	type ProviderName,
	DEFAULT_CHECKPOINT_TIMEOUT_SECONDS,
	DEFAULT_WRITE_DELAY_MS,
	DEFAULT_TERMINAL_OUTPUT_CHARACTER_LIMIT,
	ORGANIZATION_ALLOW_ALL,
} from "@roo-code/types"

import { ContextProxy } from "../config/ContextProxy"
import { GlobalFileNames } from "../../shared/globalFileNames"
import { getWorkspacePath } from "../../utils/path"
import { getGitRepositoryInfo } from "../../utils/git"
import { getTheme } from "../../integrations/theme/getTheme"
import { formatLanguage } from "../../shared/language"
import { experimentDefault } from "../../shared/experiments"
import { Mode, defaultModeSlug } from "../../shared/modes"
import { EMBEDDING_MODEL_PROFILES } from "../../shared/embeddingModels"
import { Terminal } from "../../integrations/terminal/Terminal"
import { McpHub } from "../../services/mcp/McpHub"
import type { ExtensionState } from "../../shared/ExtensionMessage"
import type { TaskManager } from "../task/TaskManager"

export class StateCoordinator {
	private contextProxy: ContextProxy
	private currentWorkspacePath: string | undefined
	private mcpHub: McpHub | undefined
	private taskManager: TaskManager | undefined

	constructor(contextProxy: ContextProxy, mcpHub?: McpHub, taskManager?: TaskManager) {
		this.contextProxy = contextProxy
		this.currentWorkspacePath = getWorkspacePath()
		this.mcpHub = mcpHub
		this.taskManager = taskManager
	}

	/**
	 * Sets the task manager instance (called after initialization to avoid circular dependency)
	 */
	public setTaskManager(taskManager: TaskManager): void {
		this.taskManager = taskManager
	}

	/**
	 * Updates a global state value
	 */
	public async updateGlobalState<K extends keyof GlobalState>(key: K, value: GlobalState[K]): Promise<void> {
		await this.contextProxy.setValue(key, value)
	}

	/**
	 * Gets a global state value
	 */
	public getGlobalState<K extends keyof GlobalState>(key: K): GlobalState[K] | undefined {
		return this.contextProxy.getValue(key)
	}

	/**
	 * Sets a configuration value
	 */
	public async setValue<K extends keyof RooCodeSettings>(key: K, value: RooCodeSettings[K]): Promise<void> {
		await this.contextProxy.setValue(key, value)
	}

	/**
	 * Gets a configuration value
	 */
	public getValue<K extends keyof RooCodeSettings>(key: K): RooCodeSettings[K] | undefined {
		return this.contextProxy.getValue(key)
	}

	/**
	 * Gets all configuration values
	 */
	public getValues(): RooCodeSettings {
		return this.contextProxy.getValues()
	}

	/**
	 * Sets multiple configuration values
	 */
	public async setValues(values: RooCodeSettings): Promise<void> {
		await this.contextProxy.setValues(values)
	}

	/**
	 * Resets the state to default values
	 */
	public async resetState(): Promise<void> {
		await this.contextProxy.resetAllState()
	}

	/**
	 * Gets the current state to post to webview
	 */
	public async getStateToPostToWebview(): Promise<ExtensionState> {
		const stateValues = this.contextProxy.getValues()

		const apiConfiguration = this.contextProxy.getProviderSettings()

		const cwd = this.currentWorkspacePath || getWorkspacePath()

		const theme = getTheme()

		const isBrowserSessionActive = this.taskManager?.getCurrentTask()?.browserSession?.isSessionActive() ?? false

		return {
			version: vscode.extensions.getExtension("roo-cline.roo-code")?.packageJSON?.version ?? "",
			apiConfiguration,
			customInstructions: stateValues.customInstructions ?? "",
			apiModelId: stateValues.apiModelId,
			alwaysAllowReadOnly: stateValues.alwaysAllowReadOnly ?? false,
			alwaysAllowReadOnlyOutsideWorkspace: stateValues.alwaysAllowReadOnlyOutsideWorkspace ?? false,
			alwaysAllowWrite: stateValues.alwaysAllowWrite ?? false,
			alwaysAllowWriteOutsideWorkspace: stateValues.alwaysAllowWriteOutsideWorkspace ?? false,
			alwaysAllowWriteProtected: stateValues.alwaysAllowWriteProtected ?? false,
			alwaysAllowExecute: stateValues.alwaysAllowExecute ?? false,
			alwaysAllowBrowser: stateValues.alwaysAllowBrowser ?? false,
			alwaysAllowMcp: stateValues.alwaysAllowMcp ?? false,
			alwaysAllowModeSwitch: stateValues.alwaysAllowModeSwitch ?? false,
			alwaysAllowSubtasks: stateValues.alwaysAllowSubtasks ?? false,
			allowedMaxRequests: stateValues.allowedMaxRequests,
			allowedMaxCost: stateValues.allowedMaxCost,
			autoCondenseContext: stateValues.autoCondenseContext ?? true,
			autoCondenseContextPercent: stateValues.autoCondenseContextPercent ?? 100,
			taskHistory: stateValues.taskHistory ?? [],
			allowedCommands: stateValues.allowedCommands,
			deniedCommands: stateValues.deniedCommands,
			soundEnabled: stateValues.soundEnabled ?? false,
			ttsEnabled: stateValues.ttsEnabled ?? false,
			ttsSpeed: stateValues.ttsSpeed ?? 1.0,
			diffEnabled: stateValues.diffEnabled ?? true,
			enableCheckpoints: stateValues.enableCheckpoints ?? true,
			checkpointTimeout: stateValues.checkpointTimeout ?? DEFAULT_CHECKPOINT_TIMEOUT_SECONDS,
			soundVolume: stateValues.soundVolume ?? 0.5,
			browserViewportSize: stateValues.browserViewportSize ?? "900x600",
			screenshotQuality: stateValues.screenshotQuality ?? 75,
			remoteBrowserHost: stateValues.remoteBrowserHost,
			remoteBrowserEnabled: stateValues.remoteBrowserEnabled ?? false,
			cachedChromeHostUrl: stateValues.cachedChromeHostUrl as string | undefined,
			fuzzyMatchThreshold: stateValues.fuzzyMatchThreshold ?? 1.0,
			writeDelayMs: stateValues.writeDelayMs ?? DEFAULT_WRITE_DELAY_MS,
			terminalOutputLineLimit: stateValues.terminalOutputLineLimit ?? 500,
			terminalOutputCharacterLimit:
				stateValues.terminalOutputCharacterLimit ?? DEFAULT_TERMINAL_OUTPUT_CHARACTER_LIMIT,
			terminalShellIntegrationTimeout:
				stateValues.terminalShellIntegrationTimeout ?? Terminal.defaultShellIntegrationTimeout,
			terminalShellIntegrationDisabled: stateValues.terminalShellIntegrationDisabled ?? true,
			terminalCommandDelay: stateValues.terminalCommandDelay ?? 0,
			terminalPowershellCounter: stateValues.terminalPowershellCounter ?? false,
			terminalZshClearEolMark: stateValues.terminalZshClearEolMark ?? true,
			terminalZshOhMy: stateValues.terminalZshOhMy ?? false,
			terminalZshP10k: stateValues.terminalZshP10k ?? false,
			terminalZdotdir: stateValues.terminalZdotdir ?? false,
			terminalCompressProgressBar: stateValues.terminalCompressProgressBar ?? true,
			mode: stateValues.mode ?? defaultModeSlug,
			language: stateValues.language ?? formatLanguage(vscode.env.language),
			mcpEnabled: stateValues.mcpEnabled ?? true,
			enableMcpServerCreation: stateValues.enableMcpServerCreation ?? true,
			mcpServers: this.mcpHub?.getAllServers() ?? [],
			currentApiConfigName: stateValues.currentApiConfigName ?? "default",
			listApiConfigMeta: stateValues.listApiConfigMeta ?? [],
			pinnedApiConfigs: stateValues.pinnedApiConfigs ?? {},
			modeApiConfigs: stateValues.modeApiConfigs ?? ({} as Record<Mode, string>),
			customModePrompts: stateValues.customModePrompts ?? {},
			customSupportPrompts: stateValues.customSupportPrompts ?? {},
			enhancementApiConfigId: stateValues.enhancementApiConfigId,
			experiments: stateValues.experiments ?? experimentDefault,
			autoApprovalEnabled: stateValues.autoApprovalEnabled ?? false,
			customModes: [],
			maxOpenTabsContext: stateValues.maxOpenTabsContext ?? 20,
			maxWorkspaceFiles: stateValues.maxWorkspaceFiles ?? 200,
			browserToolEnabled: stateValues.browserToolEnabled ?? true,
			showRooIgnoredFiles: stateValues.showRooIgnoredFiles ?? false,
			maxReadFileLine: stateValues.maxReadFileLine ?? -1,
			maxImageFileSize: stateValues.maxImageFileSize ?? 5,
			maxTotalImageSize: stateValues.maxTotalImageSize ?? 20,
			maxConcurrentFileReads: stateValues.maxConcurrentFileReads ?? 5,
			historyPreviewCollapsed: stateValues.historyPreviewCollapsed ?? false,
			reasoningBlockCollapsed: stateValues.reasoningBlockCollapsed ?? true,
			enterBehavior: stateValues.enterBehavior ?? "send",
			organizationAllowList: ORGANIZATION_ALLOW_ALL,
			organizationSettingsVersion: -1,
			condensingApiConfigId: stateValues.condensingApiConfigId,
			customCondensingPrompt: stateValues.customCondensingPrompt,
			codebaseIndexModels: stateValues.codebaseIndexModels ?? EMBEDDING_MODEL_PROFILES,
			codebaseIndexConfig: {
				codebaseIndexEnabled: stateValues.codebaseIndexConfig?.codebaseIndexEnabled ?? false,
				codebaseIndexQdrantUrl:
					stateValues.codebaseIndexConfig?.codebaseIndexQdrantUrl ?? "http://localhost:6333",
				codebaseIndexEmbedderProvider:
					stateValues.codebaseIndexConfig?.codebaseIndexEmbedderProvider ?? "openai",
				codebaseIndexEmbedderBaseUrl: stateValues.codebaseIndexConfig?.codebaseIndexEmbedderBaseUrl ?? "",
				codebaseIndexEmbedderModelId: stateValues.codebaseIndexConfig?.codebaseIndexEmbedderModelId ?? "",
				codebaseIndexEmbedderModelDimension:
					stateValues.codebaseIndexConfig?.codebaseIndexEmbedderModelDimension,
				codebaseIndexOpenAiCompatibleBaseUrl:
					stateValues.codebaseIndexConfig?.codebaseIndexOpenAiCompatibleBaseUrl,
				codebaseIndexSearchMaxResults: stateValues.codebaseIndexConfig?.codebaseIndexSearchMaxResults,
				codebaseIndexSearchMinScore: stateValues.codebaseIndexConfig?.codebaseIndexSearchMinScore,
			},
			profileThresholds: stateValues.profileThresholds ?? {},
			includeDiagnosticMessages: stateValues.includeDiagnosticMessages ?? true,
			maxDiagnosticMessages: stateValues.maxDiagnosticMessages ?? 50,
			includeTaskHistoryInEnhance: stateValues.includeTaskHistoryInEnhance ?? true,
			includeCurrentTime: stateValues.includeCurrentTime ?? true,
			includeCurrentCost: stateValues.includeCurrentCost ?? true,
			maxGitStatusFiles: stateValues.maxGitStatusFiles ?? 0,
			taskSyncEnabled: false,
			remoteControlEnabled: false,
			imageGenerationProvider: stateValues.imageGenerationProvider,
			featureRoomoteControlEnabled: false,
			claudeCodeIsAuthenticated: false,
			debug: vscode.workspace.getConfiguration("roo-cline").get<boolean>("debug", false),
			shouldShowAnnouncement: true,
			hasSystemPromptOverride: false,
			clineMessages: [],
			renderContext: "sidebar",
			hasOpenedModeSelector: false,
			isBrowserSessionActive,
		}
	}

	/**
	 * Gets the full state (same as getStateToPostToWebview)
	 */
	public async getState(): Promise<ExtensionState> {
		return this.getStateToPostToWebview()
	}

	/**
	 * Gets API configuration
	 */
	public getApiConfiguration(): any {
		return this.contextProxy.getProviderSettings()
	}

	/**
	 * Updates API configuration
	 */
	public async updateApiConfiguration(config: any): Promise<void> {
		await this.contextProxy.setProviderSettings(config)
	}

	/**
	 * Gets the current workspace path
	 */
	public getCurrentWorkspacePath(): string | undefined {
		return this.currentWorkspacePath
	}

	/**
	 * Sets the current workspace path
	 */
	public setCurrentWorkspacePath(path: string | undefined): void {
		this.currentWorkspacePath = path
	}

	/**
	 * Updates task history
	 */
	public async updateTaskHistory(item: HistoryItem): Promise<HistoryItem[]> {
		const history = (this.contextProxy.getValues().taskHistory as HistoryItem[] | undefined) || []
		const existingItemIndex = history.findIndex((h) => h.id === item.id)

		if (existingItemIndex !== -1) {
			history[existingItemIndex] = {
				...history[existingItemIndex],
				...item,
			}
		} else {
			history.push(item)
		}

		await this.contextProxy.setValue("taskHistory", history)
		return history
	}

	/**
	 * Disposes the state coordinator
	 */
	public dispose(): void {
	}
}
