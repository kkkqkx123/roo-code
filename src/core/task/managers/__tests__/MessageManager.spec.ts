import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { MessageManager } from "../MessageManager"
import type { TaskStateManager } from "../TaskStateManager"
import type { ClineMessage } from "@roo-code/types"
import type { ApiMessage } from "../../../task-persistence/apiMessages"

vi.mock("../../tools/UpdateTodoListTool", () => ({
	restoreTodoListForTask: vi.fn(),
}))

vi.mock("../../task-persistence", () => ({
	readApiMessages: vi.fn(),
	saveApiMessages: vi.fn(),
	readTaskMessages: vi.fn(),
	saveTaskMessages: vi.fn(),
}))

describe("MessageManager", () => {
	let mockStateManager: Partial<TaskStateManager>
	let messageManager: MessageManager

	beforeEach(() => {
		mockStateManager = {
			taskId: "task-1",
			lastMessageTs: undefined,
			getProvider: vi.fn(),
		} as any

		messageManager = new MessageManager({
			stateManager: mockStateManager as TaskStateManager,
			taskId: "task-1",
			globalStoragePath: "/tmp/storage",
		})
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(messageManager.apiConversationHistory).toEqual([])
			expect(messageManager.clineMessages).toEqual([])
		})
	})

	describe("addToApiConversationHistory", () => {
		it("should add message with timestamp", async () => {
			const message: ApiMessage = {
				role: "user",
				content: "Hello",
			}

			await messageManager.addToApiConversationHistory(message)

			expect(messageManager.apiConversationHistory).toHaveLength(1)
			expect(messageManager.apiConversationHistory[0].role).toBe("user")
			expect(messageManager.apiConversationHistory[0].ts).toBeDefined()
		})

		it("should handle reasoning details for assistant messages", async () => {
			const message: ApiMessage = {
				role: "assistant",
				content: [
					{ type: "text", text: "Response" },
					{ type: "thinking", thinking: "Thinking", signature: "test-signature" },
				],
			}

			await messageManager.addToApiConversationHistory(message)

			expect(messageManager.apiConversationHistory[0].content).toEqual([
				{ type: "text", text: "Response" },
				{ type: "thinking", thinking: "Thinking", signature: "test-signature" },
			])
		})

		it("should add reasoning details if provided", async () => {
			const message: ApiMessage = {
				role: "assistant",
				content: [
					{ type: "text", text: "Response" },
					{ type: "thought_signature", signature: "test-signature" },
				],
			} as any

			await messageManager.addToApiConversationHistory(message, "Thinking")

			expect(messageManager.apiConversationHistory[0].content).toHaveLength(3)
			expect(messageManager.apiConversationHistory[0].content[2]).toEqual({
				type: "reasoning_details",
				reasoning: "Thinking",
				signature: { type: "thought_signature", signature: "test-signature" },
			})
		})
	})

	describe("overwriteApiConversationHistory", () => {
		it("should overwrite existing history", async () => {
			const newHistory: ApiMessage[] = [
				{ role: "user", content: "New message" },
			]

			await messageManager.overwriteApiConversationHistory(newHistory)

			expect(messageManager.apiConversationHistory).toEqual(newHistory)
		})
	})

	describe("addToClineMessages", () => {
		it("should add message to cline messages", async () => {
			const message: ClineMessage = {
				type: "say",
				say: "text",
				text: "Hello",
				ts: Date.now(),
			}

			await messageManager.addToClineMessages(message)

			expect(messageManager.clineMessages).toHaveLength(1)
			expect(messageManager.clineMessages[0]).toEqual(message)
		})
	})

	describe("overwriteClineMessages", () => {
		it("should overwrite cline messages and update lastMessageTs", async () => {
			const newMessages: ClineMessage[] = [
				{ type: "say", say: "text", text: "Message 1", ts: 1000 },
				{ type: "say", say: "text", text: "Message 2", ts: 2000 },
			]

			await messageManager.overwriteClineMessages(newMessages)

			expect(messageManager.clineMessages).toEqual(newMessages)
			expect(mockStateManager.lastMessageTs).toBe(2000)
		})
	})

	describe("updateClineMessage", () => {
		it("should update message by timestamp", async () => {
			const ts = Date.now()
			messageManager.clineMessages = [
				{ type: "say", say: "text", text: "Original", ts },
			]

			const updatedMessage: ClineMessage = {
				type: "say",
				say: "text",
				text: "Updated",
				ts,
			}

			await messageManager.updateClineMessage(updatedMessage)

			expect(messageManager.clineMessages[0].text).toBe("Updated")
		})

		it("should not update if message not found", async () => {
			messageManager.clineMessages = [
				{ type: "say", say: "text", text: "Message", ts: 1000 },
			]

			const updatedMessage: ClineMessage = {
				type: "say",
				say: "text",
				text: "Updated",
				ts: 2000,
			}

			await messageManager.updateClineMessage(updatedMessage)

			expect(messageManager.clineMessages[0].text).toBe("Message")
		})
	})

	describe("findMessageByTimestamp", () => {
		it("should find message by timestamp", () => {
			const ts = Date.now()
			messageManager.clineMessages = [
				{ type: "say", say: "text", text: "Message 1", ts: ts - 1000 },
				{ type: "say", say: "text", text: "Message 2", ts },
			]

			const found = messageManager.findMessageByTimestamp(ts)

			expect(found?.text).toBe("Message 2")
		})

		it("should return undefined if not found", () => {
			const found = messageManager.findMessageByTimestamp(999999)

			expect(found).toBeUndefined()
		})
	})

	describe("findMessageIndexByTimestamp", () => {
		it("should find message index by timestamp", () => {
			const ts = Date.now()
			messageManager.clineMessages = [
				{ type: "say", say: "text", text: "Message 1", ts: ts - 1000 },
				{ type: "say", say: "text", text: "Message 2", ts },
			]

			const index = messageManager.findMessageIndexByTimestamp(ts)

			expect(index).toBe(1)
		})

		it("should return -1 if not found", () => {
			const index = messageManager.findMessageIndexByTimestamp(999999)

			expect(index).toBe(-1)
		})
	})

	describe("getApiConversationHistory", () => {
		it("should return api conversation history", () => {
			messageManager.apiConversationHistory = [
				{ role: "user", content: "Hello" },
			]

			const history = messageManager.getApiConversationHistory()

			expect(history).toEqual(messageManager.apiConversationHistory)
		})
	})

	describe("getClineMessages", () => {
		it("should return cline messages", () => {
			messageManager.clineMessages = [
				{ type: "say", say: "text", text: "Message", ts: 1000 },
			]

			const messages = messageManager.getClineMessages()

			expect(messages).toEqual(messageManager.clineMessages)
		})
	})

	describe("getLastApiReqIndex", () => {
		it("should find last api_req_started message index", () => {
			messageManager.clineMessages = [
				{ type: "say", say: "text", text: "Message 1", ts: 1000 },
				{ type: "say", say: "api_req_started", text: "{}", ts: 2000 },
				{ type: "say", say: "text", text: "Message 2", ts: 3000 },
				{ type: "say", say: "api_req_started", text: "{}", ts: 4000 },
			]

			const index = messageManager.getLastApiReqIndex()

			expect(index).toBe(3)
		})

		it("should return -1 if not found", () => {
			messageManager.clineMessages = [
				{ type: "say", say: "text", text: "Message", ts: 1000 },
			]

			const index = messageManager.getLastApiReqIndex()

			expect(index).toBe(-1)
		})
	})

	describe("flushPendingToolResultsToHistory", () => {
		it("should save if there are tool results", async () => {
			messageManager.apiConversationHistory = [
				{
					role: "user",
					content: [
						{ type: "tool_result", tool_use_id: "123", content: "Result" },
					],
				},
			]

			await messageManager.flushPendingToolResultsToHistory()

			expect(messageManager.apiConversationHistory).toHaveLength(1)
		})

		it("should return early if no history", async () => {
			await messageManager.flushPendingToolResultsToHistory()

			expect(messageManager.apiConversationHistory).toHaveLength(0)
		})
	})

	describe("postToWebview", () => {
		it("should post state to webview if provider exists", async () => {
			const mockProvider = {
				postStateToWebview: vi.fn().mockResolvedValue(undefined),
			}

			mockStateManager.getProvider = vi.fn().mockReturnValue(mockProvider)

			await messageManager.postToWebview()

			expect(mockProvider.postStateToWebview).toHaveBeenCalled()
		})

		it("should not post if provider is undefined", async () => {
			mockStateManager.getProvider = vi.fn().mockReturnValue(undefined)

			await messageManager.postToWebview()

			expect(mockStateManager.getProvider).toHaveBeenCalled()
		})
	})
})
