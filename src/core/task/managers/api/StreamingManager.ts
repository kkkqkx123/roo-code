import type { ModelInfo } from "@shared/types"
import { type AssistantMessageContent } from "@shared/types"
import { NativeToolCallParser } from "../../../assistant-message/NativeToolCallParser"
import { ErrorHandler } from "../../../error/ErrorHandler"

export interface StreamingState {
	isStreaming: boolean
	isWaitingForFirstChunk: boolean
	currentStreamingContentIndex: number
	currentStreamingDidCheckpoint: boolean
	didCompleteReadingStream: boolean
}

export interface StreamingManagerOptions {
	taskId: string
	onStreamingStateChange?: (state: StreamingState) => void
	onStreamingContentUpdate?: (content: AssistantMessageContent[]) => void
}

export class StreamingManager {
	private readonly taskId: string

	private onStreamingStateChange?: (state: StreamingState) => void
	private onStreamingContentUpdate?: (content: AssistantMessageContent[]) => void
	private errorHandler: ErrorHandler

	private _isStreaming = false
	private _isWaitingForFirstChunk = false
	private _currentStreamingContentIndex = 0
	private _currentStreamingDidCheckpoint = false
	private _assistantMessageContent: AssistantMessageContent[] = []
	private _presentAssistantMessageLocked = false
	private _presentAssistantMessageHasPendingUpdates = false
	private _userMessageContent: unknown[] = []
	private _userMessageContentReady = false
	private _didRejectTool = false
	private _didAlreadyUseTool = false
	private _didToolFailInCurrentTurn = false
	private _didCompleteReadingStream = false
	private _assistantMessageParser?: unknown
	private readonly _streamingToolCallIndices: Map<string, number> = new Map()
	private _cachedStreamingModel?: { id: string; info: ModelInfo }

	constructor(options: StreamingManagerOptions) {
		this.taskId = options.taskId
		this.onStreamingStateChange = options.onStreamingStateChange
		this.onStreamingContentUpdate = options.onStreamingContentUpdate
		this.errorHandler = new ErrorHandler()
	}

	public resetStreamingState(): void {
		this._isStreaming = false
		this._isWaitingForFirstChunk = false
		this._currentStreamingContentIndex = 0
		this._currentStreamingDidCheckpoint = false
		this._assistantMessageContent = []
		this._didCompleteReadingStream = false
		this._userMessageContent = []
		this._userMessageContentReady = false
		this._didRejectTool = false
		this._didAlreadyUseTool = false
		this._didToolFailInCurrentTurn = false
		this._presentAssistantMessageLocked = false
		this._presentAssistantMessageHasPendingUpdates = false
		this._streamingToolCallIndices.clear()
		this._assistantMessageParser = undefined
		NativeToolCallParser.clearAllStreamingToolCalls()
		NativeToolCallParser.clearRawChunkState()

		this.notifyStateChange()
	}

	public startStreaming(): void {
		this._isStreaming = true
		this._isWaitingForFirstChunk = true
		this.notifyStateChange()
	}

	public stopStreaming(): void {
		this._isStreaming = false
		this._isWaitingForFirstChunk = false
		this.notifyStateChange()
	}

	public setStreamingState(streaming: boolean): void {
		this._isStreaming = streaming
		this.notifyStateChange()
	}

	public setWaitingForFirstChunk(waiting: boolean): void {
		this._isWaitingForFirstChunk = waiting
		this.notifyStateChange()
	}

	public setCurrentStreamingContentIndex(index: number): void {
		this._currentStreamingContentIndex = index
		this.notifyStateChange()
	}

	public getCurrentStreamingContentIndex(): number {
		return this._currentStreamingContentIndex
	}

	public setCurrentStreamingDidCheckpoint(checkpoint: boolean): void {
		this._currentStreamingDidCheckpoint = checkpoint
		this.notifyStateChange()
	}

	public getStreamingState(): StreamingState {
		return {
			isStreaming: this._isStreaming,
			isWaitingForFirstChunk: this._isWaitingForFirstChunk,
			currentStreamingContentIndex: this._currentStreamingContentIndex,
			currentStreamingDidCheckpoint: this._currentStreamingDidCheckpoint,
			didCompleteReadingStream: this._didCompleteReadingStream,
		}
	}

	public appendAssistantContent(content: AssistantMessageContent): void {
		this._assistantMessageContent.push(content)
		this._currentStreamingContentIndex = this._assistantMessageContent.length
		this.notifyContentUpdate()
	}

	public setAssistantContent(content: AssistantMessageContent[]): void {
		this._assistantMessageContent = content
		this._currentStreamingContentIndex = content.length
		this.notifyContentUpdate()
	}

	public getAssistantMessageContent(): AssistantMessageContent[] {
		return this._assistantMessageContent
	}

	public clearAssistantContent(): void {
		this._assistantMessageContent = []
		this._currentStreamingContentIndex = 0
		this.notifyContentUpdate()
	}

	public setUserMessageContent(content: unknown[]): void {
		this._userMessageContent = content
	}

	public getUserMessageContent(): unknown[] {
		return this._userMessageContent
	}

	public clearUserMessageContent(): void {
		this._userMessageContent = []
	}

	public setUserMessageContentReady(ready: boolean): void {
		this._userMessageContentReady = ready
	}

	public isUserMessageContentReady(): boolean {
		return this._userMessageContentReady
	}

	public startToolCall(toolId: string): void {
		this._streamingToolCallIndices.set(toolId, 0)
	}

	public updateToolCallIndex(toolId: string, index: number): void {
		this._streamingToolCallIndices.set(toolId, index)
	}

	public getToolCallIndex(toolId: string): number {
		return this._streamingToolCallIndices.get(toolId) ?? 0
	}

	public setStreamingToolCallIndex(toolId: string, index: number): void {
		this._streamingToolCallIndices.set(toolId, index)
	}

	public getStreamingToolCallIndex(toolId: string): number | undefined {
		return this._streamingToolCallIndices.get(toolId)
	}

	public incrementStreamingToolCallIndex(toolId: string): void {
		const currentIndex = this._streamingToolCallIndices.get(toolId) ?? 0
		this._streamingToolCallIndices.set(toolId, currentIndex + 1)
	}

	public clearToolCallIndices(): void {
		this._streamingToolCallIndices.clear()
	}

	public setStreamingDidCheckpoint(value: boolean): void {
		this._currentStreamingDidCheckpoint = value
		this.notifyStateChange()
	}

	public getStreamingDidCheckpoint(): boolean {
		return this._currentStreamingDidCheckpoint
	}

	public setCachedStreamingModel(model: { id: string; info: ModelInfo }): void {
		this._cachedStreamingModel = model
	}

	public getCachedStreamingModel(): { id: string; info: ModelInfo } | undefined {
		return this._cachedStreamingModel
	}

	public clearCachedStreamingModel(): void {
		this._cachedStreamingModel = undefined
	}

	public setPresentAssistantMessageLocked(locked: boolean): void {
		this._presentAssistantMessageLocked = locked
	}

	public isPresentAssistantMessageLocked(): boolean {
		return this._presentAssistantMessageLocked
	}

	public setPresentAssistantMessageHasPendingUpdates(hasUpdates: boolean): void {
		this._presentAssistantMessageHasPendingUpdates = hasUpdates
	}

	public hasPresentAssistantMessagePendingUpdates(): boolean {
		return this._presentAssistantMessageHasPendingUpdates
	}

	public setDidRejectTool(rejected: boolean): void {
		this._didRejectTool = rejected
	}

	public isToolRejected(): boolean {
		return this._didRejectTool
	}

	public setDidAlreadyUseTool(used: boolean): void {
		this._didAlreadyUseTool = used
	}

	public hasAlreadyUsedTool(): boolean {
		return this._didAlreadyUseTool
	}

	public setDidToolFailInCurrentTurn(failed: boolean): void {
		this._didToolFailInCurrentTurn = failed
	}

	public didToolFail(): boolean {
		return this._didToolFailInCurrentTurn
	}

	public setDidCompleteReadingStream(completed: boolean): void {
		this._didCompleteReadingStream = completed
		this.notifyStateChange()
	}

	public hasCompletedReadingStream(): boolean {
		return this._didCompleteReadingStream
	}

	public setAssistantMessageParser(parser: unknown): void {
		this._assistantMessageParser = parser
	}

	public getAssistantMessageParser(): unknown {
		return this._assistantMessageParser
	}

	public clearAssistantMessageParser(): void {
		this._assistantMessageParser = undefined
	}

	public notifyStateChange(): void {
		if (this.onStreamingStateChange) {
			this.onStreamingStateChange(this.getStreamingState())
		}
	}

	public notifyContentUpdate(): void {
		if (this.onStreamingContentUpdate) {
			this.onStreamingContentUpdate(this._assistantMessageContent)
		}
	}

	public dispose(): void {
		this.onStreamingStateChange = undefined
		this.onStreamingContentUpdate = undefined
		this.resetStreamingState()
	}

	public async handleStreamingInterruption(): Promise<void> {
		try {
			console.log(`[StreamingManager#${this.taskId}] Handling streaming interruption`)
			
			if (this._isStreaming) {
				this.stopStreaming()
				
				if (this._didCompleteReadingStream) {
					console.log(`[StreamingManager#${this.taskId}] Stream completed, no recovery needed`)
					return
				}
				
				await this.recoverStreamingState()
			}
		} catch (error) {
			console.error(`[StreamingManager#${this.taskId}] Error handling streaming interruption:`, error)
			await this.errorHandler.handleError(
				error instanceof Error ? error : new Error(String(error)),
				{
					operation: "handleStreamingInterruption",
					taskId: this.taskId,
					timestamp: Date.now()
				}
			)
			
			this.resetStreamingState()
		}
	}

	private async recoverStreamingState(): Promise<void> {
		console.log(`[StreamingManager#${this.taskId}] Attempting to recover streaming state`)
		
		const lastContent = this._assistantMessageContent
		if (lastContent.length > 0) {
			console.log(`[StreamingManager#${this.taskId}] Recovering ${lastContent.length} content blocks`)
			
			this._assistantMessageContent = []
			this._currentStreamingContentIndex = 0
			this._presentAssistantMessageLocked = false
			this._presentAssistantMessageHasPendingUpdates = false
			
			this.notifyContentUpdate()
			this.notifyStateChange()
		}
		
		this._didCompleteReadingStream = true
		this._isStreaming = false
		this._isWaitingForFirstChunk = false
		
		this.notifyStateChange()
	}

	public validateStreamingState(): boolean {
		if (!this._isStreaming) {
			return true
		}
		
		if (this._didCompleteReadingStream) {
			return true
		}
		
		if (this._isWaitingForFirstChunk && Date.now() - this._currentStreamingContentIndex > 30000) {
			console.warn(`[StreamingManager#${this.taskId}] Streaming timeout detected`)
			return false
		}
		
		return true
	}
}