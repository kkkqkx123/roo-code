import { describe, it, expect, vi, beforeEach } from "vitest"
import { BaseProvider, TokenValidationError } from "../base-provider"
import { Anthropic } from "@anthropic-ai/sdk"
import type { ApiStream } from "../../transform/stream"

class TestProvider extends BaseProvider {
	async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: any,
	): ApiStream {
		throw new Error("Method not implemented.")
	}

	getModel() {
		return {
			id: "test-model",
			info: {
				maxTokens: 4096,
				contextWindow: 200000,
				supportsImages: false,
				supportsPromptCache: false,
				inputPrice: 1,
				outputPrice: 2,
			},
		}
	}
}

describe("BaseProvider Token Validation", () => {
	let provider: TestProvider

	beforeEach(() => {
		provider = new TestProvider()
	})

	describe("isValidTokenCount", () => {
		it("should return true for positive token counts", () => {
			expect(provider["isValidTokenCount"](1)).toBe(true)
			expect(provider["isValidTokenCount"](100)).toBe(true)
			expect(provider["isValidTokenCount"](9999)).toBe(true)
		})

		it("should return false for zero", () => {
			expect(provider["isValidTokenCount"](0)).toBe(false)
		})

		it("should return false for undefined", () => {
			expect(provider["isValidTokenCount"](undefined)).toBe(false)
		})

		it("should return false for negative numbers", () => {
			expect(provider["isValidTokenCount"](-1)).toBe(false)
			expect(provider["isValidTokenCount"](-100)).toBe(false)
		})
	})

	describe("validateAndCorrectTokenCounts", () => {
		const validInputContent: Anthropic.Messages.ContentBlockParam[] = [
			{ type: "text", text: "Test input content" },
		]
		const validOutputContent: Anthropic.Messages.ContentBlockParam[] = [
			{ type: "text", text: "Test output content" },
		]

		it("should return valid token counts without fallback when both are valid", async () => {
			const result = await provider.validateAndCorrectTokenCounts(
				100,
				50,
				validInputContent,
				validOutputContent,
				{ logFallback: false },
			)

			expect(result.inputTokens).toBe(100)
			expect(result.outputTokens).toBe(50)
			expect(result.didFallback).toBe(false)
		})

		it("should trigger fallback when input tokens are 0", async () => {
			const result = await provider.validateAndCorrectTokenCounts(
				0,
				50,
				validInputContent,
				validOutputContent,
				{ logFallback: false },
			)

			expect(result.inputTokens).toBeGreaterThan(0)
			expect(result.outputTokens).toBe(50)
			expect(result.didFallback).toBe(true)
		})

		it("should trigger fallback when input tokens are undefined", async () => {
			const result = await provider.validateAndCorrectTokenCounts(
				undefined,
				50,
				validInputContent,
				validOutputContent,
				{ logFallback: false },
			)

			expect(result.inputTokens).toBeGreaterThan(0)
			expect(result.outputTokens).toBe(50)
			expect(result.didFallback).toBe(true)
		})

		it("should trigger fallback when output tokens are 0", async () => {
			const result = await provider.validateAndCorrectTokenCounts(
				100,
				0,
				validInputContent,
				validOutputContent,
				{ logFallback: false },
			)

			expect(result.inputTokens).toBe(100)
			expect(result.outputTokens).toBeGreaterThan(0)
			expect(result.didFallback).toBe(true)
		})

		it("should trigger fallback when output tokens are undefined", async () => {
			const result = await provider.validateAndCorrectTokenCounts(
				100,
				undefined,
				validInputContent,
				validOutputContent,
				{ logFallback: false },
			)

			expect(result.inputTokens).toBe(100)
			expect(result.outputTokens).toBeGreaterThan(0)
			expect(result.didFallback).toBe(true)
		})

		it("should trigger fallback when both token counts are invalid", async () => {
			const result = await provider.validateAndCorrectTokenCounts(
				0,
				undefined,
				validInputContent,
				validOutputContent,
				{ logFallback: false },
			)

			expect(result.inputTokens).toBeGreaterThan(0)
			expect(result.outputTokens).toBeGreaterThan(0)
			expect(result.didFallback).toBe(true)
		})

		it("should log fallback when logFallback is true", async () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			await provider.validateAndCorrectTokenCounts(
				0,
				0,
				validInputContent,
				validOutputContent,
				{ logFallback: true },
			)

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining("[BaseProvider] Invalid token counts detected"),
			)
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining("[BaseProvider] Token count fallback to tiktoken"),
			)

			consoleWarnSpy.mockRestore()
		})

		it("should not log fallback when logFallback is false", async () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			await provider.validateAndCorrectTokenCounts(
				0,
				0,
				validInputContent,
				validOutputContent,
				{ logFallback: false },
			)

			expect(consoleWarnSpy).not.toHaveBeenCalled()

			consoleWarnSpy.mockRestore()
		})
	})

	describe("estimateTokensWithTiktoken", () => {
		const validInputContent: Anthropic.Messages.ContentBlockParam[] = [
			{ type: "text", text: "Test input content" },
		]
		const validOutputContent: Anthropic.Messages.ContentBlockParam[] = [
			{ type: "text", text: "Test output content" },
		]

		it("should estimate tokens for input and output content", async () => {
			const result = await provider.estimateTokensWithTiktoken(
				validInputContent,
				validOutputContent,
				{ logFallback: false },
			)

			expect(result.inputTokens).toBeGreaterThan(0)
			expect(result.outputTokens).toBeGreaterThan(0)
		})

		it("should return 0 for empty content", async () => {
			const emptyContent: Anthropic.Messages.ContentBlockParam[] = []

			const result = await provider.estimateTokensWithTiktoken(
				emptyContent,
				emptyContent,
				{ logFallback: false },
			)

			expect(result.inputTokens).toBe(0)
			expect(result.outputTokens).toBe(0)
		})

		it("should log fallback when logFallback is true", async () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			await provider.estimateTokensWithTiktoken(
				validInputContent,
				validOutputContent,
				{ logFallback: true },
			)

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining("[BaseProvider] Token count fallback to tiktoken"),
			)

			consoleWarnSpy.mockRestore()
		})
	})

	describe("TokenValidationError", () => {
		it("should create error with message", () => {
			const error = new TokenValidationError("Test error")
			expect(error.message).toBe("Test error")
			expect(error.name).toBe("TokenValidationError")
		})

		it("should store original token counts", () => {
			const error = new TokenValidationError("Test error", 100, 50)
			expect(error.originalInputTokens).toBe(100)
			expect(error.originalOutputTokens).toBe(50)
		})
	})
})
