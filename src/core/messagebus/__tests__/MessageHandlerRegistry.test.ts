import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { MessageHandlerRegistry } from "../MessageHandlerRegistry"
import { MessageBusServer } from "../MessageBusServer"
import type { ClineProvider } from "../../webview/ClineProvider"

describe("MessageHandlerRegistry", () => {
	let messageHandlerRegistry: MessageHandlerRegistry
	let messageBusServer: MessageBusServer
	let mockProvider: any
	let mockOutputChannel: any

	beforeEach(() => {
		mockOutputChannel = {
			appendLine: vi.fn(),
			show: vi.fn(),
			clear: vi.fn(),
			dispose: vi.fn(),
		}
		
		mockProvider = {
			createTask: vi.fn(),
			cancelTask: vi.fn(),
			getCurrentTask: vi.fn(),
			getState: vi.fn(),
			postStateToWebview: vi.fn(),
			postMessageToWebview: vi.fn(),
			contextProxy: {
				setValue: vi.fn(),
				getValue: vi.fn(),
			},
			getMcpHub: vi.fn(),
			log: vi.fn(),
		}
		
		messageBusServer = new MessageBusServer(mockOutputChannel, {})
		messageHandlerRegistry = new MessageHandlerRegistry(messageBusServer, mockProvider, mockOutputChannel)
	})

	afterEach(() => {
		messageHandlerRegistry.dispose?.()
		messageBusServer.dispose()
	})

	describe("constructor", () => {
		it("should initialize with message bus and provider", () => {
			expect(messageHandlerRegistry).toBeDefined()
		})
	})

	describe("registerAll", () => {
		it("should register all message handlers", () => {
			const stats = messageBusServer.getStats()
			expect(stats.handlers).toBeGreaterThan(0)
		})
	})
})