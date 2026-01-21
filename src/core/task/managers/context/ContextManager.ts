import { FileContextTracker } from "../../../file-tracking/FileContextTracker"
import { RooIgnoreController } from "../../../ignore/RooIgnoreController"
import { RooProtectedController } from "../../../protect/RooProtectedController"
import type { ClineProvider } from "../../../webview/ClineProvider"
import { manageContext, type ContextManagementOptions, type ContextManagementResult, DEFAULT_CONTEXT_CONDENSE_PERCENT } from "../../../context"
import { getModelMaxOutputTokens } from "../../../../shared/api"
import { isNativeProtocol, TOOL_PROTOCOL } from "@core/tools/tool-utils"
import { buildApiHandler, type ApiHandler } from "../../../../api"
import type { ProviderSettings, ClineSay, ToolProgressStatus } from "@shared/types"
import type { ContextCondense, ContextTruncation } from "@shared/types"

export interface ContextManagerOptions {
	cwd: string
	provider: ClineProvider
	taskId: string
}

export interface HandleContextWindowExceededOptions {
	api: ApiHandler
	apiConfiguration: ProviderSettings
	apiConversationHistory: any[]
	tokenUsage: { contextTokens: number }
	toolProtocol?: string
	getSystemPrompt: () => Promise<string>
	overwriteApiConversationHistory: (messages: any[]) => Promise<void>
	say: (type: ClineSay, text?: string, images?: string[], partial?: boolean, checkpoint?: any, progressStatus?: ToolProgressStatus, options?: any, contextCondense?: ContextCondense, contextTruncation?: ContextTruncation) => Promise<any>
}

export class ContextManager {
	readonly cwd: string
	readonly taskId: string
	readonly provider: ClineProvider
	rooIgnoreController?: RooIgnoreController
	rooProtectedController?: RooProtectedController
	fileContextTracker: FileContextTracker

	constructor(options: ContextManagerOptions) {
		this.cwd = options.cwd
		this.taskId = options.taskId
		this.provider = options.provider

		this.rooIgnoreController = new RooIgnoreController(this.cwd)
		this.rooProtectedController = new RooProtectedController(this.cwd)
		this.fileContextTracker = new FileContextTracker(this.provider, this.taskId)

		this.rooIgnoreController.initialize().catch((error) => {
			console.error("[ContextManager] Failed to initialize RooIgnoreController:", error)
		})
	}

	async isFileIgnored(filePath: string): Promise<boolean> {
		if (this.rooIgnoreController) {
			return !this.rooIgnoreController.validateAccess(filePath)
		}
		return false
	}

	async isFileProtected(filePath: string): Promise<boolean> {
		if (this.rooProtectedController) {
			return this.rooProtectedController.isWriteProtected(filePath)
		}
		return false
	}

	getFileContextTracker(): FileContextTracker {
		return this.fileContextTracker
	}

	getRooIgnoreController(): RooIgnoreController | undefined {
		return this.rooIgnoreController
	}

	getRooProtectedController(): RooProtectedController | undefined {
		return this.rooProtectedController
	}

	async dispose(): Promise<void> {
		this.fileContextTracker.dispose()
	}

	/**
	 * Handle context window exceeded errors by managing conversation context
	 */
	async handleContextWindowExceededError(options: HandleContextWindowExceededOptions): Promise<void> {
		const { api, apiConfiguration, apiConversationHistory, tokenUsage, toolProtocol, getSystemPrompt, overwriteApiConversationHistory, say } = options

		// Get provider state for configuration
		const state = await this.provider.getState()
		const { 
			autoCondenseContext = true, 
			autoCondenseContextPercent = 100,
			profileThresholds = {},
			customCondensingPrompt,
			condensingApiConfigId,
			listApiConfigMeta,
		} = state ?? {}

		// Get model information
		const modelInfo = api.getModel().info
		const maxTokens = getModelMaxOutputTokens({
			modelId: api.getModel().id,
			model: modelInfo,
			settings: apiConfiguration,
		})
		const contextWindow = modelInfo.contextWindow
		const contextTokens = tokenUsage.contextTokens

		// Get current profile ID
		const currentProfileId = this.getCurrentProfileId(state)
		const useNativeTools = isNativeProtocol(toolProtocol === "native" ? TOOL_PROTOCOL.NATIVE : TOOL_PROTOCOL.XML)

		// Setup condensing API handler if configured
		let condensingApiHandler: ApiHandler | undefined
		if (condensingApiConfigId && listApiConfigMeta && Array.isArray(listApiConfigMeta)) {
			const matchingConfig = listApiConfigMeta.find((config) => config.id === condensingApiConfigId)
			if (matchingConfig) {
				const profile = await this.provider.providerSettingsManager.getProfile({
					id: condensingApiConfigId,
				})
				if (profile && profile.apiProvider) {
					// Build the condensing API handler
					condensingApiHandler = buildApiHandler(profile)
					console.log(`[ContextManager] Using condensing API config: ${condensingApiConfigId}`)
				}
			}
		}

		// Log the context window error
		console.warn(
			`[ContextManager#${this.taskId}] Context window exceeded for model ${api.getModel().id}. ` +
				`Current tokens: ${contextTokens}, Context window: ${contextWindow}. ` +
				`Attempting context management...`
		)

		// Send condenseTaskContextStarted to show in-progress indicator
		await this.provider.postMessageToWebview({ type: "condenseTaskContextStarted", text: this.taskId })

		try {
			// Force aggressive context management with 75% retention
			const truncateResult = await manageContext({
				messages: apiConversationHistory,
				totalTokens: contextTokens || 0,
				maxTokens,
				contextWindow,
				apiHandler: api,
				autoCondenseContext: true,
				autoCondenseContextPercent: DEFAULT_CONTEXT_CONDENSE_PERCENT,
				systemPrompt: await getSystemPrompt(),
				taskId: this.taskId,
				profileThresholds,
				currentProfileId,
				useNativeTools,
				customCondensingPrompt,
				condensingApiHandler,
			})

			// Update conversation history if changed
			if (truncateResult.messages !== apiConversationHistory) {
				await overwriteApiConversationHistory(truncateResult.messages)
			}

			// Handle results based on what type of context management occurred
			if (truncateResult.summary) {
				// Context condensation occurred
				const { summary, cost, prevContextTokens, newContextTokens = 0 } = truncateResult
				const contextCondense: ContextCondense = { 
					summary, 
					cost, 
					newContextTokens, 
					prevContextTokens 
				}
				await say(
					"condense_context",
					undefined,
					undefined,
					false,
					undefined,
					undefined,
					{ isNonInteractive: true },
					contextCondense,
				)
			} else if (truncateResult.truncationId) {
				// Sliding window truncation occurred (fallback)
				const contextTruncation: ContextTruncation = {
					truncationId: truncateResult.truncationId,
					messagesRemoved: truncateResult.messagesRemoved ?? 0,
					prevContextTokens: truncateResult.prevContextTokens,
					newContextTokens: truncateResult.newContextTokensAfterTruncation ?? 0,
				}
				await say(
					"sliding_window_truncation",
					undefined,
					undefined,
					false,
					undefined,
					undefined,
					{ isNonInteractive: true },
					undefined,
					contextTruncation,
				)
			}

			// Send completion notification
			await this.provider.postMessageToWebview({ type: "condenseTaskContextResponse", text: this.taskId })

		} catch (error) {
			console.error(`[ContextManager#${this.taskId}] Context management failed:`, error)
			await say(
				"condense_context_error",
				`Context management failed: ${error instanceof Error ? error.message : String(error)}`,
				undefined,
				false,
				undefined,
				undefined,
				{ isNonInteractive: true },
			)
			throw error
		}
	}

	/**
	 * Get current profile ID from state
	 */
	private getCurrentProfileId(state: any): string {
		// This is a simplified version - the actual implementation would depend on how profiles are managed
		return state?.currentProfileId || "default"
	}
}
