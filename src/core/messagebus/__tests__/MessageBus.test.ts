import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { MessageBus } from "../MessageBus"
import type { ExtensionResponseMessage } from "../MessageTypes"

describe("MessageBus", () => {
	let messageBus: MessageBus
	let mockOutputChannel: any

	beforeEach(() => {
		mockOutputChannel = {
			appendLine: vi.fn(),
			show: vi.fn(),
			clear: vi.fn(),
			dispose: vi.fn(),
		}
		messageBus = new MessageBus(mockOutputChannel)
	})

	afterEach(() => {
		messageBus.dispose()
	})

	describe("register", () => {
		it("should register a handler for a message type", () => {
			const handler = vi.fn()
			messageBus.register("test.message", handler)
			expect(handler).toBeDefined()
		})

		it("should allow multiple handlers for the same message type", () => {
			const handler1 = vi.fn()
			const handler2 = vi.fn()
			messageBus.register("test.message", handler1)
			messageBus.register("test.message", handler2)
			expect(handler1).toBeDefined()
			expect(handler2).toBeDefined()
		})
	})

	describe("unregister", () => {
		it("should unregister a handler", () => {
			const handler = vi.fn()
			const subscription = messageBus.register("test.message", handler)
			subscription.unsubscribe()
			expect(handler).toBeDefined()
		})
	})

	describe("handle", () => {
		it("should handle a message with registered handler", async () => {
			const handler = vi.fn().mockResolvedValue({ type: "test.response" })
			messageBus.register("test.message", handler)
			await messageBus.handle({ type: "test.message" })
			expect(handler).toHaveBeenCalled()
		})

		it("should handle multiple handlers for same message type", async () => {
			const handler1 = vi.fn().mockResolvedValue({ type: "test.response1" })
			const handler2 = vi.fn().mockResolvedValue({ type: "test.response2" })
			messageBus.register("test.message", handler1)
			messageBus.register("test.message", handler2)
			await messageBus.handle({ type: "test.message" })
			expect(handler1).toHaveBeenCalled()
			expect(handler2).toHaveBeenCalled()
		})

		it("should throw error when no handler registered", async () => {
			await expect(messageBus.handle({ type: "test.message" })).rejects.toThrow("No handler for message type: test.message")
		})
	})

	describe("dispose", () => {
		it("should clear all handlers on dispose", () => {
			const handler = vi.fn()
			messageBus.register("test.message", handler)
			messageBus.dispose()
			expect(handler).toBeDefined()
		})
	})
})