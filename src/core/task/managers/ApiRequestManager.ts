import type { ApiHandler } from "../../../api"
import type { ApiMessage } from "../../task-persistence/apiMessages"
import type { ProviderSettings, ModelInfo } from "@roo-code/types"
import { ApiStream, GroundingSource } from "../../../api/transform/stream"
import { checkContextWindowExceededError } from "../../context-management/context-error-handling"
import { NativeToolCallParser } from "../../assistant-message/NativeToolCallParser"
import { presentAssistantMessage } from "../../assistant-message"
import { calculateApiCostAnthropic, calculateApiCostOpenAI } from "../../../shared/cost"
import { getModelId, getApiProtocol } from "@roo-code/types"
import { resolveToolProtocol } from "../../../utils/resolveToolProtocol"
import { manageContext, willManageContext } from "../../context-management"
import { getEnvironmentDetails } from "../../environment/getEnvironmentDetails"
import { processUserContentMentions } from "../../mentions/processUserContentMentions"
import { ClineApiReqInfo, ClineApiReqCancelReason } from "../../../shared/ExtensionMessage"
import { findLastIndex } from "../../../shared/array"
import { t } from "../../../i18n"
import type { TaskStateManager } from "./TaskStateManager"
import type { MessageManager } from "./MessageManager"
import type { UserInteractionManager } from "./UserInteractionManager"
import type { ContextManager } from "./ContextManager"
import type { UsageTracker } from "./UsageTracker"
import type { FileEditorManager } from "./FileEditorManager"
import type { AssistantMessageContent } from "../../assistant-message"
import delay from "delay"

const MAX_CONTEXT_WINDOW_RETRIES = 3
const FORCED_CONTEXT_REDUCTION_PERCENT = 75
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
}

export class ApiRequestManager {
	private stateManager: TaskStateManager
	private messageManager: MessageManager
	private userInteractionManager: UserInteractionManager
	private contextManager: ContextManager
	private usageTracker: UsageTracker
	private fileEditorManager: FileEditorManager

	api: ApiHandler
	apiConfiguration: ProviderSettings
	cwd: string

	isStreaming = false
	isWaitingForFirstChunk = false
	currentStreamingContentIndex = 0
	currentStreamingDidCheckpoint = false
	assistantMessageContent: AssistantMessageContent[] = []
	presentAssistantMessageLocked = false
	presentAssistantMessageHasPendingUpdates = false
	userMessageContent: any[] = []
	userMessageContentReady = false
	didRejectTool = false
	didAlreadyUseTool = false
	didToolFailInCurrentTurn = false
	didCompleteReadingStream = false

	private streamingToolCallIndices: Map<string, number> = new Map()
	cachedStreamingModel?: { id: string; info: ModelInfo }

	constructor(options: ApiRequestManagerOptions) {
		this.stateManager = options.stateManager
		this.messageManager = options.messageManager
		this.userInteractionManager = options.userInteractionManager
		this.contextManager = options.contextManager
		this.usageTracker = options.usageTracker
		this.fileEditorManager = options.fileEditorManager

		this.api = options.api
		this.apiConfiguration = options.apiConfiguration
		this.cwd = options.cwd
	}

	public async *attemptApiRequest(): ApiStream {
		const systemPrompt = await this.getSystemPrompt()
		const messages = this.messageManager.getApiConversationHistory()

		const stream = await this.api.createMessage(systemPrompt, messages, {
			taskId: this.stateManager.taskId,
			mode: this.stateManager.taskMode,
			suppressPreviousResponseId: this.stateManager.skipPrevResponseIdOnce,
			toolProtocol: this.stateManager.taskToolProtocol,
		})

		yield* stream
	}

	async getSystemPrompt(): Promise<string> {
		return ""
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

		const stream = await this.attemptApiRequest()
		const iterator = stream[Symbol.asyncIterator]()

		let item = await iterator.next()
		while (!item.done) {
			const chunk = item.value
			await this.handleStreamChunk(chunk)
			item = await iterator.next()
		}
	}

	private resetStreamingState(): void {
		this.isStreaming = false
		this.isWaitingForFirstChunk = false
		this.currentStreamingContentIndex = 0
		this.currentStreamingDidCheckpoint = false
		this.assistantMessageContent = []
		this.didCompleteReadingStream = false
		this.userMessageContent = []
		this.userMessageContentReady = false
		this.didRejectTool = false
		this.didAlreadyUseTool = false
		this.didToolFailInCurrentTurn = false
		this.presentAssistantMessageLocked = false
		this.presentAssistantMessageHasPendingUpdates = false
		this.streamingToolCallIndices.clear()
		NativeToolCallParser.clearAllStreamingToolCalls()
		NativeToolCallParser.clearRawChunkState()
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
		this.usageTracker.recordUsage(chunk)
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
