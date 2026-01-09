import type { ModelInfo } from "@roo-code/types"
import type { AssistantMessageContent } from "../../assistant-message"
import { NativeToolCallParser } from "../../assistant-message/NativeToolCallParser"

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
	readonly taskId: string

	private onStreamingStateChange?: (state: StreamingState) => void
	private onStreamingContentUpdate?: (content: AssistantMessageContent[]) => void

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
	assistantMessageParser?: any
	private streamingToolCallIndices: Map<string, number> = new Map()
	cachedStreamingModel?: { id: string; info: ModelInfo }

	constructor(options: StreamingManagerOptions) {
		this.taskId = options.taskId
		this.onStreamingStateChange = options.onStreamingStateChange
		this.onStreamingContentUpdate = options.onStreamingContentUpdate
	}

	public resetStreamingState(): void {
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

		this.notifyStateChange()
	}

	public startStreaming(): void {
		this.isStreaming = true
		this.isWaitingForFirstChunk = true
		this.notifyStateChange()
	}

	public stopStreaming(): void {
		this.isStreaming = false
		this.isWaitingForFirstChunk = false
		this.notifyStateChange()
	}

	public setStreamingState(streaming: boolean): void {
		this.isStreaming = streaming
		this.notifyStateChange()
	}

	public setWaitingForFirstChunk(waiting: boolean): void {
		this.isWaitingForFirstChunk = waiting
		this.notifyStateChange()
	}

	public setCurrentStreamingContentIndex(index: number): void {
		this.currentStreamingContentIndex = index
	}

	public setCurrentStreamingDidCheckpoint(checkpoint: boolean): void {
		this.currentStreamingDidCheckpoint = checkpoint
	}

	public getStreamingState(): StreamingState {
		return {
			isStreaming: this.isStreaming,
			isWaitingForFirstChunk: this.isWaitingForFirstChunk,
			currentStreamingContentIndex: this.currentStreamingContentIndex,
			currentStreamingDidCheckpoint: this.currentStreamingDidCheckpoint,
			didCompleteReadingStream: this.didCompleteReadingStream,
		}
	}

	public appendAssistantContent(content: AssistantMessageContent): void {
		this.assistantMessageContent.push(content)
		this.currentStreamingContentIndex = this.assistantMessageContent.length
		this.notifyContentUpdate()
	}

	public setAssistantContent(content: AssistantMessageContent[]): void {
		this.assistantMessageContent = content
		this.currentStreamingContentIndex = content.length
		this.notifyContentUpdate()
	}

	public setAssistantMessageContent(content: AssistantMessageContent[]): void {
		this.assistantMessageContent = content
		this.currentStreamingContentIndex = content.length
		this.notifyContentUpdate()
	}

	public getAssistantMessageContent(): AssistantMessageContent[] {
		return this.assistantMessageContent
	}

	public clearAssistantContent(): void {
		this.assistantMessageContent = []
		this.currentStreamingContentIndex = 0
		this.notifyContentUpdate()
	}

	public clearAssistantMessageContent(): void {
		this.assistantMessageContent = []
		this.currentStreamingContentIndex = 0
		this.notifyContentUpdate()
	}

	public setUserMessageContent(content: any[]): void {
		this.userMessageContent = content
	}

	public getUserMessageContent(): any[] {
		return this.userMessageContent
	}

	public clearUserMessageContent(): void {
		this.userMessageContent = []
	}

	public setUserMessageContentReady(ready: boolean): void {
		this.userMessageContentReady = ready
	}

	public isUserMessageContentReady(): boolean {
		return this.userMessageContentReady
	}

	public startToolCall(toolId: string): void {
		this.streamingToolCallIndices.set(toolId, 0)
	}

	public updateToolCallIndex(toolId: string, index: number): void {
		this.streamingToolCallIndices.set(toolId, index)
	}

	public getToolCallIndex(toolId: string): number {
		return this.streamingToolCallIndices.get(toolId) ?? 0
	}

	public getStreamingToolCallIndex(toolId: string): number {
		return this.streamingToolCallIndices.get(toolId) ?? 0
	}

	public setStreamingToolCallIndex(toolId: string, index: number): void {
		this.streamingToolCallIndices.set(toolId, index)
	}

	public incrementStreamingToolCallIndex(toolId: string): void {
		const currentIndex = this.streamingToolCallIndices.get(toolId) ?? 0
		this.streamingToolCallIndices.set(toolId, currentIndex + 1)
	}

	public clearToolCallIndices(): void {
		this.streamingToolCallIndices.clear()
	}

	public setStreamingDidCheckpoint(value: boolean): void {
		this.currentStreamingDidCheckpoint = value
	}

	public getStreamingDidCheckpoint(): boolean {
		return this.currentStreamingDidCheckpoint
	}

	public setCachedStreamingModel(model: { id: string; info: ModelInfo }): void {
		this.cachedStreamingModel = model
	}

	public getCachedStreamingModel(): { id: string; info: ModelInfo } | undefined {
		return this.cachedStreamingModel
	}

	public clearCachedStreamingModel(): void {
		this.cachedStreamingModel = undefined
	}

	public setPresentAssistantMessageLocked(locked: boolean): void {
		this.presentAssistantMessageLocked = locked
	}

	public isPresentAssistantMessageLocked(): boolean {
		return this.presentAssistantMessageLocked
	}

	public setPresentAssistantMessageHasPendingUpdates(hasUpdates: boolean): void {
		this.presentAssistantMessageHasPendingUpdates = hasUpdates
	}

	public hasPresentAssistantMessagePendingUpdates(): boolean {
		return this.presentAssistantMessageHasPendingUpdates
	}

	public hasPresentAssistantMessageHasPendingUpdates(): boolean {
		return this.presentAssistantMessageHasPendingUpdates
	}

	public setDidRejectTool(rejected: boolean): void {
		this.didRejectTool = rejected
	}

	public didToolRejected(): boolean {
		return this.didRejectTool
	}

	public setDidAlreadyUseTool(used: boolean): void {
		this.didAlreadyUseTool = used
	}

	public hasAlreadyUsedTool(): boolean {
		return this.didAlreadyUseTool
	}

	public setDidToolFailInCurrentTurn(failed: boolean): void {
		this.didToolFailInCurrentTurn = failed
	}

	public didToolFail(): boolean {
		return this.didToolFailInCurrentTurn
	}

	public setDidCompleteReadingStream(completed: boolean): void {
		this.didCompleteReadingStream = completed
		this.notifyStateChange()
	}

	public hasCompletedReadingStream(): boolean {
		return this.didCompleteReadingStream
	}

	public setAssistantMessageParser(parser: any): void {
		this.assistantMessageParser = parser
	}

	public getAssistantMessageParser(): any {
		return this.assistantMessageParser
	}

	public clearAssistantMessageParser(): void {
		this.assistantMessageParser = undefined
	}

	private notifyStateChange(): void {
		if (this.onStreamingStateChange) {
			this.onStreamingStateChange(this.getStreamingState())
		}
	}

	private notifyContentUpdate(): void {
		if (this.onStreamingContentUpdate) {
			this.onStreamingContentUpdate(this.assistantMessageContent)
		}
	}

	public dispose(): void {
		this.resetStreamingState()
		this.onStreamingStateChange = undefined
		this.onStreamingContentUpdate = undefined
	}
}
