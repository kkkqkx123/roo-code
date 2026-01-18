import { describe, it, expect, vi, beforeEach } from "vitest"
import { ApiRequestManager } from "../../api/ApiRequestManager"
import { StreamingManager } from "../../api/StreamingManager"
import type { TaskStateManager } from "../../core/TaskStateManager"
import type { MessageManager } from "../../messaging/MessageManager"
import type { UserInteractionManager } from "../../messaging/UserInteractionManager"
import type { ContextManager } from "../../context/ContextManager"
import type { UsageTracker } from "../../monitoring/UsageTracker"
import type { FileEditorManager } from "../../execution/FileEditorManager"
import type { ApiHandler } from "../../../../../api"
import type { ProviderSettings, TextContent } from "@shared/types"

vi.mock("../../../environment/getEnvironmentDetails", () => ({
	getEnvironmentDetails: vi.fn().mockResolvedValue("<environment_details>\nMock environment details\n</environment_details>"),
}))

describe("ApiRequestManager", () => {
	let mockStateManager: Partial<TaskStateManager>
	let mockMessageManager: Partial<MessageManager>
	let mockUserInteractionManager: Partial<UserInteractionManager>
	let mockContextManager: Partial<ContextManager>
	let mockUsageTracker: Partial<UsageTracker>
	let mockFileEditorManager: Partial<FileEditorManager>
	let mockApi: Partial<ApiHandler>
	let mockStreamingManager: StreamingManager
	let apiRequestManager: ApiRequestManager

	beforeEach(() => {
		mockStateManager = {
			taskId: "task-1",
			taskMode: "code",
			taskToolProtocol: "native",
			abort: false,
			providerRef: {
				deref: vi.fn(),
			},
		} as any

		mockMessageManager = {
			getApiConversationHistory: vi.fn(),
			addToApiConversationHistory: vi.fn(),
			startNewApiRequest: vi.fn(() => 0), // 返回一个默认索引
			endCurrentApiRequest: vi.fn(),
			getCurrentRequestIndex: vi.fn(() => undefined),
			setCurrentRequestIndex: vi.fn(),
			overwriteApiConversationHistory: vi.fn(),
		} as any

		mockUserInteractionManager = {
			say: vi.fn(),
		} as any

		mockContextManager = {} as any

		mockUsageTracker = {
			recordUsage: vi.fn(),
		} as any

		mockFileEditorManager = {} as any

		mockApi = {
			createMessage: vi.fn(),
		} as any

		mockStreamingManager = new StreamingManager({
			taskId: "task-1",
		})

		apiRequestManager = new ApiRequestManager({
			stateManager: mockStateManager as TaskStateManager,
			messageManager: mockMessageManager as MessageManager,
			userInteractionManager: mockUserInteractionManager as UserInteractionManager,
			contextManager: mockContextManager as ContextManager,
			usageTracker: mockUsageTracker as UsageTracker,
			fileEditorManager: mockFileEditorManager as FileEditorManager,
			api: mockApi as ApiHandler,
			apiConfiguration: { apiProvider: "anthropic" } as ProviderSettings,
			cwd: "/workspace",
			streamingManager: mockStreamingManager,
			getSystemPrompt: vi.fn(async () => "test system prompt"),
			getLastGlobalApiRequestTime: vi.fn(() => undefined),
			setLastGlobalApiRequestTime: vi.fn(),
		})
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(apiRequestManager.api).toBe(mockApi)
			expect(apiRequestManager.apiConfiguration).toEqual({ apiProvider: "anthropic" })
			expect(apiRequestManager.cwd).toBe("/workspace")
		})

		it("should initialize streaming state to default values", () => {
			const streamingState = mockStreamingManager.getStreamingState()
			expect(streamingState.isStreaming).toBe(false)
			expect(streamingState.isWaitingForFirstChunk).toBe(false)
			expect(streamingState.currentStreamingContentIndex).toBe(0)
			expect(streamingState.currentStreamingDidCheckpoint).toBe(false)
			expect(mockStreamingManager.getAssistantMessageContent()).toEqual([])
			expect(mockStreamingManager.isPresentAssistantMessageLocked()).toBe(false)
			expect(mockStreamingManager.hasPresentAssistantMessagePendingUpdates()).toBe(false)
			expect(mockStreamingManager.getUserMessageContent()).toEqual([])
			expect(mockStreamingManager.isUserMessageContentReady()).toBe(false)
			expect(mockStreamingManager.isToolRejected()).toBe(false)
			expect(mockStreamingManager.hasAlreadyUsedTool()).toBe(false)
			expect(mockStreamingManager.didToolFail()).toBe(false)
			expect(streamingState.didCompleteReadingStream).toBe(false)
		})
	})

	describe("attemptApiRequest", () => {
		it("should create API message with system prompt and messages", async () => {
			const mockStream = {
				[Symbol.asyncIterator]: vi.fn().mockReturnValue({
					next: vi.fn().mockResolvedValue({ done: true }),
				}),
			}

			vi.spyOn(apiRequestManager, "getSystemPrompt").mockResolvedValue("System prompt")
			mockMessageManager.getApiConversationHistory = vi.fn().mockReturnValue([])
			mockApi.createMessage = vi.fn().mockResolvedValue(mockStream)

			const result = apiRequestManager.attemptApiRequest()

			// Need to start iterating the generator to trigger the API call
			const iterator = result[Symbol.asyncIterator]()
			await iterator.next()

			expect(mockApi.createMessage).toHaveBeenCalledWith(
				"System prompt",
				[],
				expect.objectContaining({
					taskId: "task-1",
					mode: "code",
					suppressPreviousResponseId: undefined,
					toolProtocol: "native",
				}),
			)

			await expect(iterator.next()).resolves.toEqual({ done: true })
		})
	})

	describe("getSystemPrompt", () => {
		it("should return system prompt from getSystemPrompt function", async () => {
			const result = await apiRequestManager.getSystemPrompt()
			expect(result).toBe("test system prompt")
		})
	})

	describe("recursivelyMakeClineRequests", () => {
		it("should process user content and make API request", async () => {
			const mockStream = {
				[Symbol.asyncIterator]: vi.fn().mockReturnValue({
					next: vi.fn()
						.mockResolvedValueOnce({ done: false, value: { type: "text", text: "Hello" } })
						.mockResolvedValueOnce({ done: true }),
				}),
			}

			vi.spyOn(apiRequestManager, "getSystemPrompt").mockResolvedValue("")
			mockMessageManager.getApiConversationHistory = vi.fn().mockReturnValue([])
			mockApi.createMessage = vi.fn().mockResolvedValue(mockStream)

			const result = await apiRequestManager.recursivelyMakeClineRequests([{ type: "text", content: "Test", partial: false }])

			expect(mockUserInteractionManager.say).toHaveBeenCalledWith(
				"api_req_started",
				expect.any(String),
			)
			expect(mockMessageManager.addToApiConversationHistory).toHaveBeenCalledWith({
				role: "user",
				content: expect.any(Array),
			})
			expect(result).toBe(false)
		})

		it("should throw error if task is aborted", async () => {
			mockStateManager.abort = true

			await expect(
				apiRequestManager.recursivelyMakeClineRequests([{ type: "text", content: "Test", partial: false }]),
			).rejects.toThrow("Task task-1 aborted")
		})

		it("should handle retry attempts", async () => {
			const mockStream = {
				[Symbol.asyncIterator]: vi.fn().mockReturnValue({
					next: vi.fn().mockResolvedValue({ done: true }),
				}),
			}

			vi.spyOn(apiRequestManager, "getSystemPrompt").mockResolvedValue("")
			mockMessageManager.getApiConversationHistory = vi.fn().mockReturnValue([])
			mockApi.createMessage = vi.fn().mockResolvedValue(mockStream)

			await apiRequestManager.recursivelyMakeClineRequests([{ type: "text", content: "Test", partial: false }])

			expect(mockUserInteractionManager.say).toHaveBeenCalledWith(
				"api_req_started",
				expect.any(String),
			)
		})
	})

	describe("resetStreamingState", () => {
		it("should reset all streaming state properties", () => {
			mockStreamingManager.startStreaming()
			mockStreamingManager.setStreamingDidCheckpoint(true)
			mockStreamingManager.setAssistantContent([{ type: "text", content: "test", partial: false }])
			mockStreamingManager.setPresentAssistantMessageLocked(true)
			mockStreamingManager.setPresentAssistantMessageHasPendingUpdates(true)
			mockStreamingManager.setUserMessageContent([{ type: "text", content: "user", partial: false }])
			mockStreamingManager.setUserMessageContentReady(true)
			mockStreamingManager.setDidRejectTool(true)
			mockStreamingManager.setDidAlreadyUseTool(true)
			mockStreamingManager.setDidToolFailInCurrentTurn(true)

			apiRequestManager["resetStreamingState"]()

			const streamingState = mockStreamingManager.getStreamingState()
			expect(streamingState.currentStreamingContentIndex).toBe(0)
			expect(streamingState.currentStreamingDidCheckpoint).toBe(false)
			expect(mockStreamingManager.getAssistantMessageContent()).toEqual([])
			expect(streamingState.didCompleteReadingStream).toBe(false)
			expect(mockStreamingManager.getUserMessageContent()).toEqual([])
			expect(mockStreamingManager.isUserMessageContentReady()).toBe(false)
			expect(mockStreamingManager.isToolRejected()).toBe(false)
			expect(mockStreamingManager.hasAlreadyUsedTool()).toBe(false)
			expect(mockStreamingManager.didToolFail()).toBe(false)
			expect(mockStreamingManager.isPresentAssistantMessageLocked()).toBe(false)
			expect(mockStreamingManager.hasPresentAssistantMessagePendingUpdates()).toBe(false)
		})
	})

	describe("handleStreamChunk", () => {
		it("should handle reasoning chunk", async () => {
			const chunk = { type: "reasoning", text: "Thinking..." }

			await apiRequestManager["handleStreamChunk"](chunk)

			expect(mockUserInteractionManager.say).toHaveBeenCalledWith("reasoning", "Thinking...", undefined, true)
		})

		it("should handle usage chunk", async () => {
			const chunk = { type: "usage", inputTokens: 100, outputTokens: 50 }

			await apiRequestManager["handleStreamChunk"](chunk)

			expect(mockUsageTracker.recordUsage).toHaveBeenCalledWith(chunk)
		})

		it("should handle grounding chunk", async () => {
			const chunk = { type: "grounding", sources: [] }

			await apiRequestManager["handleStreamChunk"](chunk)

			expect(mockUserInteractionManager.say).not.toHaveBeenCalled()
		})

		it("should handle tool_call_partial chunk", async () => {
			const chunk = { type: "tool_call_partial", index: 0, id: "tool-1", name: "test", arguments: "{}" }

			await apiRequestManager["handleStreamChunk"](chunk)
		})

		it("should handle text chunk", async () => {
			const chunk = { type: "text", text: "Hello" }

			await apiRequestManager["handleStreamChunk"](chunk)
		})
	})

	describe("backoffAndAnnounce", () => {
		it("should perform exponential backoff with countdown", async () => {
			const mockProvider = {
				getState: vi.fn().mockResolvedValue({ requestDelaySeconds: 1 }),
			}

			mockStateManager.providerRef!.deref = vi.fn().mockReturnValue(mockProvider)

			const error = new Error("Test error") as any
			error.status = 429
			error.message = "Rate limit exceeded"

			vi.useFakeTimers()

			const promise = apiRequestManager.backoffAndAnnounce(0, error)

			for (let i = 1; i <= 2; i++) {
				await vi.advanceTimersByTimeAsync(1000)
			}

			await promise

			vi.useRealTimers()

			expect(mockUserInteractionManager.say).toHaveBeenCalledWith(
				"api_req_retry_delayed",
				expect.stringContaining("429"),
				undefined,
				true,
			)
		})

		it("should handle error without status", async () => {
			const mockProvider = {
				getState: vi.fn().mockResolvedValue({ requestDelaySeconds: 1 }),
			}

			mockStateManager.providerRef!.deref = vi.fn().mockReturnValue(mockProvider)

			const error = new Error("Test error")

			vi.useFakeTimers()

			const promise = apiRequestManager.backoffAndAnnounce(0, error)

			await vi.advanceTimersByTimeAsync(1000)
			await promise

			vi.useRealTimers()

			expect(mockUserInteractionManager.say).toHaveBeenCalledWith(
				"api_req_retry_delayed",
				expect.stringContaining("Test error"),
				undefined,
				true,
			)
		})

		it("should handle unknown error", async () => {
			const mockProvider = {
				getState: vi.fn().mockResolvedValue({ requestDelaySeconds: 1 }),
			}

			mockStateManager.providerRef!.deref = vi.fn().mockReturnValue(mockProvider)

			const error = {}

			vi.useFakeTimers()

			const promise = apiRequestManager.backoffAndAnnounce(0, error)

			await vi.advanceTimersByTimeAsync(1000)
			await promise

			vi.useRealTimers()

			expect(mockUserInteractionManager.say).toHaveBeenCalledWith(
				"api_req_retry_delayed",
				expect.stringContaining("Unknown error"),
				undefined,
				true,
			)
		})

		it("should throw error if task is aborted during backoff", async () => {
			const mockProvider = {
				getState: vi.fn().mockResolvedValue({ requestDelaySeconds: 5 }),
			}

			mockStateManager.providerRef!.deref = vi.fn().mockReturnValue(mockProvider)
			mockUserInteractionManager.say = vi.fn().mockResolvedValue(undefined)

			vi.useFakeTimers()

			// Add global error handler to catch unhandled rejections
			const unhandledRejectionHandler = vi.fn()
			process.on('unhandledRejection', unhandledRejectionHandler)

			const promise = apiRequestManager.backoffAndAnnounce(0, {})

			// Advance to complete the first iteration (i=5)
			await vi.advanceTimersByTimeAsync(1000)

			// Set abort before the second iteration
			mockStateManager.abort = true

			// Advance to trigger the abort check in the second iteration (i=4)
			await vi.advanceTimersByTimeAsync(1000)

			await expect(promise).rejects.toThrow("Aborted during retry countdown")

			// Clean up the error handler
			process.off('unhandledRejection', unhandledRejectionHandler)

			vi.useRealTimers()
		})

		it("should handle missing provider", async () => {
			mockStateManager.providerRef!.deref = vi.fn().mockReturnValue(null)

			await expect(apiRequestManager.backoffAndAnnounce(0, {})).resolves.not.toThrow()
		})
	})

	describe("streaming state management", () => {
		it("should track streaming state correctly", () => {
			const streamingState = mockStreamingManager.getStreamingState()
			expect(streamingState.isStreaming).toBe(false)
			mockStreamingManager.startStreaming()
			const newState = mockStreamingManager.getStreamingState()
			expect(newState.isStreaming).toBe(true)
		})

		it("should track assistant message content", () => {
			const content: TextContent[] = [{ type: "text", content: "test", partial: false }]
			mockStreamingManager.setAssistantContent(content)
			expect(mockStreamingManager.getAssistantMessageContent()).toEqual(content)
		})

		it("should track user message content", () => {
			const content: TextContent[] = [{ type: "text", content: "user input", partial: false }]
			mockStreamingManager.setUserMessageContent(content)
			expect(mockStreamingManager.getUserMessageContent()).toEqual(content)
		})

		it("should track tool usage state", () => {
			expect(mockStreamingManager.isToolRejected()).toBe(false)
			mockStreamingManager.setDidRejectTool(true)
			expect(mockStreamingManager.isToolRejected()).toBe(true)

			expect(mockStreamingManager.hasAlreadyUsedTool()).toBe(false)
			mockStreamingManager.setDidAlreadyUseTool(true)
			expect(mockStreamingManager.hasAlreadyUsedTool()).toBe(true)

			expect(mockStreamingManager.didToolFail()).toBe(false)
			mockStreamingManager.setDidToolFailInCurrentTurn(true)
			expect(mockStreamingManager.didToolFail()).toBe(true)
		})
	})
})
