import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { MessageManager } from "../MessageManager"
import type { ClineMessage } from "@shared/types"
import type { ApiMessage } from "@core/task-persistence/types/ApiMessage"
import type { TaskStateManager } from "../../core/TaskStateManager"
import type { IndexManager } from "../../core/IndexManager"

describe("MessageManager", () => {
	let messageManager: MessageManager
	let mockTask: any
	let mockProvider: any
	let mockEventBus: any
	let mockStateManager: TaskStateManager
	let mockIndexManager: IndexManager

	beforeEach(() => {
		mockProvider = {
			log: vi.fn(),
		}

		mockEventBus = {
			emit: vi.fn(),
		}

		mockTask = {
			taskId: "test-task-id",
			saveClineMessages: vi.fn().mockResolvedValue(undefined),
		}

		mockStateManager = {
			getProvider: vi.fn().mockReturnValue(mockProvider),
			lastMessageTs: 0,
		} as unknown as TaskStateManager

		mockIndexManager = {
			initialize: vi.fn().mockResolvedValue(undefined),
			startNewApiRequest: vi.fn().mockResolvedValue(1),
			getCurrentRequestIndex: vi.fn().mockReturnValue(1),
			setCurrentRequestIndex: vi.fn(),
			endCurrentApiRequest: vi.fn(),
			getConversationIndexCounter: vi.fn().mockReturnValue(0),
			setConversationIndexCounter: vi.fn(),
		} as unknown as IndexManager

		messageManager = new MessageManager({
			stateManager: mockStateManager,
			taskId: "test-task-id",
			globalStoragePath: "/mock/storage/path",
			eventBus: mockEventBus,
			task: mockTask,
			indexManager: mockIndexManager,
		})

		vi.spyOn(messageManager as any, "saveApiConversationHistory").mockResolvedValue(undefined)
		vi.spyOn(messageManager as any, "saveClineMessages").mockResolvedValue(undefined)
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("Initialization", () => {
		it("should initialize successfully", async () => {
			await messageManager.initialize()
			expect(mockIndexManager.initialize).toHaveBeenCalled()
		})

		it("should initialize with empty messages", async () => {
			await messageManager.initialize()
			expect(messageManager.getClineMessages()).toEqual([])
			expect(messageManager.getApiConversationHistory()).toEqual([])
		})

		it("should have correct taskId", async () => {
			await messageManager.initialize()
			expect((messageManager as any).taskId).toBe("test-task-id")
		})
	})

	describe("Cline Messages", () => {
		beforeEach(async () => {
			await messageManager.initialize()
		})

		it("should add cline message", async () => {
			const message: ClineMessage = {
				type: "say",
				say: "text",
				ts: Date.now(),
				text: "Hello world",
			}

			await messageManager.addToClineMessages(message, undefined, undefined)

			const messages = messageManager.getClineMessages()
			expect(messages).toHaveLength(1)
			expect(messages[0]).toEqual(message)
		})

		it("should overwrite cline messages", async () => {
			const messages: ClineMessage[] = [
				{
					type: "say",
					say: "text",
					ts: Date.now(),
					text: "First message",
				},
				{
					type: "say",
					say: "text",
					ts: Date.now() + 1000,
					text: "Second message",
				},
			]

			await messageManager.overwriteClineMessages(messages, undefined, undefined)

			const result = messageManager.getClineMessages()
			expect(result).toHaveLength(2)
			expect(result[0].text).toBe("First message")
			expect(result[1].text).toBe("Second message")
		})

		it("should update cline message by timestamp", async () => {
			const timestamp = Date.now()
			const message: ClineMessage = {
				type: "say",
				say: "text",
				ts: timestamp,
				text: "Original",
			}

			await messageManager.addToClineMessages(message, undefined, undefined)

			const updatedMessage: ClineMessage = {
				...message,
				text: "Updated",
			}

			await messageManager.updateClineMessage(updatedMessage, undefined)

			const messages = messageManager.getClineMessages()
			expect(messages[0].text).toBe("Updated")
		})

		it("should not update message if timestamp not found", async () => {
			const message: ClineMessage = {
				type: "say",
				say: "text",
				ts: Date.now(),
				text: "Original",
			}

			await messageManager.addToClineMessages(message, undefined, undefined)

			const nonExistentMessage: ClineMessage = {
				type: "say",
				say: "text",
				ts: Date.now() + 10000,
				text: "Non-existent",
			}

			await messageManager.updateClineMessage(nonExistentMessage, undefined)

			const messages = messageManager.getClineMessages()
			expect(messages).toHaveLength(1)
			expect(messages[0].text).toBe("Original")
		})
	})

	describe("API Messages", () => {
		beforeEach(async () => {
			await messageManager.initialize()
		})

		it("should add api message", async () => {
			const message: ApiMessage = {
				role: "user",
				content: [{ type: "text", text: "Test message" }],
				ts: Date.now(),
			}

			await messageManager.addToApiConversationHistory(message)

			const messages = messageManager.getApiConversationHistory()
			expect(messages).toHaveLength(1)
			expect(messages[0].role).toBe("user")
		})

		it("should overwrite api conversation history", async () => {
			const messages: ApiMessage[] = [
				{
					role: "user",
					content: [{ type: "text", text: "First" }],
					ts: Date.now(),
				},
				{
					role: "assistant",
					content: [{ type: "text", text: "Second" }],
					ts: Date.now() + 1000,
				},
			]

			await messageManager.overwriteApiConversationHistory(messages)

			const result = messageManager.getApiConversationHistory()
			expect(result).toHaveLength(2)
			expect(result[0].role).toBe("user")
			expect(result[1].role).toBe("assistant")
		})
	})

	describe("Event Emission", () => {
		beforeEach(async () => {
			await messageManager.initialize()
		})

		it("should emit event when adding cline message", async () => {
			const message: ClineMessage = {
				type: "say",
				say: "text",
				ts: Date.now(),
				text: "Test",
			}

			await messageManager.addToClineMessages(message, undefined, undefined)

			expect(mockEventBus.emit).toHaveBeenCalledWith("taskUserMessage", "test-task-id")
		})

		it("should emit event when updating cline message", async () => {
			const timestamp = Date.now()
			const message: ClineMessage = {
				type: "say",
				say: "text",
				ts: timestamp,
				text: "Original",
			}

			await messageManager.addToClineMessages(message, undefined, undefined)

			const updatedMessage: ClineMessage = {
				...message,
				text: "Updated",
			}

			await messageManager.updateClineMessage(updatedMessage, undefined)

			expect(mockEventBus.emit).toHaveBeenCalledWith("taskUserMessage", "test-task-id")
		})
	})

	describe("Message Indexing", () => {
		beforeEach(async () => {
			await messageManager.initialize()
		})

		it("should find message index by timestamp", () => {
			const timestamp = Date.now()
			const message: ClineMessage = {
				type: "say",
				say: "text",
				ts: timestamp,
				text: "Test",
			}

			;(messageManager as any).clineMessages.push(message)

			const index = (messageManager as any).findMessageIndexByTimestamp(timestamp)
			expect(index).toBe(0)
		})

		it("should return -1 for non-existent timestamp", () => {
			const index = (messageManager as any).findMessageIndexByTimestamp(123456789)
			expect(index).toBe(-1)
		})
	})
})
