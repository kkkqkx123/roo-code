import type { ApiHandler } from "../../../api"
import type { ApiMessage } from "../../task-persistence/apiMessages"
import type { ProviderSettings, ClineSay, ToolProgressStatus, ContextCondense, ContextTruncation } from "@roo-code/types"
import { ApiStream, GroundingSource } from "../../../api/transform/stream"
import { checkContextWindowExceededError } from "../../context-management/context-error-handling"
import { NativeToolCallParser } from "../../assistant-message/NativeToolCallParser"
import { getModelId, getApiProtocol } from "@roo-code/types"
import { getEnvironmentDetails } from "../../environment/getEnvironmentDetails"
import type { TaskStateManager } from "./TaskStateManager"
import type { MessageManager } from "./MessageManager"
import type { UserInteractionManager } from "./UserInteractionManager"
import type { ContextManager } from "./ContextManager"
import type { UsageTracker } from "./UsageTracker"
import type { FileEditorManager } from "./FileEditorManager"
import type { StreamingManager } from "./StreamingManager"
import { BaseProvider, TokenValidationOptions } from "../../../api/providers/base-provider"
import { Anthropic } from "@anthropic-ai/sdk"
import delay from "delay"

const MAX_CONTEXT_WINDOW_RETRIES = 3
const MAX_EXPONENTIAL_BACKOFF_SECONDS = 120

export interface ApiRequestManagerOptions {
	stateManager: TaskStateManager
	messageManager: MessageManager
	userInteractionManager: UserInteractionManager
	contextManager: ContextManager
	usageTracker: UsageTracker
	fileEditorManager: FileEditorManager
	api: ApiHandler
	apiConfiguration: ProviderSettings
	cwd: string
	streamingManager: StreamingManager
	getSystemPrompt: () => Promise<string>
	getLastGlobalApiRequestTime: () => number | undefined
	setLastGlobalApiRequestTime: (time: number) => void
}

export class ApiRequestManager {
	private stateManager: TaskStateManager
	private messageManager: MessageManager
	private userInteractionManager: UserInteractionManager
	private contextManager: ContextManager
	private usageTracker: UsageTracker
	private fileEditorManager: FileEditorManager
	private streamingManager: StreamingManager
	private getSystemPromptFn: () => Promise<string>
	private getLastGlobalApiRequestTime: () => number | undefined
	private setLastGlobalApiRequestTime: (time: number) => void

	api: ApiHandler
	apiConfiguration: ProviderSettings
	cwd: string

	private currentSystemPrompt?: string
	private currentMessages?: Anthropic.Messages.MessageParam[]
	private currentResponseContent: Anthropic.Messages.ContentBlockParam[] = []
	private tokenValidationOptions: TokenValidationOptions = {
		enableFallback: true,
		logFallback: true,
	}

	constructor(options: ApiRequestManagerOptions) {
		this.stateManager = options.stateManager
		this.messageManager = options.messageManager
		this.userInteractionManager = options.userInteractionManager
		this.contextManager = options.contextManager
		this.usageTracker = options.usageTracker
		this.fileEditorManager = options.fileEditorManager
		this.streamingManager = options.streamingManager
		this.getSystemPromptFn = options.getSystemPrompt
		this.getLastGlobalApiRequestTime = options.getLastGlobalApiRequestTime
		this.setLastGlobalApiRequestTime = options.setLastGlobalApiRequestTime

		this.api = options.api
		this.apiConfiguration = options.apiConfiguration
		this.cwd = options.cwd
	}

	/**
	 * Handle context window exceeded errors
	 */
	private async handleContextWindowExceededError(error: any, retryCount: number): Promise<void> {
		console.warn(`[ApiRequestManager] Context window exceeded (attempt ${retryCount + 1}), attempting context management...`)
		
		// Get current token usage
		const tokenUsage = this.usageTracker.getTokenUsage()
		
		// Prepare options for context manager
		const options = {
			api: this.api,
			apiConfiguration: this.apiConfiguration,
			apiConversationHistory: this.messageManager.getApiConversationHistory(),
			tokenUsage,
			toolProtocol: this.stateManager.taskToolProtocol,
			getSystemPrompt: () => this.getSystemPrompt(),
			overwriteApiConversationHistory: (messages: any[]) => this.messageManager.overwriteApiConversationHistory(messages),
			say: (type: ClineSay, text?: string, images?: string[], partial?: boolean, checkpoint?: any, progressStatus?: ToolProgressStatus, options?: any, contextCondense?: ContextCondense, contextTruncation?: ContextTruncation) => 
				this.userInteractionManager.say(type, text, images, partial, checkpoint, progressStatus, options, contextCondense, contextTruncation)
		}
		
		// Call context manager to handle the error
		await this.contextManager.handleContextWindowExceededError(options)
	}

	public async *attemptApiRequest(): ApiStream {
		this.currentResponseContent = []

		if (this.apiConfiguration.rateLimitSeconds && this.apiConfiguration.rateLimitSeconds > 0) {
			const lastRequestTime = this.getLastGlobalApiRequestTime()
			const now = performance.now()
			
			if (lastRequestTime) {
				const timeSinceLastRequest = now - lastRequestTime
				const requiredDelay = this.apiConfiguration.rateLimitSeconds * 1000
				
				if (timeSinceLastRequest < requiredDelay) {
					const delayCalls = Math.ceil((requiredDelay - timeSinceLastRequest) / 1000)
					for (let i = 0; i < delayCalls; i++) {
						await delay(1000)
					}
				}
			}
			
			this.setLastGlobalApiRequestTime(performance.now())
		}

		const systemPrompt = await this.getSystemPrompt()
		const messages = this.messageManager.getApiConversationHistory()

		this.currentSystemPrompt = systemPrompt
		this.currentMessages = messages

		const stream = await this.api.createMessage(systemPrompt, messages, {
			taskId: this.stateManager.taskId,
			mode: this.stateManager.taskMode,
			suppressPreviousResponseId: this.stateManager.skipPrevResponseIdOnce,
			toolProtocol: this.stateManager.taskToolProtocol,
		})

		yield* stream
	}

	async getSystemPrompt(): Promise<string> {
		return this.getSystemPromptFn()
	}

	async recursivelyMakeClineRequests(
		userContent: any[],
		includeFileDetails: boolean = false,
	): Promise<boolean> {
		interface StackItem {
			userContent: any[]
			includeFileDetails: boolean
			retryAttempt?: number
			userMessageWasRemoved?: boolean
		}

		const stack: StackItem[] = [{ userContent, includeFileDetails, retryAttempt: 0 }]

		while (stack.length > 0) {
			const currentItem = stack.pop()!
			const currentUserContent = currentItem.userContent
			const currentIncludeFileDetails = currentItem.includeFileDetails

			if (this.stateManager.abort) {
				throw new Error(`Task ${this.stateManager.taskId} aborted`)
			}

			await this.userInteractionManager.say(
				"api_req_started",
				JSON.stringify({
					apiProtocol: getApiProtocol(
						this.apiConfiguration.apiProvider,
						getModelId(this.apiConfiguration),
					),
				}),
			)

			const parsedUserContent = await this.processUserContent(currentUserContent, currentIncludeFileDetails)
			const environmentDetails = await getEnvironmentDetails(
				{ cwd: this.cwd } as any,
				currentIncludeFileDetails,
			)

			const finalUserContent = [...parsedUserContent, { type: "text", text: environmentDetails }]

			const shouldAddUserMessage =
				((currentItem.retryAttempt ?? 0) === 0 && currentUserContent.length > 0) ||
				currentItem.userMessageWasRemoved

			if (shouldAddUserMessage) {
				await this.messageManager.addToApiConversationHistory({
					role: "user",
					content: finalUserContent,
				})
			}

			await this.processStream(currentItem, stack)
		}

		return false
	}

	private async processUserContent(userContent: any[], includeFileDetails: boolean): Promise<any[]> {
		return userContent
	}

	private async processStream(currentItem: any, stack: any[]): Promise<void> {
		this.resetStreamingState()

		let retryCount = 0
		const maxRetries = MAX_CONTEXT_WINDOW_RETRIES

		while (retryCount <= maxRetries) {
			try {
				const stream = await this.attemptApiRequest()
				const iterator = stream[Symbol.asyncIterator]()

				let item = await iterator.next()
				while (!item.done) {
					const chunk = item.value
					await this.handleStreamChunk(chunk)
					item = await iterator.next()
				}
				
				// Success, exit the retry loop
				return
				
			} catch (error) {
				// Check if this is a context window exceeded error
				if (checkContextWindowExceededError(error)) {
					console.warn(`[ApiRequestManager] Context window exceeded on attempt ${retryCount + 1}/${maxRetries + 1}`)
					
					if (retryCount < maxRetries) {
						// Handle context window error and retry
						await this.handleContextWindowExceededError(error, retryCount)
						
						// Add exponential backoff delay before retry
						await this.backoffAndAnnounce(retryCount, error)
						
						retryCount++
					} else {
						// Max retries reached, throw the error
						console.error(`[ApiRequestManager] Max retries (${maxRetries}) reached for context window errors`)
						throw new Error(`Context window exceeded after ${maxRetries} retry attempts: ${error instanceof Error ? error.message : String(error)}`)
					}
				} else {
					// Not a context window error, re-throw
					throw error
				}
			}
		}
	}

	private resetStreamingState(): void {
		this.streamingManager.resetStreamingState()
	}

	private async handleStreamChunk(chunk: any): Promise<void> {
		switch (chunk.type) {
			case "reasoning":
				await this.handleReasoningChunk(chunk)
				break
			case "usage":
				this.handleUsageChunk(chunk)
				break
			case "grounding":
				this.handleGroundingChunk(chunk)
				break
			case "tool_call_partial":
				await this.handleToolCallPartialChunk(chunk)
				break
			case "text":
				await this.handleTextChunk(chunk)
				break
		}
	}

	private async handleReasoningChunk(chunk: any): Promise<void> {
		await this.userInteractionManager.say("reasoning", chunk.text, undefined, true)
	}

	private handleUsageChunk(chunk: any): void {
		this.handleUsageChunkWithValidation(chunk)
	}

	private async handleUsageChunkWithValidation(chunk: any): Promise<void> {
		const inputTokens = chunk.inputTokens
		const outputTokens = chunk.outputTokens

		const isInputValid = inputTokens !== undefined && inputTokens !== null && inputTokens > 0
		const isOutputValid = outputTokens !== undefined && outputTokens !== null && outputTokens > 0

		if (isInputValid && isOutputValid) {
			this.usageTracker.recordUsage(chunk)
			return
		}

		if (!this.api || !this.currentSystemPrompt || !this.currentMessages) {
			this.usageTracker.recordUsage(chunk)
			return
		}

		try {
			const inputContent: Anthropic.Messages.ContentBlockParam[] = [
				{ type: "text", text: this.currentSystemPrompt },
			]

			for (const msg of this.currentMessages) {
				if (msg.content) {
					if (typeof msg.content === "string") {
						inputContent.push({ type: "text", text: msg.content })
					} else if (Array.isArray(msg.content)) {
						inputContent.push(...msg.content)
					}
				}
			}

			const outputContent: Anthropic.Messages.ContentBlockParam[] =
				this.currentResponseContent.length > 0 ? this.currentResponseContent : [{ type: "text", text: "" }]

			if (this.api instanceof BaseProvider) {
				const validated = await this.api.validateAndCorrectTokenCounts(
					inputTokens,
					outputTokens,
					inputContent,
					outputContent,
					this.tokenValidationOptions,
				)

				const validatedChunk = {
					...chunk,
					inputTokens: validated.inputTokens,
					outputTokens: validated.outputTokens,
				}

				this.usageTracker.recordUsage(validatedChunk)
			} else {
				this.usageTracker.recordUsage(chunk)
			}
		} catch (error) {
			console.error("[ApiRequestManager] Failed to validate token counts:", error)
			this.usageTracker.recordUsage(chunk)
		}
	}

	private handleGroundingChunk(chunk: any): void {
	}

	private async handleToolCallPartialChunk(chunk: any): Promise<void> {
		const events = NativeToolCallParser.processRawChunk({
			index: chunk.index,
			id: chunk.id,
			name: chunk.name,
			arguments: chunk.arguments,
		})

		for (const event of events) {
			await this.processToolCallEvent(event)
		}
	}

	private async processToolCallEvent(event: any): Promise<void> {
	}

	private async handleTextChunk(chunk: any): Promise<void> {
		if (chunk.text) {
			this.currentResponseContent.push({ type: "text", text: chunk.text })
		}
	}

	async backoffAndAnnounce(retryAttempt: number, error: any): Promise<void> {
		try {
			const provider = this.stateManager.providerRef.deref()
			if (!provider) {
				return
			}

			const state = await provider.getState()
			const baseDelay = state?.requestDelaySeconds || 5

			let exponentialDelay = Math.min(
				Math.ceil(baseDelay * Math.pow(2, retryAttempt)),
				MAX_EXPONENTIAL_BACKOFF_SECONDS,
			)

			const finalDelay = exponentialDelay
			if (finalDelay <= 0) {
				return
			}

			let headerText
			if (error.status) {
				const errorMessage = error?.message || "Unknown error"
				headerText = `${error.status}\n${errorMessage}`
			} else if (error?.message) {
				headerText = error.message
			} else {
				headerText = "Unknown error"
			}

			headerText = headerText ? `${headerText}\n` : ""

			for (let i = finalDelay; i > 0; i--) {
				if (this.stateManager.abort) {
					throw new Error(`[Task#${this.stateManager.taskId}] Aborted during retry countdown`)
				}

				await this.userInteractionManager.say(
					"api_req_retry_delayed",
					`${headerText}<retry_timer>${i}</retry_timer>`,
					undefined,
					true,
				)
				await delay(1000)
			}

			await this.userInteractionManager.say("api_req_retry_delayed", headerText, undefined, false)
		} catch (err) {
			if (err instanceof Error && err.message.includes("Aborted during retry countdown")) {
				throw err
			}
			console.error("Exponential backoff failed:", err)
		}
	}
}
