import { FileContextTracker } from "../../../file-tracking/FileContextTracker"
import { RooIgnoreController } from "../../../ignore/RooIgnoreController"
import { RooProtectedController } from "../../../protect/RooProtectedController"
import type { ClineProvider } from "../../../webview/ClineProvider"
import { manageContext, type ContextManagementOptions, type ContextManagementResult, DEFAULT_CONTEXT_CONDENSE_PERCENT } from "../../../context"
import { getModelMaxOutputTokens } from "@api/api-utils"
import { isNativeProtocol, TOOL_PROTOCOL } from "@shared/utils/tool-utils"
import { buildApiHandler, type ApiHandler } from "../../../../api"
import type { ProviderSettings, ClineSay, ToolProgressStatus } from "@shared/types"
import type { ContextCondense, ContextTruncation } from "@shared/types"
import { ErrorHandler } from "../../../error/ErrorHandler"

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
	private errorHandler: ErrorHandler

	constructor(options: ContextManagerOptions) {
		this.cwd = options.cwd
		this.taskId = options.taskId
		this.provider = options.provider
		this.errorHandler = new ErrorHandler()

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

		try {
			await this.executeWithRetry(
				async () => await this.performContextManagement(options),
				"handleContextWindowExceededError",
				3
			)
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

	private async performContextManagement(options: HandleContextWindowExceededOptions): Promise<void> {
		const { api, apiConfiguration, apiConversationHistory, tokenUsage, toolProtocol, getSystemPrompt, overwriteApiConversationHistory, say } = options

		const state = await this.provider.getState()
		const { 
			autoCondenseContext = true, 
			autoCondenseContextPercent = 100,
			profileThresholds = {},
			customCondensingPrompt,
			condensingApiConfigId,
			listApiConfigMeta,
		} = state ?? {}

		const modelInfo = api.getModel().info
		const maxTokens = getModelMaxOutputTokens({
			modelId: api.getModel().id,
			model: modelInfo,
			settings: apiConfiguration,
		})
		const contextWindow = modelInfo.contextWindow
		const contextTokens = tokenUsage.contextTokens

		const currentProfileId = this.getCurrentProfileId(state)
		const useNativeTools = isNativeProtocol(toolProtocol === "native" ? TOOL_PROTOCOL.NATIVE : TOOL_PROTOCOL.XML)

		let condensingApiHandler: ApiHandler | undefined
		if (condensingApiConfigId && listApiConfigMeta && Array.isArray(listApiConfigMeta)) {
			const matchingConfig = listApiConfigMeta.find((config) => config.id === condensingApiConfigId)
			if (matchingConfig) {
				const profile = await this.provider.providerSettingsManager.getProfile({
					id: condensingApiConfigId,
				})
				if (profile && profile.apiProvider) {
					condensingApiHandler = buildApiHandler(profile)
					console.log(`[ContextManager] Using condensing API config: ${condensingApiConfigId}`)
				}
			}
		}

		console.warn(
			`[ContextManager#${this.taskId}] Context window exceeded for model ${api.getModel().id}. ` +
				`Current tokens: ${contextTokens}, Context window: ${contextWindow}. ` +
				`Attempting context management...`
		)

		await this.provider.postMessageToWebview({ type: "condenseTaskContextStarted", text: this.taskId })

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

		if (truncateResult.messages !== apiConversationHistory) {
			await overwriteApiConversationHistory(truncateResult.messages)
		}

		if (truncateResult.summary) {
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

		await this.provider.postMessageToWebview({ type: "condenseTaskContextResponse", text: this.taskId })
	}

	/**
	 * Get current profile ID from state
	 */
	private getCurrentProfileId(state: any): string {
		return state?.currentProfileId || "default"
	}

	private async executeWithRetry<T>(
		operation: () => Promise<T>,
		operationName: string,
		maxRetries: number = 3
	): Promise<T> {
		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				console.log(`[ContextManager#${operationName}] Attempt ${attempt + 1}/${maxRetries}`)
				const result = await operation()
				console.log(`[ContextManager#${operationName}] Operation completed successfully`)
				return result
			} catch (error) {
				console.error(`[ContextManager#${operationName}] Error on attempt ${attempt + 1}: ${error}`)
				
				const result = await this.errorHandler.handleError(
					error instanceof Error ? error : new Error(String(error)),
					{
						operation: operationName,
						taskId: this.taskId,
						timestamp: Date.now()
					}
				)

				if (attempt === maxRetries - 1 || !result.shouldRetry) {
					console.log(`[ContextManager#${operationName}] Max retries reached or no retry allowed, throwing error`)
					throw error
				}

				const delay = 1000 * (attempt + 1)
				console.log(`[ContextManager#${operationName}] Retrying after ${delay}ms`)
				await this.delay(delay)
			}
		}
		throw new Error(`Operation ${operationName} failed after ${maxRetries} attempts`)
	}

	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms))
	}
}
