import { describe, it, expect, vi, beforeEach } from "vitest"
import { StreamingManager } from "../StreamingManager"
import { RooCodeEventName } from "@roo-code/types"

describe("StreamingManager", () => {
	let streamingManager: StreamingManager
	let mockOnStreamingStateChange: ReturnType<typeof vi.fn>
	let mockOnStreamingContentUpdate: ReturnType<typeof vi.fn>

	beforeEach(() => {
		mockOnStreamingStateChange = vi.fn()
		mockOnStreamingContentUpdate = vi.fn()

		streamingManager = new StreamingManager({
			taskId: "task-1",
			onStreamingStateChange: mockOnStreamingStateChange,
			onStreamingContentUpdate: mockOnStreamingContentUpdate,
		})
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(streamingManager.taskId).toBe("task-1")
		})

		it("should initialize streaming state to default values", () => {
			const state = streamingManager.getStreamingState()
			expect(state.isStreaming).toBe(false)
			expect(state.isWaitingForFirstChunk).toBe(false)
			expect(state.currentStreamingContentIndex).toBe(0)
			expect(state.currentStreamingDidCheckpoint).toBe(false)
			expect(state.didCompleteReadingStream).toBe(false)
		})

		it("should initialize message content to empty arrays", () => {
			expect(streamingManager.getAssistantMessageContent()).toEqual([])
			expect(streamingManager.getUserMessageContent()).toEqual([])
		})

		it("should initialize flags to default values", () => {
			expect(streamingManager.isPresentAssistantMessageLocked()).toBe(false)
			expect(streamingManager.hasPresentAssistantMessageHasPendingUpdates()).toBe(false)
			expect(streamingManager.isUserMessageContentReady()).toBe(false)
			expect(streamingManager.didToolRejected()).toBe(false)
			expect(streamingManager.hasAlreadyUsedTool()).toBe(false)
			expect(streamingManager.didToolFail()).toBe(false)
		})

		it("should initialize without callbacks if not provided", () => {
			const managerWithoutCallbacks = new StreamingManager({
				taskId: "task-2",
			})

			expect(managerWithoutCallbacks.taskId).toBe("task-2")
		})
	})

	describe("resetStreamingState", () => {
		it("should reset all streaming state to default values", () => {
			streamingManager.setStreamingState(true)
			streamingManager.setWaitingForFirstChunk(true)
			streamingManager.setCurrentStreamingContentIndex(5)
			streamingManager.setCurrentStreamingDidCheckpoint(true)
			streamingManager.setDidCompleteReadingStream(true)

			streamingManager.resetStreamingState()

			const state = streamingManager.getStreamingState()
			expect(state.isStreaming).toBe(false)
			expect(state.isWaitingForFirstChunk).toBe(false)
			expect(state.currentStreamingContentIndex).toBe(0)
			expect(state.currentStreamingDidCheckpoint).toBe(false)
			expect(state.didCompleteReadingStream).toBe(false)
		})

		it("should reset message content to empty arrays", () => {
			streamingManager.setAssistantMessageContent([
				{ type: "text", content: "test" },
			] as any)
			streamingManager.setUserMessageContent([{ text: "test" }])

			streamingManager.resetStreamingState()

			expect(streamingManager.getAssistantMessageContent()).toEqual([])
			expect(streamingManager.getUserMessageContent()).toEqual([])
		})

		it("should reset all flags to default values", () => {
			streamingManager.setPresentAssistantMessageLocked(true)
			streamingManager.setPresentAssistantMessageHasPendingUpdates(true)
			streamingManager.setUserMessageContentReady(true)
			streamingManager.setDidRejectTool(true)
			streamingManager.setDidAlreadyUseTool(true)
			streamingManager.setDidToolFailInCurrentTurn(true)

			streamingManager.resetStreamingState()

			expect(streamingManager.isPresentAssistantMessageLocked()).toBe(false)
			expect(streamingManager.hasPresentAssistantMessageHasPendingUpdates()).toBe(false)
			expect(streamingManager.isUserMessageContentReady()).toBe(false)
			expect(streamingManager.didToolRejected()).toBe(false)
			expect(streamingManager.hasAlreadyUsedTool()).toBe(false)
			expect(streamingManager.didToolFail()).toBe(false)
		})

		it("should call state change callback after reset", () => {
			streamingManager.resetStreamingState()
			expect(mockOnStreamingStateChange).toHaveBeenCalled()
		})
	})

	describe("streaming state management", () => {
		it("should get and set isStreaming", () => {
			expect(streamingManager.getStreamingState().isStreaming).toBe(false)

			streamingManager.setStreamingState(true)
			expect(streamingManager.getStreamingState().isStreaming).toBe(true)

			streamingManager.setStreamingState(false)
			expect(streamingManager.getStreamingState().isStreaming).toBe(false)
		})

		it("should get and set isWaitingForFirstChunk", () => {
			expect(streamingManager.getStreamingState().isWaitingForFirstChunk).toBe(false)

			streamingManager.setWaitingForFirstChunk(true)
			expect(streamingManager.getStreamingState().isWaitingForFirstChunk).toBe(true)

			streamingManager.setWaitingForFirstChunk(false)
			expect(streamingManager.getStreamingState().isWaitingForFirstChunk).toBe(false)
		})

		it("should get and set currentStreamingContentIndex", () => {
			expect(streamingManager.getStreamingState().currentStreamingContentIndex).toBe(0)

			streamingManager.setCurrentStreamingContentIndex(5)
			expect(streamingManager.getStreamingState().currentStreamingContentIndex).toBe(5)

			streamingManager.setCurrentStreamingContentIndex(0)
			expect(streamingManager.getStreamingState().currentStreamingContentIndex).toBe(0)
		})

		it("should get and set currentStreamingDidCheckpoint", () => {
			expect(streamingManager.getStreamingState().currentStreamingDidCheckpoint).toBe(false)

			streamingManager.setCurrentStreamingDidCheckpoint(true)
			expect(streamingManager.getStreamingState().currentStreamingDidCheckpoint).toBe(true)

			streamingManager.setCurrentStreamingDidCheckpoint(false)
			expect(streamingManager.getStreamingState().currentStreamingDidCheckpoint).toBe(false)
		})

		it("should get and set didCompleteReadingStream", () => {
			expect(streamingManager.getStreamingState().didCompleteReadingStream).toBe(false)

			streamingManager.setDidCompleteReadingStream(true)
			expect(streamingManager.getStreamingState().didCompleteReadingStream).toBe(true)

			streamingManager.setDidCompleteReadingStream(false)
			expect(streamingManager.getStreamingState().didCompleteReadingStream).toBe(false)
		})
	})

	describe("assistant message content management", () => {
		it("should get and set assistant message content", () => {
			const content = [
				{ type: "text", content: "Hello" },
				{ type: "tool_use", id: "tool-1", name: "test" },
			] as any

			streamingManager.setAssistantMessageContent(content)
			expect(streamingManager.getAssistantMessageContent()).toEqual(content)
		})

		it("should clear assistant message content", () => {
			streamingManager.setAssistantMessageContent([{ type: "text", content: "test" }] as any)
			expect(streamingManager.getAssistantMessageContent()).toHaveLength(1)

			streamingManager.clearAssistantMessageContent()
			expect(streamingManager.getAssistantMessageContent()).toEqual([])
		})

		it("should call content update callback when content is set", () => {
			const content = [{ type: "text", content: "test" }] as any
			streamingManager.setAssistantMessageContent(content)
			expect(mockOnStreamingContentUpdate).toHaveBeenCalledWith(content)
		})
	})

	describe("user message content management", () => {
		it("should get and set user message content", () => {
			const content = [{ text: "Hello" }, { image: "base64..." }]

			streamingManager.setUserMessageContent(content)
			expect(streamingManager.getUserMessageContent()).toEqual(content)
		})

		it("should clear user message content", () => {
			streamingManager.setUserMessageContent([{ text: "test" }])
			expect(streamingManager.getUserMessageContent()).toHaveLength(1)

			streamingManager.clearUserMessageContent()
			expect(streamingManager.getUserMessageContent()).toEqual([])
		})

		it("should get and set userMessageContentReady", () => {
			expect(streamingManager.isUserMessageContentReady()).toBe(false)

			streamingManager.setUserMessageContentReady(true)
			expect(streamingManager.isUserMessageContentReady()).toBe(true)

			streamingManager.setUserMessageContentReady(false)
			expect(streamingManager.isUserMessageContentReady()).toBe(false)
		})
	})

	describe("message locking and updates", () => {
		it("should get and set presentAssistantMessageLocked", () => {
			expect(streamingManager.isPresentAssistantMessageLocked()).toBe(false)

			streamingManager.setPresentAssistantMessageLocked(true)
			expect(streamingManager.isPresentAssistantMessageLocked()).toBe(true)

			streamingManager.setPresentAssistantMessageLocked(false)
			expect(streamingManager.isPresentAssistantMessageLocked()).toBe(false)
		})

		it("should get and set presentAssistantMessageHasPendingUpdates", () => {
			expect(streamingManager.hasPresentAssistantMessageHasPendingUpdates()).toBe(false)

			streamingManager.setPresentAssistantMessageHasPendingUpdates(true)
			expect(streamingManager.hasPresentAssistantMessageHasPendingUpdates()).toBe(true)

			streamingManager.setPresentAssistantMessageHasPendingUpdates(false)
			expect(streamingManager.hasPresentAssistantMessageHasPendingUpdates()).toBe(false)
		})
	})

	describe("tool call state management", () => {
		it("should get and set didRejectTool", () => {
			expect(streamingManager.didToolRejected()).toBe(false)

			streamingManager.setDidRejectTool(true)
			expect(streamingManager.didToolRejected()).toBe(true)

			streamingManager.setDidRejectTool(false)
			expect(streamingManager.didToolRejected()).toBe(false)
		})

		it("should get and set didAlreadyUseTool", () => {
			expect(streamingManager.hasAlreadyUsedTool()).toBe(false)

			streamingManager.setDidAlreadyUseTool(true)
			expect(streamingManager.hasAlreadyUsedTool()).toBe(true)

			streamingManager.setDidAlreadyUseTool(false)
			expect(streamingManager.hasAlreadyUsedTool()).toBe(false)
		})

		it("should get and set didToolFailInCurrentTurn", () => {
			expect(streamingManager.didToolFail()).toBe(false)

			streamingManager.setDidToolFailInCurrentTurn(true)
			expect(streamingManager.didToolFail()).toBe(true)

			streamingManager.setDidToolFailInCurrentTurn(false)
			expect(streamingManager.didToolFail()).toBe(false)
		})
	})

	describe("assistant message parser management", () => {
		it("should get and set assistant message parser", () => {
			const mockParser = { parse: vi.fn() }

			expect(streamingManager.getAssistantMessageParser()).toBeUndefined()

			streamingManager.setAssistantMessageParser(mockParser as any)
			expect(streamingManager.getAssistantMessageParser()).toBe(mockParser)

			streamingManager.setAssistantMessageParser(undefined)
			expect(streamingManager.getAssistantMessageParser()).toBeUndefined()
		})

		it("should clear assistant message parser", () => {
			const mockParser = { parse: vi.fn() }
			streamingManager.setAssistantMessageParser(mockParser as any)
			expect(streamingManager.getAssistantMessageParser()).toBeDefined()

			streamingManager.clearAssistantMessageParser()
			expect(streamingManager.getAssistantMessageParser()).toBeUndefined()
		})
	})

	describe("streaming tool call indices", () => {
		it("should get streaming tool call index for tool use id", () => {
			expect(streamingManager.getStreamingToolCallIndex("tool-1")).toBe(0)

			streamingManager.setStreamingToolCallIndex("tool-1", 5)
			expect(streamingManager.getStreamingToolCallIndex("tool-1")).toBe(5)
		})

		it("should increment streaming tool call index for tool use id", () => {
			expect(streamingManager.getStreamingToolCallIndex("tool-1")).toBe(0)

			streamingManager.incrementStreamingToolCallIndex("tool-1")
			expect(streamingManager.getStreamingToolCallIndex("tool-1")).toBe(1)

			streamingManager.incrementStreamingToolCallIndex("tool-1")
			expect(streamingManager.getStreamingToolCallIndex("tool-1")).toBe(2)
		})
	})

	describe("cached streaming model", () => {
		it("should get and set cached streaming model", () => {
			const mockModel = { id: "claude-3-5-sonnet", info: { supportsNativeTools: true } }

			expect(streamingManager.getCachedStreamingModel()).toBeUndefined()

			streamingManager.setCachedStreamingModel(mockModel as any)
			expect(streamingManager.getCachedStreamingModel()).toEqual(mockModel)

			streamingManager.clearCachedStreamingModel()
			expect(streamingManager.getCachedStreamingModel()).toBeUndefined()
		})
	})

	describe("state notifications", () => {
		it("should call state change callback when state changes", () => {
			streamingManager.setStreamingState(true)
			expect(mockOnStreamingStateChange).toHaveBeenCalled()

			streamingManager.setWaitingForFirstChunk(true)
			expect(mockOnStreamingStateChange).toHaveBeenCalledTimes(2)
		})

		it("should not call state change callback if not provided", () => {
			const managerWithoutCallback = new StreamingManager({
				taskId: "task-3",
			})

			expect(() => {
				managerWithoutCallback.setStreamingState(true)
				managerWithoutCallback.setWaitingForFirstChunk(true)
			}).not.toThrow()
		})
	})

	describe("getStreamingState", () => {
		it("should return complete streaming state object", () => {
			streamingManager.setStreamingState(true)
			streamingManager.setWaitingForFirstChunk(true)
			streamingManager.setCurrentStreamingContentIndex(3)
			streamingManager.setCurrentStreamingDidCheckpoint(true)
			streamingManager.setDidCompleteReadingStream(true)

			const state = streamingManager.getStreamingState()

			expect(state).toEqual({
				isStreaming: true,
				isWaitingForFirstChunk: true,
				currentStreamingContentIndex: 3,
				currentStreamingDidCheckpoint: true,
				didCompleteReadingStream: true,
			})
		})
	})
})
