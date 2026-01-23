import * as vscode from "vscode"
import crypto from "crypto"

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
} from "@shared/constants/default-values"

import { ContextProxy } from "../config/ContextProxy"
import { getWorkspacePath } from "../../utils/path"
import { getTheme } from "../../integrations/theme/getTheme"
import { formatLanguage } from "@shared/language"
import { experimentDefault } from "@shared/config/experiment-utils"
import { Mode, defaultModeSlug } from "@core/modes/mode-utils"
import { EMBEDDING_MODEL_PROFILES } from "@shared/config/embedding-models"
import { Terminal } from "../../integrations/terminal/Terminal"
import { McpHub } from "../../services/mcp/McpHub"
import type { ExtensionState } from "@shared/ExtensionMessage"
import type { TaskManager } from "../task/TaskManager"

export class StateCoordinator {
	private contextProxy: ContextProxy
	private currentWorkspacePath: string | undefined
	private mcpHub: McpHub | undefined
	private taskManager: TaskManager | undefined

	private stateVersion = 0
	private lastStateHash = ""
	private stateHistory: Map<number, string> = new Map()
	private maxStateHistorySize = 10

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
	 * Gets the current state to post to webview with validation
	 */
	public async getStateToPostToWebview(): Promise<ExtensionState> {
		try {
			const state = await this.buildState()

			if (!this.validateState(state)) {
				console.error("[StateCoordinator] State validation failed, using fallback state")
				return await this.getFallbackState()
			}

			const stateHash = this.calculateStateHash(state)

			if (stateHash === this.lastStateHash) {
				console.debug("[StateCoordinator] State unchanged, skipping version increment")
			} else {
				this.lastStateHash = stateHash
				this.stateVersion++
				this.addToStateHistory(this.stateVersion, stateHash)
				console.log(`[StateCoordinator] State updated to version ${this.stateVersion}, hash: ${stateHash.substring(0, 8)}`)
			}

			return state
		} catch (error) {
			console.error("[StateCoordinator] Error building state, using fallback:", error)
			return await this.getFallbackState()
		}
	}

	/**
	 * Builds the state object
	 */
	private async buildState(): Promise<ExtensionState> {
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
			alwaysAllowFollowupQuestions: stateValues.alwaysAllowFollowupQuestions ?? false,
			followupAutoApproveTimeoutMs: stateValues.followupAutoApproveTimeoutMs,
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
			diagnosticsEnabled: stateValues.diagnosticsEnabled ?? false,
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
			codebaseIndexConfig: stateValues.codebaseIndexConfig,
			dismissedUpsells: stateValues.dismissedUpsells ?? [],
		}
	}

	/**
	 * Validates the state object
	 */
	private validateState(state: ExtensionState): boolean {
		try {
			if (!state.apiConfiguration) {
				console.warn("[StateCoordinator] Validation failed: apiConfiguration is missing")
				return false
			}

			if (!state.cwd) {
				console.warn("[StateCoordinator] Validation failed: cwd is missing")
				return false
			}

			const currentTask = this.taskManager?.getCurrentTask()
			if (currentTask && !state.currentTaskItem) {
				console.warn("[StateCoordinator] Validation warning: Task exists but currentTaskItem is missing")
			}

			if (!state.currentTaskItem && currentTask) {
				console.warn("[StateCoordinator] Validation warning: currentTaskItem exists but no current task")
			}

			return true
		} catch (error) {
			console.error("[StateCoordinator] Validation error:", error)
			return false
		}
	}

	/**
	 * Calculates a hash of the state for change detection
	 */
	private calculateStateHash(state: ExtensionState): string {
		const relevantFields = {
			apiConfiguration: state.apiConfiguration,
			currentTaskItem: state.currentTaskItem,
			mode: state.mode,
			isBrowserSessionActive: state.isBrowserSessionActive,
			clineMessages: state.clineMessages?.length ?? 0,
		}
		return crypto.createHash('sha256').update(JSON.stringify(relevantFields)).digest('hex')
	}

	/**
	 * Adds state hash to history
	 */
	private addToStateHistory(version: number, hash: string): void {
		this.stateHistory.set(version, hash)

		if (this.stateHistory.size > this.maxStateHistorySize) {
			const oldestVersion = Math.min(...this.stateHistory.keys())
			this.stateHistory.delete(oldestVersion)
		}
	}

	/**
	 * Gets a fallback state when validation fails
	 */
	private async getFallbackState(): Promise<ExtensionState> {
		console.warn("[StateCoordinator] Using fallback state")
		const stateValues = this.contextProxy.getValues()
		return {
			version: "",
			apiConfiguration: this.contextProxy.getProviderSettings(),
			cwd: this.currentWorkspacePath || getWorkspacePath(),
			mode: defaultModeSlug,
			language: formatLanguage(vscode.env.language),
			clineMessages: [],
			currentTaskItem: undefined,
			isBrowserSessionActive: false,
			debug: false,
			currentApiConfigName: stateValues.currentApiConfigName ?? "default",
			listApiConfigMeta: stateValues.listApiConfigMeta ?? [],
			pinnedApiConfigs: stateValues.pinnedApiConfigs ?? {},
			customInstructions: stateValues.customInstructions ?? "",
			dismissedUpsells: stateValues.dismissedUpsells ?? [],
			autoApprovalEnabled: stateValues.autoApprovalEnabled ?? false,
			alwaysAllowReadOnly: stateValues.alwaysAllowReadOnly ?? false,
			alwaysAllowReadOnlyOutsideWorkspace: stateValues.alwaysAllowReadOnlyOutsideWorkspace ?? false,
			alwaysAllowWrite: stateValues.alwaysAllowWrite ?? false,
			alwaysAllowWriteOutsideWorkspace: stateValues.alwaysAllowWriteOutsideWorkspace ?? false,
			alwaysAllowWriteProtected: stateValues.alwaysAllowWriteProtected ?? false,
			alwaysAllowBrowser: stateValues.alwaysAllowBrowser ?? false,
			alwaysAllowMcp: stateValues.alwaysAllowMcp ?? false,
			alwaysAllowModeSwitch: stateValues.alwaysAllowModeSwitch ?? false,
			alwaysAllowSubtasks: stateValues.alwaysAllowSubtasks ?? false,
			alwaysAllowFollowupQuestions: stateValues.alwaysAllowFollowupQuestions ?? false,
			alwaysAllowExecute: stateValues.alwaysAllowExecute ?? false,
			followupAutoApproveTimeoutMs: stateValues.followupAutoApproveTimeoutMs ?? 30000,
			allowedCommands: stateValues.allowedCommands,
			deniedCommands: stateValues.deniedCommands,
			allowedMaxRequests: stateValues.allowedMaxRequests,
			allowedMaxCost: stateValues.allowedMaxCost,
			browserToolEnabled: stateValues.browserToolEnabled ?? true,
			browserViewportSize: stateValues.browserViewportSize ?? "900x600",
			screenshotQuality: stateValues.screenshotQuality ?? 75,
			remoteBrowserEnabled: stateValues.remoteBrowserEnabled ?? false,
			cachedChromeHostUrl: stateValues.cachedChromeHostUrl as string | undefined,
			remoteBrowserHost: stateValues.remoteBrowserHost,
			ttsEnabled: stateValues.ttsEnabled ?? false,
			ttsSpeed: stateValues.ttsSpeed ?? 1.0,
			soundEnabled: stateValues.soundEnabled ?? false,
			soundVolume: stateValues.soundVolume ?? 0.5,
			maxConcurrentFileReads: stateValues.maxConcurrentFileReads ?? 5,
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
			diagnosticsEnabled: stateValues.diagnosticsEnabled ?? false,
			diffEnabled: stateValues.diffEnabled ?? true,
			fuzzyMatchThreshold: stateValues.fuzzyMatchThreshold ?? 1.0,
			modeApiConfigs: stateValues.modeApiConfigs ?? ({} as Record<Mode, string>),
			customModePrompts: stateValues.customModePrompts ?? {},
			customSupportPrompts: stateValues.customSupportPrompts ?? {},
			enhancementApiConfigId: stateValues.enhancementApiConfigId,
			condensingApiConfigId: stateValues.condensingApiConfigId,
			customCondensingPrompt: stateValues.customCondensingPrompt,
			codebaseIndexConfig: stateValues.codebaseIndexConfig,
			codebaseIndexModels: stateValues.codebaseIndexModels ?? EMBEDDING_MODEL_PROFILES,
			profileThresholds: stateValues.profileThresholds ?? {},
			includeDiagnosticMessages: stateValues.includeDiagnosticMessages ?? true,
			maxDiagnosticMessages: stateValues.maxDiagnosticMessages ?? 50,
			includeTaskHistoryInEnhance: stateValues.includeTaskHistoryInEnhance ?? true,
			reasoningBlockCollapsed: stateValues.reasoningBlockCollapsed ?? true,
			enterBehavior: stateValues.enterBehavior ?? "send",
			includeCurrentTime: stateValues.includeCurrentTime ?? true,
			includeCurrentCost: stateValues.includeCurrentCost ?? true,
			maxGitStatusFiles: stateValues.maxGitStatusFiles ?? 0,
			requestDelaySeconds: stateValues.requestDelaySeconds,
			uriScheme: undefined,
			shouldShowAnnouncement: false,
			taskHistory: stateValues.taskHistory ?? [],
			writeDelayMs: stateValues.writeDelayMs ?? DEFAULT_WRITE_DELAY_MS,
			enableCheckpoints: stateValues.enableCheckpoints ?? true,
			checkpointTimeout: stateValues.checkpointTimeout ?? DEFAULT_CHECKPOINT_TIMEOUT_SECONDS,
			checkpointBeforeHighRiskCommands: stateValues.checkpointBeforeHighRiskCommands ?? false,
			checkpointAfterHighRiskCommands: stateValues.checkpointAfterHighRiskCommands ?? false,
			checkpointOnCommandError: stateValues.checkpointOnCommandError ?? true,
			checkpointCommands: stateValues.checkpointCommands ?? [],
			noCheckpointCommands: stateValues.noCheckpointCommands ?? [],
			checkpointShellSpecific: stateValues.checkpointShellSpecific ?? {},
			maxOpenTabsContext: stateValues.maxOpenTabsContext ?? 20,
			maxWorkspaceFiles: stateValues.maxWorkspaceFiles ?? 200,
			showRooIgnoredFiles: stateValues.showRooIgnoredFiles ?? false,
			maxReadFileLine: stateValues.maxReadFileLine ?? -1,
			maxImageFileSize: stateValues.maxImageFileSize ?? 5,
			maxTotalImageSize: stateValues.maxTotalImageSize ?? 20,
			experiments: stateValues.experiments ?? experimentDefault,
			mcpEnabled: stateValues.mcpEnabled ?? true,
			enableMcpServerCreation: stateValues.enableMcpServerCreation ?? true,
			customModes: stateValues.customModes ?? [],
			hasOpenedModeSelector: stateValues.hasOpenedModeSelector ?? false,
			lastShownAnnouncementId: stateValues.lastShownAnnouncementId,
			hasSystemPromptOverride: undefined,
			remoteControlEnabled: false,
			taskSyncEnabled: false,
			featureRoomoteControlEnabled: false,
			claudeCodeIsAuthenticated: undefined,
			renderContext: "sidebar",
			autoCondenseContext: stateValues.autoCondenseContext ?? true,
			autoCondenseContextPercent: stateValues.autoCondenseContextPercent ?? 100,
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
