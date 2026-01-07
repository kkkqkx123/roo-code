import { describe, it, expect, vi, beforeEach } from "vitest"
import { ApiRequestManager } from "../ApiRequestManager"
import type { TaskStateManager } from "../TaskStateManager"
import type { MessageManager } from "../MessageManager"
import type { UserInteractionManager } from "../UserInteractionManager"
import type { ContextManager } from "../ContextManager"
import type { UsageTracker } from "../UsageTracker"
import type { FileEditorManager } from "../FileEditorManager"
import type { ApiHandler } from "../../../../api"
import type { ProviderSettings } from "@roo-code/types"
import type { TextContent } from "../../../../shared/tools"

describe("ApiRequestManager", () => {
	let mockStateManager: Partial<TaskStateManager>
	let mockMessageManager: Partial<MessageManager>
	let mockUserInteractionManager: Partial<UserInteractionManager>
	let mockContextManager: Partial<ContextManager>
	let mockUsageTracker: Partial<UsageTracker>
	let mockFileEditorManager: Partial<FileEditorManager>
	let mockApi: Partial<ApiHandler>
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
		})
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(apiRequestManager.api).toBe(mockApi)
			expect(apiRequestManager.apiConfiguration).toEqual({ apiProvider: "anthropic" })
			expect(apiRequestManager.cwd).toBe("/workspace")
		})

		it("should initialize streaming state to default values", () => {
			expect(apiRequestManager.isStreaming).toBe(false)
			expect(apiRequestManager.isWaitingForFirstChunk).toBe(false)
			expect(apiRequestManager.currentStreamingContentIndex).toBe(0)
			expect(apiRequestManager.currentStreamingDidCheckpoint).toBe(false)
			expect(apiRequestManager.assistantMessageContent).toEqual([])
			expect(apiRequestManager.presentAssistantMessageLocked).toBe(false)
			expect(apiRequestManager.presentAssistantMessageHasPendingUpdates).toBe(false)
			expect(apiRequestManager.userMessageContent).toEqual([])
			expect(apiRequestManager.userMessageContentReady).toBe(false)
			expect(apiRequestManager.didRejectTool).toBe(false)
			expect(apiRequestManager.didAlreadyUseTool).toBe(false)
			expect(apiRequestManager.didToolFailInCurrentTurn).toBe(false)
			expect(apiRequestManager.didCompleteReadingStream).toBe(false)
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

			const iterator = result[Symbol.asyncIterator]()
			await expect(iterator.next()).resolves.toEqual({ done: true })
		})
	})

	describe("getSystemPrompt", () => {
		it("should return empty string", async () => {
			const result = await apiRequestManager.getSystemPrompt()
			expect(result).toBe("")
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
			apiRequestManager.isStreaming = true
			apiRequestManager.isWaitingForFirstChunk = true
			apiRequestManager.currentStreamingContentIndex = 5
			apiRequestManager.currentStreamingDidCheckpoint = true
			apiRequestManager.assistantMessageContent = [{ type: "text", content: "test", partial: false }]
			apiRequestManager.presentAssistantMessageLocked = true
			apiRequestManager.presentAssistantMessageHasPendingUpdates = true
			apiRequestManager.userMessageContent = [{ type: "text", content: "user", partial: false }]
			apiRequestManager.userMessageContentReady = true
			apiRequestManager.didRejectTool = true
			apiRequestManager.didAlreadyUseTool = true
			apiRequestManager.didToolFailInCurrentTurn = true

			apiRequestManager["resetStreamingState"]()

			expect(apiRequestManager.currentStreamingContentIndex).toBe(0)
			expect(apiRequestManager.currentStreamingDidCheckpoint).toBe(false)
			expect(apiRequestManager.assistantMessageContent).toEqual([])
			expect(apiRequestManager.didCompleteReadingStream).toBe(false)
			expect(apiRequestManager.userMessageContent).toEqual([])
			expect(apiRequestManager.userMessageContentReady).toBe(false)
			expect(apiRequestManager.didRejectTool).toBe(false)
			expect(apiRequestManager.didAlreadyUseTool).toBe(false)
			expect(apiRequestManager.didToolFailInCurrentTurn).toBe(false)
			expect(apiRequestManager.presentAssistantMessageLocked).toBe(false)
			expect(apiRequestManager.presentAssistantMessageHasPendingUpdates).toBe(false)
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

			vi.useFakeTimers()

			const promise = apiRequestManager.backoffAndAnnounce(0, {})

			await vi.advanceTimersByTimeAsync(1000)
			mockStateManager.abort = true

			await expect(promise).rejects.toThrow("Aborted during retry countdown")

			vi.useRealTimers()
		})

		it("should handle missing provider", async () => {
			mockStateManager.providerRef!.deref = vi.fn().mockReturnValue(null)

			await expect(apiRequestManager.backoffAndAnnounce(0, {})).resolves.not.toThrow()
		})
	})

	describe("streaming state management", () => {
		it("should track streaming state correctly", () => {
			expect(apiRequestManager.isStreaming).toBe(false)
			apiRequestManager.isStreaming = true
			expect(apiRequestManager.isStreaming).toBe(true)
		})

		it("should track assistant message content", () => {
		const content: TextContent[] = [{ type: "text", content: "test", partial: false }]
		apiRequestManager.assistantMessageContent = content
		expect(apiRequestManager.assistantMessageContent).toEqual(content)
	})

	it("should track user message content", () => {
		const content: TextContent[] = [{ type: "text", content: "user input", partial: false }]
		apiRequestManager.userMessageContent = content
		expect(apiRequestManager.userMessageContent).toEqual(content)
	})

		it("should track tool usage state", () => {
			expect(apiRequestManager.didRejectTool).toBe(false)
			apiRequestManager.didRejectTool = true
			expect(apiRequestManager.didRejectTool).toBe(true)

			expect(apiRequestManager.didAlreadyUseTool).toBe(false)
			apiRequestManager.didAlreadyUseTool = true
			expect(apiRequestManager.didAlreadyUseTool).toBe(true)

			expect(apiRequestManager.didToolFailInCurrentTurn).toBe(false)
			apiRequestManager.didToolFailInCurrentTurn = true
			expect(apiRequestManager.didToolFailInCurrentTurn).toBe(true)
		})
	})
})
