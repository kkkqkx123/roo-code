import * as vscode from "vscode"

import {
	type GlobalState,
	type RooCodeSettings,
	type HistoryItem,
	type ProviderName,
} from "@shared/types"
import {
	DEFAULT_CHECKPOINT_TIMEOUT_SECONDS,
	DEFAULT_WRITE_DELAY_MS,
	DEFAULT_TERMINAL_OUTPUT_CHARACTER_LIMIT,
} from "@core/constants/default-values"

import { ContextProxy } from "../config/ContextProxy"
import { getWorkspacePath } from "../../utils/path"
import { getTheme } from "../../integrations/theme/getTheme"
import { formatLanguage } from "../../shared/language"
import { experimentDefault } from "../../shared/experiments"
import { Mode, defaultModeSlug } from "@core/modes/mode-utils"
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
	 * Applies terminal settings from the current state
	 */
	public async applyTerminalSettings(): Promise<void> {
		try {
			const state = await this.getState()

			Terminal.setShellIntegrationTimeout(state.terminalShellIntegrationTimeout ?? Terminal.defaultShellIntegrationTimeout)
			Terminal.setShellIntegrationDisabled(state.terminalShellIntegrationDisabled ?? false)
			Terminal.setCommandDelay(state.terminalCommandDelay ?? 0)
			Terminal.setTerminalZshClearEolMark(state.terminalZshClearEolMark ?? true)
			Terminal.setTerminalZshOhMy(state.terminalZshOhMy ?? false)
			Terminal.setTerminalZshP10k(state.terminalZshP10k ?? false)
			Terminal.setPowershellCounter(state.terminalPowershellCounter ?? false)
			Terminal.setTerminalZdotdir(state.terminalZdotdir ?? false)

			console.log("[StateCoordinator] Terminal settings applied")
		} catch (error) {
			console.warn(`[StateCoordinator] Failed to apply terminal settings: ${error instanceof Error ? error.message : String(error)}`)
		}
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

		const isBrowserSessionActive = this.taskManager?.getCurrentTask()?.getBrowserSession()?.isSessionActive() ?? false

		const currentTask = this.taskManager?.getCurrentTask()

		return {
			version: vscode.extensions.getExtension("coder.coder")?.packageJSON?.version ?? "",
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
			customModes: stateValues.customModes ?? [],
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
			condensingApiConfigId: stateValues.condensingApiConfigId,
			customCondensingPrompt: stateValues.customCondensingPrompt,
			codebaseIndexModels: stateValues.codebaseIndexModels ?? EMBEDDING_MODEL_PROFILES,
			profileThresholds: stateValues.profileThresholds ?? {},
			includeDiagnosticMessages: stateValues.includeDiagnosticMessages ?? true,
			maxDiagnosticMessages: stateValues.maxDiagnosticMessages ?? 50,
			includeTaskHistoryInEnhance: stateValues.includeTaskHistoryInEnhance ?? true,
			includeCurrentTime: stateValues.includeCurrentTime ?? true,
			includeCurrentCost: stateValues.includeCurrentCost ?? true,
			maxGitStatusFiles: stateValues.maxGitStatusFiles ?? 0,
			requestDelaySeconds: stateValues.requestDelaySeconds,
			clineMessages: currentTask?.clineMessages ?? [],
			currentTaskItem: currentTask
				? {
					id: currentTask.taskId,
					number: currentTask.taskNumber,
					ts: Date.now(),
					task: currentTask.metadata.task || "",
					tokensIn: 0,
					tokensOut: 0,
					totalCost: 0,
				}
				: undefined,
			uriScheme: undefined,
			shouldShowAnnouncement: false,
			checkpointBeforeHighRiskCommands: stateValues.checkpointBeforeHighRiskCommands ?? false,
			checkpointAfterHighRiskCommands: stateValues.checkpointAfterHighRiskCommands ?? false,
			checkpointOnCommandError: stateValues.checkpointOnCommandError ?? true,
			checkpointCommands: stateValues.checkpointCommands ?? [],
			noCheckpointCommands: stateValues.noCheckpointCommands ?? [],
			checkpointShellSpecific: stateValues.checkpointShellSpecific ?? {},
			cwd,
			renderContext: "sidebar",
			settingsImportedAt: undefined,
			isBrowserSessionActive,
			hasOpenedModeSelector: stateValues.hasOpenedModeSelector ?? false,
			lastShownAnnouncementId: stateValues.lastShownAnnouncementId,
			hasSystemPromptOverride: undefined,
			remoteControlEnabled: false,
			taskSyncEnabled: false,
			featureRoomoteControlEnabled: false,
			claudeCodeIsAuthenticated: undefined,
			debug: vscode.workspace.getConfiguration("coder").get<boolean>("debug", false),
		}
	}

	/**
	 * Gets the full state (same as getStateToPostToWebview)
	 */
	public async getState(): Promise<ExtensionState> {
		return this.getStateToPostToWebview()
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
