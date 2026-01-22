import type { ClineProvider } from "../../../webview/ClineProvider"
import type { ProviderSettings, ClineMessage, HistoryItem, TodoItem } from "@shared/types"
import type { Task } from "../../Task"
import { RooCodeEventName } from "@shared/types"
import Anthropic from "@anthropic-ai/sdk"
import { detectToolProtocolFromHistory } from "../../../../utils/resolveToolProtocol"
import { getCheckpointService } from "../../../checkpoints"
import { formatResponse } from "../../../prompts/responses"
import { ClineApiReqInfo } from "../../../../shared/ExtensionMessage"
import { TerminalRegistry } from "../../../../integrations/terminal/TerminalRegistry"
import { ErrorHandler } from "../../../error/ErrorHandler"

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
	private errorHandler: ErrorHandler

	constructor(options: TaskLifecycleManagerOptions) {
		this.task = options.task
		this.providerRef = options.providerRef
		this.taskId = options.taskId
		this.taskNumber = options.taskNumber
		this.workspacePath = options.workspacePath
		this.apiConfiguration = options.apiConfiguration
		this.metadata = options.metadata
		this.enableCheckpoints = options.enableCheckpoints
		this.errorHandler = new ErrorHandler()
	}

	async startTask(task?: string, images?: string[]): Promise<void> {
		const provider = this.providerRef.deref()
		provider?.log(`[TaskLifecycleManager#startTask] Starting task: "${task?.substring(0, 100)}..."`)
		
		// 简化中止检查
		if (this.shouldAbortEarly()) {
			provider?.log(`[TaskLifecycleManager#startTask] Task should abort early, returning`)
			return
		}

		try {
			if (task) {
				provider?.log(`[TaskLifecycleManager#startTask] About to say text message`)
				await this.task.say("text", task)
				provider?.log(`[TaskLifecycleManager#startTask] Text message said, clineMessages count: ${this.task.clineMessages.length}`)
			}

			if (images && images.length > 0) {
				for (const image of images) {
					provider?.log(`[TaskLifecycleManager#startTask] About to say user_feedback message`)
					await this.task.say("user_feedback", "", [image])
					provider?.log(`[TaskLifecycleManager#startTask] User feedback message said, clineMessages count: ${this.task.clineMessages.length}`)
				}
			}

			await this.prepareTaskHistory()
			provider?.log(`[TaskLifecycleManager#startTask] Task history prepared, clineMessages count: ${this.task.clineMessages.length}`)

			await this.detectToolProtocol()
			provider?.log(`[TaskLifecycleManager#startTask] Tool protocol detected: ${this.task.taskToolProtocol}`)

			provider?.log(`[TaskLifecycleManager#startTask] Posting state to webview before starting task loop`)
			await provider?.postStateToWebview()
			provider?.log(`[TaskLifecycleManager#startTask] State posted to webview`)

			await this.initiateTaskLoop()
			provider?.log(`[TaskLifecycleManager#startTask] Task loop completed`)
		} catch (error) {
			console.error("[TaskLifecycleManager] Task execution failed:", error)
			throw error
		}
	}

	/**
	 * 检查是否应该提前中止任务
	 */
	private shouldAbortEarly(): boolean {
		return this.task.abort || this.task.abandoned === true || this.task.abortReason === "user_cancelled"
	}

	async resumeTaskFromHistory(): Promise<void> {
		const modifiedClineMessages = await this.prepareResumeHistory()

		if (modifiedClineMessages.length === 0) {
			return
		}

		// 检测并设置工具协议（如果尚未设置）
		if (!this.task.taskToolProtocol) {
			const detectedProtocol = detectToolProtocolFromHistory(this.task.apiConversationHistory)
			if (detectedProtocol) {
				this.task.taskToolProtocol = detectedProtocol
			} else {
				const { resolveToolProtocol } = await import("../../../../utils/resolveToolProtocol")
				this.task.taskToolProtocol = resolveToolProtocol(this.task.apiConfiguration, this.task.api.getModel().info)
			}
		}

		const lastApiReqStartedIndex = modifiedClineMessages.findIndex(
			(msg) => msg.type === "say" && msg.say === "api_req_started",
		)

		const shouldUseXmlParser = this.task.taskToolProtocol === "xml"
		if (shouldUseXmlParser && !this.task.getAssistantMessageParser()) {
			const { AssistantMessageParser } = await import("../../../assistant-message/AssistantMessageParser")
			this.task.setAssistantMessageParser(new AssistantMessageParser())
		} else if (!shouldUseXmlParser) {
			this.task.clearAssistantMessageParser()
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

		// 采用响应索引的形式：找到最后一个需要响应的消息，截断历史
		// 这样可以避免上下文污染，特别是在人为干涉后
		const lastResponseIndex = this.findLastResponseIndex()
		
		// 如果找到响应索引，只保留到该索引之前的消息（包含该消息）
		// 这样可以清除可能错误的后续推理路径
		if (lastResponseIndex !== -1) {
			return this.task.clineMessages.slice(0, lastResponseIndex + 1)
		}

		// 如果没有找到响应索引，返回原始消息（不应该发生）
		return [...this.task.clineMessages]
	}

	/**
	 * 找到最后一个需要响应的消息索引
	 * 这是为了避免上下文污染的关键：只保留到需要响应的点
	 */
	private findLastResponseIndex(): number {
		// 从后向前查找，找到最后一个需要响应的消息
		for (let i = this.task.clineMessages.length - 1; i >= 0; i--) {
			const msg = this.task.clineMessages[i]
			
			// 需要响应的消息类型：
			// 1. ask 消息：需要用户响应
			// 2. api_req_started 消息：需要 API 响应
			if (msg.type === "ask" || (msg.type === "say" && msg.say === "api_req_started")) {
				return i
			}
		}
		
		// 如果没有找到，返回 -1
		return -1
	}

	private async detectToolProtocol(): Promise<void> {
		if (!this.task.taskToolProtocol) {
			const detectedProtocol = detectToolProtocolFromHistory(this.task.apiConversationHistory)
			if (detectedProtocol) {
				this.task.taskToolProtocol = detectedProtocol
			} else {
				const { resolveToolProtocol } = await import("../../../../utils/resolveToolProtocol")
				this.task.taskToolProtocol = resolveToolProtocol(this.task.apiConfiguration, this.task.api.getModel().info)
			}
		}

		const shouldUseXmlParser = this.task.taskToolProtocol === "xml"
		if (shouldUseXmlParser && !this.task.getAssistantMessageParser()) {
			const { AssistantMessageParser } = await import("../../../assistant-message/AssistantMessageParser")
			this.task.setAssistantMessageParser(new AssistantMessageParser())
		} else if (!shouldUseXmlParser) {
			this.task.clearAssistantMessageParser()
		}
	}

	async initiateTaskLoop(): Promise<void> {
		const provider = this.providerRef.deref()
		if (!provider) {
			throw new Error("Provider reference lost")
		}

		provider?.log(`[TaskLifecycleManager#initiateTaskLoop] Starting task loop`)

		getCheckpointService(this.task)

		const userContent: Anthropic.TextBlockParam[] = [{ type: "text", text: this.metadata.task || "" }]
		let nextUserContent = userContent
		let includeFileDetails = true

		this.task.emit(RooCodeEventName.TaskStarted)
		provider?.log(`[TaskLifecycleManager#initiateTaskLoop] Task started event emitted`)

		while (!this.task.abort) {
			provider?.log(`[TaskLifecycleManager#initiateTaskLoop] Starting request iteration`)
			const didEndLoop = await this.task.recursivelyMakeClineRequests(nextUserContent, includeFileDetails)
			includeFileDetails = false

			if (didEndLoop) {
				provider?.log(`[TaskLifecycleManager#initiateTaskLoop] Task loop ended`)
				break
			} else {
				provider?.log(`[TaskLifecycleManager#initiateTaskLoop] No tools used, continuing loop`)
				nextUserContent = [{ type: "text", text: formatResponse.noToolsUsed(this.task.taskToolProtocol ?? "xml") }]
			}
		}
		
		provider?.log(`[TaskLifecycleManager#initiateTaskLoop] Task loop completed`)
	}

	async abortTask(isAbandoned = false): Promise<void> {
		const provider = this.providerRef.deref()
		provider?.log(`[TaskLifecycleManager#abortTask] Aborting task, isAbandoned: ${isAbandoned}`)
		
		if (isAbandoned) {
			this.task.abandoned = true
		}

		this.task.abort = true

		try {
			if (this.task.currentRequestAbortController) {
				this.task.currentRequestAbortController.abort()
			}
		} catch (error) {
			provider?.log(`[TaskLifecycleManager#abortTask] Error aborting current request: ${error}`)
			await this.errorHandler.handleError(
				error instanceof Error ? error : new Error(String(error)),
				{
					operation: "abortTask",
					taskId: this.taskId,
					timestamp: Date.now()
				}
			)
		}

		try {
			if (this.task['autoApprovalTimeoutRef']) {
				clearTimeout(this.task['autoApprovalTimeoutRef'])
				this.task['autoApprovalTimeoutRef'] = undefined
			}
		} catch (error) {
			provider?.log(`[TaskLifecycleManager#abortTask] Error clearing auto approval timeout: ${error}`)
		}

		this.task.emit(RooCodeEventName.TaskAborted)
		
		const uiUpdateConfirmed = await this.waitForUIStateUpdate(5000)
		if (!uiUpdateConfirmed) {
			provider?.log(`[TaskLifecycleManager#abortTask] UI state update confirmation timeout`)
		}
		
		await provider?.postStateToWebview()
		provider?.log(`[TaskLifecycleManager#abortTask] UI state updated after abort`)
	}

	async dispose(): Promise<void> {
		try {
			this.task.abort = true

			try {
				if (this.task.currentRequestAbortController) {
					this.task.currentRequestAbortController.abort()
					this.task.currentRequestAbortController = undefined
				}
			} catch (error) {
				console.error("[TaskLifecycleManager] Error aborting current request during dispose:", error)
			}

			try {
				if (this.task['autoApprovalTimeoutRef']) {
					clearTimeout(this.task['autoApprovalTimeoutRef'])
					this.task['autoApprovalTimeoutRef'] = undefined
				}
			} catch (error) {
				console.error("[TaskLifecycleManager] Error clearing auto approval timeout during dispose:", error)
			}

			const provider = this.providerRef.deref()

			if (provider) {
				try {
					if (this.task.rooIgnoreController) {
						this.task.rooIgnoreController.dispose()
						this.task.rooIgnoreController = undefined
					}
				} catch (error) {
					console.error("[TaskLifecycleManager] Error disposing RooIgnoreController:", error)
				}
				
				try {
					if (this.task.rooProtectedController) {
						this.task.rooProtectedController.dispose()
						this.task.rooProtectedController = undefined
					}
				} catch (error) {
					console.error("[TaskLifecycleManager] Error disposing RooProtectedController:", error)
				}
				
				try {
					if (this.task.getStreamingState().isStreaming && this.task.diffViewProvider.isEditing) {
						this.task.diffViewProvider.revertChanges()
					}
				} catch (error) {
					console.error("[TaskLifecycleManager] Error reverting diff changes during dispose:", error)
				}
				
				try {
					if (this.task['_browserSessionManager']) {
						this.task['_browserSessionManager'].dispose()
						this.task['_browserSessionManager'] = undefined
					}
				} catch (error) {
					console.error("[TaskLifecycleManager] Error disposing browser session manager:", error)
				}
			}

			TerminalRegistry.releaseTerminalsForTask(this.taskId)

			console.log(`[TaskLifecycleManager] Disposed for task ${this.taskId}`)
		} catch (error) {
			console.error("[TaskLifecycleManager] Dispose failed:", error)
		}
	}

	private async waitForUIStateUpdate(timeoutMs: number = 5000): Promise<boolean> {
		const startTime = Date.now()
		const checkInterval = 100
		
		while (Date.now() - startTime < timeoutMs) {
			const provider = this.providerRef.deref()
			if (!provider) {
				await this.delay(checkInterval)
				continue
			}

			try {
				const state = await provider.getState()
				if (state && state.currentTaskItem?.id === this.taskId && state.currentTaskItem?.status === 'aborted') {
					return true
				}
			} catch (error) {
				console.error(`[TaskLifecycleManager#waitForUIStateUpdate] Error checking UI state: ${error}`)
			}

			await this.delay(checkInterval)
		}

		return false
	}

	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms))
	}
}
