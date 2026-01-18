import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as fs from "fs/promises"
import * as path from "path"
import { readApiMessages, saveApiMessages } from "../apiMessages"
import {
	ApiMessageReadError,
	ApiMessageSaveError,
	ApiMessageParseError,
	ApiMessageValidationError,
} from "../errors/ApiMessageErrors"
import type { ApiMessage } from "../types/ApiMessage"

// Mock dependencies
vi.mock("fs/promises")

// Mock the modules
vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn(),
}))
vi.mock("../../../utils/storage", () => ({
	getTaskDirectoryPath: vi.fn((_, taskId) => `/storage/${taskId}`),
}))
vi.mock("../../../utils/safeWriteJson", () => ({
	safeWriteJson: vi.fn() as any,
}))

describe("readApiMessages", () => {
	const taskId = "test-task-123"
	const globalStoragePath = "/test/storage"
	const taskDir = `/storage/${taskId}`
	const filePath = path.join(taskDir, "api_conversation_history.json")
	const oldPath = path.join(taskDir, "claude_messages.json")

	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("should return empty array when file does not exist", async () => {
		const { fileExistsAtPath } = await import("../../../utils/fs")
		vi.mocked(fileExistsAtPath).mockResolvedValue(false)

		const result = await readApiMessages({ taskId, globalStoragePath })

		expect(result).toEqual([])
	})

	it("should read and parse messages from file", async () => {
		const { fileExistsAtPath } = await import("../../../utils/fs")
		const mockMessages: ApiMessage[] = [
			{
				role: "user",
				content: [
					{
						type: "text",
						text: "Hello",
					},
				],
			},
			{
				role: "assistant",
				content: [
					{
						type: "text",
						text: "Hi there!",
					},
				],
			},
		]

		vi.mocked(fileExistsAtPath).mockResolvedValue(true)
		vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockMessages))

		const result = await readApiMessages({ taskId, globalStoragePath })

		expect(result).toEqual(mockMessages)
		expect(fs.readFile).toHaveBeenCalledWith(filePath, "utf8")
	})

	it("should migrate from old file format", async () => {
		const { fileExistsAtPath } = await import("../../../utils/fs")
		const mockMessages: ApiMessage[] = [
			{
				role: "user",
				content: [
					{
						type: "text",
						text: "Old format message",
					},
				],
			},
		]

		vi.mocked(fileExistsAtPath)
			.mockResolvedValueOnce(false) // New file doesn't exist
			.mockResolvedValueOnce(true) // Old file exists
		vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockMessages))
		
		// Mock fs.unlink - add it to the mocked module
		;(fs as any).unlink = vi.fn().mockResolvedValue(undefined)

		const result = await readApiMessages({ taskId, globalStoragePath })

		expect(result).toEqual(mockMessages)
		expect((fs as any).unlink).toHaveBeenCalledWith(oldPath)
	})

	it("should throw ApiMessageReadError when file read fails", async () => {
		const { fileExistsAtPath } = await import("../../../utils/fs")
		vi.mocked(fileExistsAtPath).mockResolvedValue(true)
		vi.mocked(fs.readFile).mockRejectedValue(new Error("Permission denied"))

		await expect(readApiMessages({ taskId, globalStoragePath })).rejects.toThrow(ApiMessageReadError)
	})

	it("should throw ApiMessageParseError when JSON parsing fails", async () => {
		const { fileExistsAtPath } = await import("../../../utils/fs")
		vi.mocked(fileExistsAtPath).mockResolvedValue(true)
		vi.mocked(fs.readFile).mockResolvedValue("invalid json")

		await expect(readApiMessages({ taskId, globalStoragePath })).rejects.toThrow(ApiMessageParseError)
	})

	it("should accept messages with reasoning type", async () => {
		const { fileExistsAtPath } = await import("../../../utils/fs")
		const reasoningMessage: ApiMessage = {
			role: "assistant",
			content: [
				{
					type: "text",
					text: "Assistant response",
				},
			],
			type: "reasoning",
			encrypted_content: "encrypted",
			summary: [{ type: "text", content: "summary", timestamp: 1234567890 }],
		}

		vi.mocked(fileExistsAtPath).mockResolvedValue(true)
		vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify([reasoningMessage]))

		const result = await readApiMessages({ taskId, globalStoragePath })

		expect(result).toHaveLength(1)
		expect(result[0].type).toBe("reasoning")
	})

	it("should accept messages with checkpoint metadata", async () => {
		const { fileExistsAtPath } = await import("../../../utils/fs")
		const checkpointMessage: ApiMessage = {
			role: "user",
			content: [
				{
					type: "text",
					text: "Checkpoint",
				},
			],
			ts: 1234567890,
			conversationIndex: 1,
			checkpointMetadata: {
				isCheckpoint: true,
				requestIndex: 1,
				toolProtocol: "xml",
				contextTokens: 1000,
			},
		}

		vi.mocked(fileExistsAtPath).mockResolvedValue(true)
		vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify([checkpointMessage]))

		const result = await readApiMessages({ taskId, globalStoragePath })

		expect(result).toHaveLength(1)
		expect(result[0].checkpointMetadata).toBeDefined()
		expect(result[0].checkpointMetadata?.isCheckpoint).toBe(true)
	})

	it("should accept messages with condense metadata", async () => {
		const { fileExistsAtPath } = await import("../../../utils/fs")
		const condenseMessage: ApiMessage = {
			role: "user",
			content: [
				{
					type: "text",
					text: "Condensed message",
				},
			],
			condenseId: "condense-123",
			condenseParent: "parent-456",
		}

		vi.mocked(fileExistsAtPath).mockResolvedValue(true)
		vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify([condenseMessage]))

		const result = await readApiMessages({ taskId, globalStoragePath })

		expect(result).toHaveLength(1)
		expect(result[0].condenseId).toBe("condense-123")
		expect(result[0].condenseParent).toBe("parent-456")
	})

	it("should accept messages with truncation metadata", async () => {
		const { fileExistsAtPath } = await import("../../../utils/fs")
		const truncationMessage: ApiMessage = {
			role: "user",
			content: [
				{
					type: "text",
					text: "Truncated message",
				},
			],
			truncationId: "truncation-123",
			truncationParent: "parent-456",
			isTruncationMarker: true,
		}

		vi.mocked(fileExistsAtPath).mockResolvedValue(true)
		vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify([truncationMessage]))

		const result = await readApiMessages({ taskId, globalStoragePath })

		expect(result).toHaveLength(1)
		expect(result[0].truncationId).toBe("truncation-123")
		expect(result[0].isTruncationMarker).toBe(true)
	})
})

describe("saveApiMessages", () => {
	const taskId = "test-task-123"
	const globalStoragePath = "/test/storage"
	const taskDir = `/storage/${taskId}`
	const filePath = path.join(taskDir, "api_conversation_history.json")

	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("should save messages to file", async () => {
		const { safeWriteJson } = await import("../../../utils/safeWriteJson")
		const mockMessages: ApiMessage[] = [
			{
				role: "user",
				content: [
					{
						type: "text",
						text: "Hello",
					},
				],
			},
		]

		await saveApiMessages({ messages: mockMessages, taskId, globalStoragePath })

		expect(safeWriteJson).toHaveBeenCalledWith(filePath, mockMessages)
	})

	it("should validate and sanitize messages before saving", async () => {
		const { safeWriteJson } = await import("../../../utils/safeWriteJson")
		const mockMessages: ApiMessage[] = [
			{
				role: "user",
				content: [
					{
						type: "text",
						text: "Hello",
					},
				],
			},
		]

		await saveApiMessages({ messages: mockMessages, taskId, globalStoragePath })

		expect(safeWriteJson).toHaveBeenCalled()
		const savedMessages = (safeWriteJson as any).mock.calls[0][1]
		expect(savedMessages).toHaveLength(1)
		expect(savedMessages[0].role).toBe("user")
	})

	it("should throw ApiMessageSaveError when save fails", async () => {
		const { safeWriteJson } = await import("../../../utils/safeWriteJson")
		const mockMessages: ApiMessage[] = [
			{
				role: "user",
				content: [
					{
						type: "text",
						text: "Hello",
					},
				],
			},
		]

		vi.mocked(safeWriteJson).mockRejectedValue(new Error("Disk full"))

		await expect(saveApiMessages({ messages: mockMessages, taskId, globalStoragePath })).rejects.toThrow(
			ApiMessageSaveError,
		)
	})

	it("should save empty array when no messages provided", async () => {
		const { safeWriteJson } = await import("../../../utils/safeWriteJson")

		await saveApiMessages({ messages: [], taskId, globalStoragePath })

		expect(safeWriteJson).toHaveBeenCalledWith(filePath, [])
	})

	it("should handle messages with all metadata fields", async () => {
		const { safeWriteJson } = await import("../../../utils/safeWriteJson")
		const complexMessage: ApiMessage = {
			role: "user",
			content: [
				{
					type: "text",
					text: "Complex message",
				},
			],
			ts: 1234567890,
			isSummary: true,
			id: "msg-123",
			type: "reasoning",
			summary: [{ type: "text", content: "summary", timestamp: 1234567890 }],
			encrypted_content: "encrypted",
			text: "text content",
			reasoning_details: [],
			condenseId: "condense-123",
			condenseParent: "parent-456",
			truncationId: "truncation-789",
			truncationParent: "parent-012",
			isTruncationMarker: false,
			conversationIndex: 5,
			checkpointMetadata: {
				isCheckpoint: true,
				requestIndex: 1,
				checkpointHash: "hash-123",
				toolProtocol: "xml",
				contextTokens: 1000,
			},
		}

		await saveApiMessages({ messages: [complexMessage], taskId, globalStoragePath })

		expect(safeWriteJson).toHaveBeenCalled()
		const savedMessages = (safeWriteJson as any).mock.calls[0][1]
		expect(savedMessages).toHaveLength(1)
		expect(savedMessages[0].id).toBe("msg-123")
		expect(savedMessages[0].checkpointMetadata).toBeDefined()
	})
})