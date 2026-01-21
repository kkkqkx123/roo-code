// npx vitest src/core/context/__tests__/getKeepMessagesWithToolBlocks.spec.ts

import type { Mock } from "vitest"

import { Anthropic } from "@anthropic-ai/sdk"

import { ApiHandler } from "../../../api"
import { ApiMessage } from "../../task-persistence"
import { maybeRemoveImageBlocks } from "../../../api/transform/image-cleaning"
import {
	getKeepMessagesWithToolBlocks,
	N_MESSAGES_TO_KEEP,
} from "../"

vi.mock("../../../api/transform/image-cleaning", () => ({
	maybeRemoveImageBlocks: vi.fn((messages: ApiMessage[], _apiHandler: ApiHandler) => [...messages]),
}))

describe("getKeepMessagesWithToolBlocks", () => {
	it("should return keepMessages without tool blocks when no tool_result blocks in first kept message", () => {
		const messages: ApiMessage[] = [
			{ role: "user", content: "Hello", ts: 1 },
			{ role: "assistant", content: "Hi there", ts: 2 },
			{ role: "user", content: "How are you?", ts: 3 },
			{ role: "assistant", content: "I'm good", ts: 4 },
			{ role: "user", content: "What's new?", ts: 5 },
		]

		const result = getKeepMessagesWithToolBlocks(messages, 3)

		expect(result.keepMessages).toHaveLength(3)
		expect(result.toolUseBlocksToPreserve).toHaveLength(0)
	})

	it("should return all messages when messages.length <= keepCount", () => {
		const messages: ApiMessage[] = [
			{ role: "user", content: "Hello", ts: 1 },
			{ role: "assistant", content: "Hi there", ts: 2 },
		]

		const result = getKeepMessagesWithToolBlocks(messages, 3)

		expect(result.keepMessages).toEqual(messages)
		expect(result.toolUseBlocksToPreserve).toHaveLength(0)
	})

	it("should preserve tool_use blocks when first kept message has tool_result blocks", () => {
		const toolUseBlock = {
			type: "tool_use" as const,
			id: "toolu_123",
			name: "read_file",
			input: { path: "test.txt" },
		}
		const toolResultBlock = {
			type: "tool_result" as const,
			tool_use_id: "toolu_123",
			content: "file contents",
		}

		const messages: ApiMessage[] = [
			{ role: "user", content: "Hello", ts: 1 },
			{ role: "assistant", content: "Let me read that file", ts: 2 },
			{ role: "user", content: "Please continue", ts: 3 },
			{
				role: "assistant",
				content: [{ type: "text" as const, text: "Reading file..." }, toolUseBlock],
				ts: 4,
			},
			{
				role: "user",
				content: [toolResultBlock, { type: "text" as const, text: "Continue" }],
				ts: 5,
			},
			{ role: "assistant", content: "Got it, file says...", ts: 6 },
			{ role: "user", content: "Thanks", ts: 7 },
		]

		const result = getKeepMessagesWithToolBlocks(messages, 3)

		// keepMessages should be last 3 messages
		expect(result.keepMessages).toHaveLength(3)
		expect(result.keepMessages[0].ts).toBe(5)
		expect(result.keepMessages[1].ts).toBe(6)
		expect(result.keepMessages[2].ts).toBe(7)

		// Should preserve of tool_use block from preceding assistant message
		expect(result.toolUseBlocksToPreserve).toHaveLength(1)
		expect(result.toolUseBlocksToPreserve[0]).toEqual(toolUseBlock)
	})

	it("should not preserve tool_use blocks when first kept message is assistant role", () => {
		const toolUseBlock = {
			type: "tool_use" as const,
			id: "toolu_123",
			name: "read_file",
			input: { path: "test.txt" },
		}

		const messages: ApiMessage[] = [
			{ role: "user", content: "Hello", ts: 1 },
			{ role: "assistant", content: "Hi there", ts: 2 },
			{ role: "user", content: "Please read", ts: 3 },
			{
				role: "assistant",
				content: [{ type: "text" as const, text: "Reading..." }, toolUseBlock],
				ts: 4,
			},
			{ role: "user", content: "Continue", ts: 5 },
			{ role: "assistant", content: "Done", ts: 6 },
		]

		const result = getKeepMessagesWithToolBlocks(messages, 3)

		// First kept message is assistant, not user with tool_result
		expect(result.keepMessages).toHaveLength(3)
		expect(result.keepMessages[0].role).toBe("assistant")
		expect(result.toolUseBlocksToPreserve).toHaveLength(0)
	})

	it("should not preserve tool_use blocks when first kept user message has string content", () => {
		const messages: ApiMessage[] = [
			{ role: "user", content: "Hello", ts: 1 },
			{ role: "assistant", content: "Hi there", ts: 2 },
			{ role: "user", content: "How are you?", ts: 3 },
			{ role: "assistant", content: "Good", ts: 4 },
			{ role: "user", content: "Simple text message", ts: 5 }, // String content, not array
			{ role: "assistant", content: "Response", ts: 6 },
			{ role: "user", content: "More text", ts: 7 },
		]

		const result = getKeepMessagesWithToolBlocks(messages, 3)

		expect(result.keepMessages).toHaveLength(3)
		expect(result.toolUseBlocksToPreserve).toHaveLength(0)
	})

	it("should handle multiple tool_use blocks that need to be preserved", () => {
		const toolUseBlock1 = {
			type: "tool_use" as const,
			id: "toolu_123",
			name: "read_file",
			input: { path: "file1.txt" },
		}
		const toolUseBlock2 = {
			type: "tool_use" as const,
			id: "toolu_456",
			name: "read_file",
			input: { path: "file2.txt" },
		}
		const toolResultBlock1 = {
			type: "tool_result" as const,
			tool_use_id: "toolu_123",
			content: "contents 1",
		}
		const toolResultBlock2 = {
			type: "tool_result" as const,
			tool_use_id: "toolu_456",
			content: "contents 2",
		}

		const messages: ApiMessage[] = [
			{ role: "user", content: "Hello", ts: 1 },
			{
				role: "assistant",
				content: [{ type: "text" as const, text: "Reading files..." }, toolUseBlock1, toolUseBlock2],
				ts: 2,
			},
			{
				role: "user",
				content: [toolResultBlock1, toolResultBlock2],
				ts: 3,
			},
			{ role: "assistant", content: "Got both files", ts: 4 },
			{ role: "user", content: "Thanks", ts: 5 },
		]

		const result = getKeepMessagesWithToolBlocks(messages, 3)

		// Should preserve both tool_use blocks
		expect(result.toolUseBlocksToPreserve).toHaveLength(2)
		expect(result.toolUseBlocksToPreserve).toContainEqual(toolUseBlock1)
		expect(result.toolUseBlocksToPreserve).toContainEqual(toolUseBlock2)
	})

	it("should not preserve tool_use blocks when preceding message has no tool_use blocks", () => {
		const toolResultBlock = {
			type: "tool_result" as const,
			tool_use_id: "toolu_123",
			content: "file contents",
		}

		const messages: ApiMessage[] = [
			{ role: "user", content: "Hello", ts: 1 },
			{ role: "assistant", content: "Plain text response", ts: 2 }, // No tool_use blocks
			{
				role: "user",
				content: [toolResultBlock], // Has tool_result but preceding message has no tool_use
				ts: 3,
			},
			{ role: "assistant", content: "Response", ts: 4 },
			{ role: "user", content: "Thanks", ts: 5 },
		]

		const result = getKeepMessagesWithToolBlocks(messages, 3)

		expect(result.keepMessages).toHaveLength(3)
		expect(result.toolUseBlocksToPreserve).toHaveLength(0)
	})

	it("should handle edge case when startIndex - 1 is negative", () => {
		const toolResultBlock = {
			type: "tool_result" as const,
			tool_use_id: "toolu_123",
			content: "file contents",
		}

		// Only 3 messages total, so startIndex = 0 and precedingIndex would be -1
		const messages: ApiMessage[] = [
			{
				role: "user",
				content: [toolResultBlock],
				ts: 1,
			},
			{ role: "assistant", content: "Response", ts: 2 },
			{ role: "user", content: "Thanks", ts: 3 },
		]

		const result = getKeepMessagesWithToolBlocks(messages, 3)

		expect(result.keepMessages).toEqual(messages)
		expect(result.toolUseBlocksToPreserve).toHaveLength(0)
	})
})
