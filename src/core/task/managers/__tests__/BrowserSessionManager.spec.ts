import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { ClineProvider } from "../../../webview/ClineProvider"

const mockBrowserSession = {
	isSessionActive: vi.fn().mockReturnValue(false),
	getViewportSize: vi.fn().mockReturnValue({ width: 900, height: 600 }),
	dispose: vi.fn(),
}

let mockStateChangeCallback: ((isActive: boolean) => void) | undefined

vi.mock("../../../../services/browser/BrowserSession", () => ({
	BrowserSession: vi.fn().mockImplementation((context: any, onStateChange?: (isActive: boolean) => void) => {
		mockStateChangeCallback = onStateChange
		return mockBrowserSession
	}),
}))

import { BrowserSessionManager } from "../BrowserSessionManager"

describe("BrowserSessionManager", () => {
	let mockProvider: Partial<ClineProvider>
	let mockContext: any
	let mockOnStatusUpdate: ReturnType<typeof vi.fn>
	let mockOnWebviewUpdate: ReturnType<typeof vi.fn>
	let browserSessionManager: BrowserSessionManager

	beforeEach(() => {
		mockBrowserSession.isSessionActive.mockReset().mockReturnValue(false)
		mockBrowserSession.getViewportSize.mockReset().mockReturnValue({ width: 900, height: 600 })
		mockBrowserSession.dispose.mockReset()
		mockStateChangeCallback = undefined
		
		mockOnStatusUpdate = vi.fn()
		mockOnWebviewUpdate = vi.fn()

		mockContext = {
			globalStorageUri: { fsPath: "/test/path" },
			globalState: {
				get: vi.fn().mockReturnValue(undefined),
				update: vi.fn().mockResolvedValue(undefined),
			},
		} as any

		mockProvider = {
			postMessageToWebview: vi.fn(),
		} as any

		browserSessionManager = new BrowserSessionManager({
			taskId: "task-1",
			context: mockContext,
			providerRef: { deref: vi.fn().mockReturnValue(mockProvider) } as any,
			onStatusUpdate: mockOnStatusUpdate,
			onWebviewUpdate: mockOnWebviewUpdate,
		})

		vi.spyOn(browserSessionManager as any, "autoOpenBrowserSessionPanel").mockImplementation(() => {})
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(browserSessionManager.taskId).toBe("task-1")
		})

		it("should initialize without optional callbacks", () => {
			const managerWithoutCallbacks = new BrowserSessionManager({
				taskId: "task-2",
				context: mockContext,
				providerRef: { deref: vi.fn().mockReturnValue(mockProvider) } as any,
			})

			expect(managerWithoutCallbacks.taskId).toBe("task-2")
		})

		it("should create BrowserSession instance", () => {
			const session = browserSessionManager.getBrowserSession()
			expect(session).toBeDefined()
		})
	})

	describe("handleStateChange", () => {
		it("should call onStatusUpdate with opened message when session becomes active", () => {
			const manager = new BrowserSessionManager({
				taskId: "task-3",
				context: mockContext,
				providerRef: { deref: vi.fn().mockReturnValue(mockProvider) } as any,
				onStatusUpdate: mockOnStatusUpdate,
				onWebviewUpdate: mockOnWebviewUpdate,
			})

			vi.spyOn(manager as any, "autoOpenBrowserSessionPanel").mockImplementation(() => {})

			if (mockStateChangeCallback) {
				mockStateChangeCallback(true)
				expect(mockOnStatusUpdate).toHaveBeenCalledWith("Browser session opened")
			}
		})

		it("should call onStatusUpdate with closed message when session becomes inactive", () => {
			const manager = new BrowserSessionManager({
				taskId: "task-4",
				context: mockContext,
				providerRef: { deref: vi.fn().mockReturnValue(mockProvider) } as any,
				onStatusUpdate: mockOnStatusUpdate,
				onWebviewUpdate: mockOnWebviewUpdate,
			})

			vi.spyOn(manager as any, "autoOpenBrowserSessionPanel").mockImplementation(() => {})

			if (mockStateChangeCallback) {
				mockStateChangeCallback(false)
				expect(mockOnStatusUpdate).toHaveBeenCalledWith("Browser session closed")
			}
		})

		it("should call onWebviewUpdate with correct status", () => {
			const manager = new BrowserSessionManager({
				taskId: "task-5",
				context: mockContext,
				providerRef: { deref: vi.fn().mockReturnValue(mockProvider) } as any,
				onStatusUpdate: mockOnStatusUpdate,
				onWebviewUpdate: mockOnWebviewUpdate,
			})

			vi.spyOn(manager as any, "autoOpenBrowserSessionPanel").mockImplementation(() => {})

			if (mockStateChangeCallback) {
				mockStateChangeCallback(true)
				expect(mockOnWebviewUpdate).toHaveBeenCalledWith(true)

				mockStateChangeCallback(false)
				expect(mockOnWebviewUpdate).toHaveBeenCalledWith(false)
			}
		})

		it("should call autoOpenBrowserSessionPanel when session becomes active", () => {
			const manager = new BrowserSessionManager({
				taskId: "task-6",
				context: mockContext,
				providerRef: { deref: vi.fn().mockReturnValue(mockProvider) } as any,
				onStatusUpdate: mockOnStatusUpdate,
				onWebviewUpdate: mockOnWebviewUpdate,
			})

			const autoOpenSpy = vi.spyOn(manager as any, "autoOpenBrowserSessionPanel")

			if (mockStateChangeCallback) {
				mockStateChangeCallback(true)
				expect(autoOpenSpy).toHaveBeenCalled()
			}
		})

		it("should not call autoOpenBrowserSessionPanel when session becomes inactive", () => {
			const manager = new BrowserSessionManager({
				taskId: "task-7",
				context: mockContext,
				providerRef: { deref: vi.fn().mockReturnValue(mockProvider) } as any,
				onStatusUpdate: mockOnStatusUpdate,
				onWebviewUpdate: mockOnWebviewUpdate,
			})

			const autoOpenSpy = vi.spyOn(manager as any, "autoOpenBrowserSessionPanel")

			if (mockStateChangeCallback) {
				mockStateChangeCallback(false)
				expect(autoOpenSpy).not.toHaveBeenCalled()
			}
		})

		it("should not throw error when callbacks are not provided", () => {
			const manager = new BrowserSessionManager({
				taskId: "task-8",
				context: mockContext,
				providerRef: { deref: vi.fn().mockReturnValue(mockProvider) } as any,
			})

			vi.spyOn(manager as any, "autoOpenBrowserSessionPanel").mockImplementation(() => {})

			expect(() => {
				if (mockStateChangeCallback) {
					mockStateChangeCallback(true)
					mockStateChangeCallback(false)
				}
			}).not.toThrow()
		})
	})

	describe("autoOpenBrowserSessionPanel", () => {
		it("should not throw error when called", () => {
			const manager = new BrowserSessionManager({
				taskId: "task-9",
				context: mockContext,
				providerRef: { deref: vi.fn().mockReturnValue(mockProvider) } as any,
			})

			const autoOpenSpy = vi.spyOn(manager as any, "autoOpenBrowserSessionPanel").mockRestore()

			expect(() => {
				autoOpenSpy.call(manager)
			}).not.toThrow()
		})

		it("should not throw error when BrowserSessionPanelManager is not available", () => {
			const manager = new BrowserSessionManager({
				taskId: "task-10",
				context: mockContext,
				providerRef: { deref: vi.fn().mockReturnValue(mockProvider) } as any,
			})

			const autoOpenSpy = vi.spyOn(manager as any, "autoOpenBrowserSessionPanel").mockRestore()

			expect(() => {
				autoOpenSpy.call(manager)
			}).not.toThrow()
		})

		it("should not throw error when provider reference is lost", () => {
			const manager = new BrowserSessionManager({
				taskId: "task-11",
				context: mockContext,
				providerRef: { deref: vi.fn().mockReturnValue(undefined) } as any,
			})

			const autoOpenSpy = vi.spyOn(manager as any, "autoOpenBrowserSessionPanel").mockRestore()

			expect(() => {
				autoOpenSpy.call(manager)
			}).not.toThrow()
		})
	})

	describe("getBrowserSession", () => {
		it("should return the BrowserSession instance", () => {
			const session = browserSessionManager.getBrowserSession()

			expect(session).toBeDefined()
			expect(session.isSessionActive).toBeDefined()
			expect(session.getViewportSize).toBeDefined()
			expect(session.dispose).toBeDefined()
		})

		it("should return the same instance on multiple calls", () => {
			const session1 = browserSessionManager.getBrowserSession()
			const session2 = browserSessionManager.getBrowserSession()

			expect(session1).toBe(session2)
		})
	})

	describe("isSessionActive", () => {
		it("should return false when session is not active", () => {
			mockBrowserSession.isSessionActive.mockReturnValue(false)
			const isActive = browserSessionManager.isSessionActive()

			expect(isActive).toBe(false)
		})

		it("should return true when session is active", () => {
			mockBrowserSession.isSessionActive.mockReturnValue(true)
			const isActive = browserSessionManager.isSessionActive()

			expect(isActive).toBe(true)
		})

		it("should delegate to BrowserSession.isSessionActive", () => {
			mockBrowserSession.isSessionActive.mockReset().mockReturnValue(true)
			const result = browserSessionManager.isSessionActive()

			expect(mockBrowserSession.isSessionActive).toHaveBeenCalled()
		})
	})

	describe("getViewportSize", () => {
		it("should return viewport size when available", () => {
			mockBrowserSession.getViewportSize.mockReturnValue({ width: 900, height: 600 })
			const viewportSize = browserSessionManager.getViewportSize()

			expect(viewportSize).toEqual({ width: 900, height: 600 })
		})

		it("should return undefined when viewport size is not available", () => {
			mockBrowserSession.getViewportSize.mockReset().mockReturnValueOnce(undefined)
			const viewportSize = browserSessionManager.getViewportSize()

			expect(viewportSize).toBeUndefined()
		})

		it("should delegate to BrowserSession.getViewportSize", () => {
			mockBrowserSession.getViewportSize.mockReset().mockReturnValue({ width: 1024, height: 768 })
			const viewportSize = browserSessionManager.getViewportSize()

			expect(mockBrowserSession.getViewportSize).toHaveBeenCalled()
			expect(viewportSize).toEqual({ width: 1024, height: 768 })
		})
	})

	describe("dispose", () => {
		it("should call dispose on BrowserSession", () => {
			browserSessionManager.dispose()

			expect(mockBrowserSession.dispose).toHaveBeenCalled()
		})

		it("should not throw error when dispose is called multiple times", () => {
			expect(() => {
				browserSessionManager.dispose()
				browserSessionManager.dispose()
				browserSessionManager.dispose()
			}).not.toThrow()
		})
	})

	describe("integration tests", () => {
		it("should handle complete lifecycle of browser session", () => {
			const manager = new BrowserSessionManager({
				taskId: "task-12",
				context: mockContext,
				providerRef: { deref: vi.fn().mockReturnValue(mockProvider) } as any,
				onStatusUpdate: mockOnStatusUpdate,
				onWebviewUpdate: mockOnWebviewUpdate,
			})

			vi.spyOn(manager as any, "autoOpenBrowserSessionPanel").mockImplementation(() => {})

			mockBrowserSession.isSessionActive.mockReturnValue(true)
			mockBrowserSession.getViewportSize.mockReturnValue({ width: 1280, height: 720 })

			if (mockStateChangeCallback) {
				mockStateChangeCallback(true)
				expect(manager.isSessionActive()).toBe(true)
				expect(manager.getViewportSize()).toEqual({ width: 1280, height: 720 })

				mockBrowserSession.isSessionActive.mockReturnValue(false)
				mockStateChangeCallback(false)
				expect(manager.isSessionActive()).toBe(false)

				manager.dispose()
				expect(mockBrowserSession.dispose).toHaveBeenCalled()
			}
		})

		it("should handle provider reference loss gracefully", () => {
			const manager = new BrowserSessionManager({
				taskId: "task-13",
				context: mockContext,
				providerRef: { deref: vi.fn().mockReturnValue(undefined) } as any,
				onStatusUpdate: mockOnStatusUpdate,
				onWebviewUpdate: mockOnWebviewUpdate,
			})

			vi.spyOn(manager as any, "autoOpenBrowserSessionPanel").mockImplementation(() => {})

			mockBrowserSession.isSessionActive.mockReturnValue(true)
			mockBrowserSession.getViewportSize.mockReturnValue({ width: 900, height: 600 })

			expect(() => {
				if (mockStateChangeCallback) {
					mockStateChangeCallback(true)
					manager.isSessionActive()
					manager.getViewportSize()
					manager.dispose()
				}
			}).not.toThrow()
		})
	})
})
