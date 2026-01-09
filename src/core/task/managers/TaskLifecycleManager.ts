import type { ClineProvider } from "../../webview/ClineProvider"
import type { ProviderSettings, ClineMessage, HistoryItem, TodoItem } from "@roo-code/types"
import type { Task } from "../Task"
import { RooCodeEventName } from "@roo-code/types"
import Anthropic from "@anthropic-ai/sdk"
import { detectToolProtocolFromHistory } from "../../../utils/resolveToolProtocol"
import { getCheckpointService } from "../../checkpoints"
import { formatResponse } from "../../prompts/responses"
import { ClineApiReqInfo } from "../../../shared/ExtensionMessage"
import { TerminalRegistry } from "../../../integrations/terminal/TerminalRegistry"

export interface TaskLifecycleManagerOptions {
	task: Task
	providerRef: WeakRef<ClineProvider>
	taskId: string
	taskNumber: number
	workspacePath: string
	apiConfiguration: ProviderSettings
	metadata: any
	enableCheckpoints: boolean
}

export class TaskLifecycleManager {
	private task: Task
	private providerRef: WeakRef<ClineProvider>
	private taskId: string
	private taskNumber: number
	private workspacePath: string
	private apiConfiguration: ProviderSettings
	private metadata: any
	private enableCheckpoints: boolean

	constructor(options: TaskLifecycleManagerOptions) {
		this.task = options.task
		this.providerRef = options.providerRef
		this.taskId = options.taskId
		this.taskNumber = options.taskNumber
		this.workspacePath = options.workspacePath
		this.apiConfiguration = options.apiConfiguration
		this.metadata = options.metadata
		this.enableCheckpoints = options.enableCheckpoints
	}

	async startTask(task?: string, images?: string[]): Promise<void> {
		if (this.task.abandoned === true || this.task.abortReason === "user_cancelled") {
			return
		}

		if (task) {
			await this.task.say("text", task)
		}

		if (images && images.length > 0) {
			for (const image of images) {
				await this.task.say("user_feedback", "", [image])
			}
		}

		await this.prepareTaskHistory()

		await this.detectToolProtocol()

		await this.initiateTaskLoop()
	}

	async resumeTaskFromHistory(): Promise<void> {
		const modifiedClineMessages = await this.prepareResumeHistory()

		if (modifiedClineMessages.length === 0) {
			return
		}

		await this.detectToolProtocol()

		const lastApiReqStartedIndex = modifiedClineMessages.findIndex(
			(msg) => msg.type === "say" && msg.say === "api_req_started",
		)

		if (!this.task.taskToolProtocol) {
			const detectedProtocol = detectToolProtocolFromHistory(this.task.apiConversationHistory)
			if (detectedProtocol) {
				this.task.taskToolProtocol = detectedProtocol
			} else {
				const { resolveToolProtocol } = await import("../../../utils/resolveToolProtocol")
				this.task.taskToolProtocol = resolveToolProtocol(this.task.apiConfiguration, this.task.api.getModel().info)
			}
		}

		const shouldUseXmlParser = this.task.taskToolProtocol === "xml"
		if (shouldUseXmlParser && !this.task.streamingManager.getAssistantMessageParser()) {
			const { AssistantMessageParser } = await import("../../assistant-message/AssistantMessageParser")
			this.task.streamingManager.setAssistantMessageParser(new AssistantMessageParser())
		} else if (!shouldUseXmlParser) {
			this.task.streamingManager.clearAssistantMessageParser()
		}

		if (lastApiReqStartedIndex !== -1) {
			const lastClineMessage = modifiedClineMessages[lastApiReqStartedIndex]
			if (lastClineMessage?.ask === "completion_result") {
				const { response } = await this.task.ask("completion_result")
				if (response === "messageResponse") {
					await this.task.recursivelyMakeClineRequests([])
				}
			}
		} else {
			await this.task.recursivelyMakeClineRequests([])
		}
	}

	private async prepareTaskHistory(): Promise<void> {
		const provider = this.providerRef.deref()
		if (!provider) {
			throw new Error("Provider reference lost")
		}

		const state = await provider.getState()
		if (!state) {
			throw new Error("State not available")
		}

		const mode = state.mode
		const apiConfiguration = state.apiConfiguration

		if (mode) {
			this.task.taskMode = mode
		}

		if (apiConfiguration) {
			this.task.apiConfiguration = apiConfiguration
		}
	}

	private async prepareResumeHistory(): Promise<ClineMessage[]> {
		const provider = this.providerRef.deref()
		if (!provider) {
			throw new Error("Provider reference lost")
		}

		const state = await provider.getState()
		if (!state) {
			throw new Error("State not available")
		}

		const mode = state.mode
		const apiConfiguration = state.apiConfiguration

		if (mode) {
			this.task.taskMode = mode
		}

		if (apiConfiguration) {
			this.task.apiConfiguration = apiConfiguration
		}

		const modifiedClineMessages = [...this.task.clineMessages]

		for (let i = modifiedClineMessages.length - 1; i >= 0; i--) {
			const msg = modifiedClineMessages[i]
			if (msg.type === "say" && msg.say === "reasoning") {
				modifiedClineMessages.splice(i, 1)
			}
		}

		while (modifiedClineMessages.length > 0) {
			const last = modifiedClineMessages[modifiedClineMessages.length - 1]
			if (last.type === "say" && last.say === "reasoning") {
				modifiedClineMessages.pop()
			} else {
				break
			}
		}

		const lastRelevantMessageIndex = modifiedClineMessages.findIndex(
			(msg) => msg.type === "ask" || msg.say === "api_req_started",
		)

		if (lastRelevantMessageIndex !== -1) {
			const lastRelevantMessage = modifiedClineMessages[lastRelevantMessageIndex]
			if (lastRelevantMessage.type === "ask") {
				modifiedClineMessages.splice(lastRelevantMessageIndex)
			}
		}

		for (let i = modifiedClineMessages.length - 1; i >= 0; i--) {
			const msg = modifiedClineMessages[i]
			if (msg.type === "say" && msg.say === "api_req_started") {
				const lastApiReqStartedIndex = i

				if (lastApiReqStartedIndex !== -1) {
					const lastClineMessage = modifiedClineMessages[lastApiReqStartedIndex]
					const parsedText: ClineApiReqInfo = JSON.parse(lastClineMessage.text || "{}")
					const { cost, cancelReason } = parsedText

					if (cost === undefined && cancelReason === undefined) {
						modifiedClineMessages.splice(lastApiReqStartedIndex, 1)
					}
				}
				break
			}
		}

		return modifiedClineMessages
	}

	private async detectToolProtocol(): Promise<void> {
		if (!this.task.taskToolProtocol) {
			const detectedProtocol = detectToolProtocolFromHistory(this.task.apiConversationHistory)
			if (detectedProtocol) {
				this.task.taskToolProtocol = detectedProtocol
			} else {
				const { resolveToolProtocol } = await import("../../../utils/resolveToolProtocol")
				this.task.taskToolProtocol = resolveToolProtocol(this.task.apiConfiguration, this.task.api.getModel().info)
			}
		}

		const shouldUseXmlParser = this.task.taskToolProtocol === "xml"
		if (shouldUseXmlParser && !this.task.streamingManager.getAssistantMessageParser()) {
			const { AssistantMessageParser } = await import("../../assistant-message/AssistantMessageParser")
			this.task.streamingManager.setAssistantMessageParser(new AssistantMessageParser())
		} else if (!shouldUseXmlParser) {
			this.task.streamingManager.clearAssistantMessageParser()
		}
	}

	async initiateTaskLoop(): Promise<void> {
		const provider = this.providerRef.deref()
		if (!provider) {
			throw new Error("Provider reference lost")
		}

		getCheckpointService(this.task)

		const userContent: Anthropic.TextBlockParam[] = [{ type: "text", text: this.metadata.task || "" }]
		let nextUserContent = userContent
		let includeFileDetails = true

		this.task.emit(RooCodeEventName.TaskStarted)

		while (!this.task.abort) {
			const didEndLoop = await this.task.recursivelyMakeClineRequests(nextUserContent, includeFileDetails)
			includeFileDetails = false

			if (didEndLoop) {
				break
			} else {
				nextUserContent = [{ type: "text", text: formatResponse.noToolsUsed(this.task.taskToolProtocol ?? "xml") }]
			}
		}
	}

	async abortTask(isAbandoned = false): Promise<void> {
		if (isAbandoned) {
			this.task.abandoned = true
		}

		this.task.abort = true

		if (this.task.currentRequestAbortController) {
			this.task.currentRequestAbortController.abort()
		}

		this.task.emit(RooCodeEventName.TaskAborted)
	}

	async dispose(): Promise<void> {
		this.task.abort = true

		if (this.task.currentRequestAbortController) {
			this.task.currentRequestAbortController.abort()
		}

		const provider = this.providerRef.deref()

		if (this.task.messageQueueService) {
			this.task.messageQueueService.dispose()
		}

		if (provider) {
			if (this.task.rooIgnoreController) {
				this.task.rooIgnoreController.dispose()
			}
			if (this.task.rooProtectedController) {
				this.task.rooProtectedController.dispose()
			}
			if (this.task.streamingManager.getStreamingState().isStreaming && this.task.diffViewProvider.isEditing) {
				this.task.diffViewProvider.revertChanges()
			}
		}

		TerminalRegistry.releaseTerminalsForTask(this.taskId)
	}
}
