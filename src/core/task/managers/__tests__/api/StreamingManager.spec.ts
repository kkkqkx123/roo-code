import { describe, it, expect, vi, beforeEach } from "vitest"
import { StreamingManager } from "../../api/StreamingManager"

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
			// taskId is now private, so we verify the manager was created successfully
			expect(streamingManager).toBeDefined()
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
			expect(streamingManager.hasPresentAssistantMessagePendingUpdates()).toBe(false)
			expect(streamingManager.isUserMessageContentReady()).toBe(false)
			expect(streamingManager.isToolRejected()).toBe(false)
			expect(streamingManager.hasAlreadyUsedTool()).toBe(false)
			expect(streamingManager.didToolFail()).toBe(false)
		})

		it("should initialize without callbacks if not provided", () => {
			const managerWithoutCallbacks = new StreamingManager({
				taskId: "task-2",
			})

			// taskId is now private, so we verify the manager was created successfully
			expect(managerWithoutCallbacks).toBeDefined()
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
			streamingManager.setAssistantContent([
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
			expect(streamingManager.hasPresentAssistantMessagePendingUpdates()).toBe(false)
			expect(streamingManager.isUserMessageContentReady()).toBe(false)
			expect(streamingManager.isToolRejected()).toBe(false)
			expect(streamingManager.hasAlreadyUsedTool()).toBe(false)
			expect(streamingManager.didToolFail()).toBe(false)
		})

		it("should reset assistant message parser", () => {
			const mockParser = { parse: vi.fn() }
			streamingManager.setAssistantMessageParser(mockParser)
			expect(streamingManager.getAssistantMessageParser()).toBe(mockParser)

			streamingManager.resetStreamingState()
			expect(streamingManager.getAssistantMessageParser()).toBeUndefined()
		})

		it("should call state change callback after reset", () => {
			streamingManager.resetStreamingState()
			expect(mockOnStreamingStateChange).toHaveBeenCalled()
		})
	})

	describe("startStreaming and stopStreaming", () => {
		it("should start streaming and set waiting for first chunk", () => {
			streamingManager.startStreaming()

			const state = streamingManager.getStreamingState()
			expect(state.isStreaming).toBe(true)
			expect(state.isWaitingForFirstChunk).toBe(true)
			expect(mockOnStreamingStateChange).toHaveBeenCalled()
		})

		it("should stop streaming and clear waiting for first chunk", () => {
			streamingManager.startStreaming()
			mockOnStreamingStateChange.mockClear()

			streamingManager.stopStreaming()

			const state = streamingManager.getStreamingState()
			expect(state.isStreaming).toBe(false)
			expect(state.isWaitingForFirstChunk).toBe(false)
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

		it("should get and set currentStreamingContentIndex and trigger notification", () => {
			expect(streamingManager.getStreamingState().currentStreamingContentIndex).toBe(0)

			streamingManager.setCurrentStreamingContentIndex(5)
			expect(streamingManager.getStreamingState().currentStreamingContentIndex).toBe(5)
			expect(mockOnStreamingStateChange).toHaveBeenCalled()

			streamingManager.setCurrentStreamingContentIndex(0)
			expect(streamingManager.getStreamingState().currentStreamingContentIndex).toBe(0)
		})

		it("should get and set currentStreamingDidCheckpoint and trigger notification", () => {
			expect(streamingManager.getStreamingState().currentStreamingDidCheckpoint).toBe(false)

			streamingManager.setCurrentStreamingDidCheckpoint(true)
			expect(streamingManager.getStreamingState().currentStreamingDidCheckpoint).toBe(true)
			expect(mockOnStreamingStateChange).toHaveBeenCalled()

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

		it("should get and set streamingDidCheckpoint and trigger notification", () => {
			expect(streamingManager.getStreamingDidCheckpoint()).toBe(false)

			streamingManager.setStreamingDidCheckpoint(true)
			expect(streamingManager.getStreamingDidCheckpoint()).toBe(true)
			expect(mockOnStreamingStateChange).toHaveBeenCalled()

			streamingManager.setStreamingDidCheckpoint(false)
			expect(streamingManager.getStreamingDidCheckpoint()).toBe(false)
		})
	})

	describe("assistant message content management", () => {
		it("should get and set assistant message content", () => {
			const content = [
				{ type: "text", content: "Hello" },
				{ type: "tool_use", id: "tool-1", name: "test" },
			] as any

			streamingManager.setAssistantContent(content)
			expect(streamingManager.getAssistantMessageContent()).toEqual(content)
		})

		it("should append assistant message content", () => {
			const content1 = { type: "text", content: "Hello" } as any
			const content2 = { type: "text", content: "World" } as any

			streamingManager.appendAssistantContent(content1)
			expect(streamingManager.getAssistantMessageContent()).toEqual([content1])

			streamingManager.appendAssistantContent(content2)
			expect(streamingManager.getAssistantMessageContent()).toEqual([content1, content2])
		})

		it("should clear assistant message content", () => {
			streamingManager.setAssistantContent([{ type: "text", content: "test" }] as any)
			expect(streamingManager.getAssistantMessageContent()).toHaveLength(1)

			streamingManager.clearAssistantContent()
			expect(streamingManager.getAssistantMessageContent()).toEqual([])
		})

		it("should call content update callback when content is set", () => {
			const content = [{ type: "text", content: "test" }] as any
			streamingManager.setAssistantContent(content)
			expect(mockOnStreamingContentUpdate).toHaveBeenCalledWith(content)
		})

		it("should call content update callback when content is appended", () => {
			const content = [{ type: "text", content: "test" }] as any
			streamingManager.appendAssistantContent(content)
			expect(mockOnStreamingContentUpdate).toHaveBeenCalledWith([content])
		})

		it("should call content update callback when content is cleared", () => {
			streamingManager.setAssistantContent([{ type: "text", content: "test" }] as any)
			mockOnStreamingContentUpdate.mockClear()

			streamingManager.clearAssistantContent()
			expect(mockOnStreamingContentUpdate).toHaveBeenCalledWith([])
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
			expect(streamingManager.hasPresentAssistantMessagePendingUpdates()).toBe(false)

			streamingManager.setPresentAssistantMessageHasPendingUpdates(true)
			expect(streamingManager.hasPresentAssistantMessagePendingUpdates()).toBe(true)

			streamingManager.setPresentAssistantMessageHasPendingUpdates(false)
			expect(streamingManager.hasPresentAssistantMessagePendingUpdates()).toBe(false)
		})
	})

	describe("tool call state management", () => {
		it("should get and set didRejectTool", () => {
			expect(streamingManager.isToolRejected()).toBe(false)

			streamingManager.setDidRejectTool(true)
			expect(streamingManager.isToolRejected()).toBe(true)

			streamingManager.setDidRejectTool(false)
			expect(streamingManager.isToolRejected()).toBe(false)
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
		it("should get tool call index for tool use id", () => {
			expect(streamingManager.getToolCallIndex("tool-1")).toBe(0)

			streamingManager.setStreamingToolCallIndex("tool-1", 5)
			expect(streamingManager.getToolCallIndex("tool-1")).toBe(5)
		})

		it("should start tool call with index 0", () => {
			streamingManager.startToolCall("tool-1")
			expect(streamingManager.getToolCallIndex("tool-1")).toBe(0)
		})

		it("should update tool call index", () => {
			streamingManager.updateToolCallIndex("tool-1", 10)
			expect(streamingManager.getToolCallIndex("tool-1")).toBe(10)
		})

		it("should increment streaming tool call index for tool use id", () => {
			expect(streamingManager.getToolCallIndex("tool-1")).toBe(0)

			streamingManager.incrementStreamingToolCallIndex("tool-1")
			expect(streamingManager.getToolCallIndex("tool-1")).toBe(1)

			streamingManager.incrementStreamingToolCallIndex("tool-1")
			expect(streamingManager.getToolCallIndex("tool-1")).toBe(2)
		})

		it("should clear all tool call indices", () => {
			streamingManager.setStreamingToolCallIndex("tool-1", 5)
			streamingManager.setStreamingToolCallIndex("tool-2", 10)

			streamingManager.clearToolCallIndices()

			expect(streamingManager.getToolCallIndex("tool-1")).toBe(0)
			expect(streamingManager.getToolCallIndex("tool-2")).toBe(0)
		})

		it("should handle multiple tool call indices independently", () => {
			streamingManager.setStreamingToolCallIndex("tool-1", 5)
			streamingManager.setStreamingToolCallIndex("tool-2", 10)
			streamingManager.setStreamingToolCallIndex("tool-3", 15)

			expect(streamingManager.getToolCallIndex("tool-1")).toBe(5)
			expect(streamingManager.getToolCallIndex("tool-2")).toBe(10)
			expect(streamingManager.getToolCallIndex("tool-3")).toBe(15)
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

		it("should call state change callback when setCurrentStreamingContentIndex is called", () => {
			streamingManager.setCurrentStreamingContentIndex(5)
			expect(mockOnStreamingStateChange).toHaveBeenCalled()
		})

		it("should call state change callback when setCurrentStreamingDidCheckpoint is called", () => {
			streamingManager.setCurrentStreamingDidCheckpoint(true)
			expect(mockOnStreamingStateChange).toHaveBeenCalled()
		})

		it("should call state change callback when setStreamingDidCheckpoint is called", () => {
			streamingManager.setStreamingDidCheckpoint(true)
			expect(mockOnStreamingStateChange).toHaveBeenCalled()
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

		it("should not call content update callback if not provided", () => {
			const managerWithoutCallback = new StreamingManager({
				taskId: "task-4",
			})

			expect(() => {
				managerWithoutCallback.setAssistantContent([{ type: "text", content: "test" }] as any)
				managerWithoutCallback.appendAssistantContent({ type: "text", content: "test" } as any)
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

	describe("dispose", () => {
		it("should clear callbacks and reset state", () => {
			streamingManager.setStreamingState(true)
			streamingManager.setAssistantContent([{ type: "text", content: "test" }] as any)

			streamingManager.dispose()

			// Verify state is reset after dispose
			const state = streamingManager.getStreamingState()
			expect(state.isStreaming).toBe(false)
			expect(streamingManager.getAssistantMessageContent()).toEqual([])

			// Verify callbacks are cleared by checking they are not called after dispose
			mockOnStreamingStateChange.mockClear()
			mockOnStreamingContentUpdate.mockClear()

			streamingManager.setStreamingState(true)
			streamingManager.setAssistantContent([{ type: "text", content: "test2" }] as any)

			// Callbacks should not be called after dispose
			expect(mockOnStreamingStateChange).not.toHaveBeenCalled()
			expect(mockOnStreamingContentUpdate).not.toHaveBeenCalled()
		})

		it("should not throw when calling methods after dispose", () => {
			streamingManager.dispose()

			expect(() => {
				streamingManager.setStreamingState(true)
				streamingManager.setAssistantContent([{ type: "text", content: "test" }] as any)
				streamingManager.getStreamingState()
			}).not.toThrow()
		})
	})

	describe("edge cases and error scenarios", () => {
		it("should handle negative content index", () => {
			streamingManager.setCurrentStreamingContentIndex(-1)
			expect(streamingManager.getStreamingState().currentStreamingContentIndex).toBe(-1)
		})

		it("should handle very large content index", () => {
			streamingManager.setCurrentStreamingContentIndex(Number.MAX_SAFE_INTEGER)
			expect(streamingManager.getStreamingState().currentStreamingContentIndex).toBe(Number.MAX_SAFE_INTEGER)
		})

		it("should handle empty tool call ID", () => {
			streamingManager.setStreamingToolCallIndex("", 5)
			expect(streamingManager.getToolCallIndex("")).toBe(5)
		})

		it("should handle special characters in tool call ID", () => {
			const specialId = "tool-1_!@#$%^&*()"
			streamingManager.setStreamingToolCallIndex(specialId, 5)
			expect(streamingManager.getToolCallIndex(specialId)).toBe(5)
		})

		it("should handle rapid state changes", () => {
			for (let i = 0; i < 100; i++) {
				streamingManager.setStreamingState(i % 2 === 0)
				streamingManager.setCurrentStreamingContentIndex(i)
			}

			const state = streamingManager.getStreamingState()
			expect(state.isStreaming).toBe(false)
			expect(state.currentStreamingContentIndex).toBe(99)
		})

		it("should handle multiple rapid content updates", () => {
			for (let i = 0; i < 100; i++) {
				streamingManager.appendAssistantContent({ type: "text", content: `chunk-${i}` } as any)
			}

			expect(streamingManager.getAssistantMessageContent()).toHaveLength(100)
			expect(mockOnStreamingContentUpdate).toHaveBeenCalledTimes(100)
		})

		it("should handle concurrent tool call index operations", () => {
			streamingManager.setStreamingToolCallIndex("tool-1", 5)
			streamingManager.incrementStreamingToolCallIndex("tool-1")
			streamingManager.updateToolCallIndex("tool-1", 10)
			streamingManager.incrementStreamingToolCallIndex("tool-1")

			expect(streamingManager.getToolCallIndex("tool-1")).toBe(11)
		})
	})
})