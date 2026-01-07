import { describe, it, expect, vi, beforeEach } from "vitest"
import { TaskStateManager } from "../TaskStateManager"
import { RooCodeEventName } from "@roo-code/types"
import type { ClineProvider } from "../../../webview/ClineProvider"

describe("TaskStateManager", () => {
	let mockProvider: Partial<ClineProvider>
	let stateManager: TaskStateManager

	beforeEach(() => {
		mockProvider = {
			getState: vi.fn().mockResolvedValue({
				mode: "code",
				apiConfiguration: { apiProvider: "anthropic" },
			}),
		} as any

		stateManager = new TaskStateManager({
			taskId: "task-1",
			rootTaskId: "root-1",
			parentTaskId: undefined,
			taskNumber: 1,
			workspacePath: "/workspace",
			metadata: { task: "Test task" },
			provider: mockProvider as ClineProvider,
			apiConfiguration: { apiProvider: "anthropic" },
			initialTodos: [{ id: "1", content: "Todo 1", status: "pending" }],
			initialStatus: "active",
			modelInfo: { supportsNativeTools: true, contextWindow: 200000, supportsPromptCache: true },
		})
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(stateManager.taskId).toBe("task-1")
			expect(stateManager.rootTaskId).toBe("root-1")
			expect(stateManager.parentTaskId).toBeUndefined()
			expect(stateManager.childTaskId).toBeUndefined()
			expect(stateManager.taskNumber).toBe(1)
			expect(stateManager.workspacePath).toBe("/workspace")
			expect(stateManager.metadata).toEqual({ task: "Test task" })
			expect(stateManager.todoList).toEqual([{ id: "1", content: "Todo 1" }])
		})

		it("should generate unique instance id", () => {
			expect(stateManager.instanceId).toBeDefined()
			expect(stateManager.instanceId.length).toBe(8)
		})

		it("should initialize task mode from history item", () => {
			const managerWithHistory = new TaskStateManager({
				taskId: "task-2",
				taskNumber: 1,
				workspacePath: "/workspace",
				metadata: { task: "Test" },
				provider: mockProvider as ClineProvider,
				apiConfiguration: { apiProvider: "anthropic" },
				historyItem: { mode: "ask", toolProtocol: "native" },
			})

			expect(managerWithHistory.taskMode).toBe("ask")
			expect(managerWithHistory.taskToolProtocol).toBe("native")
		})
	})

	describe("taskMode", () => {
		it("should initialize task mode asynchronously", async () => {
			const manager = new TaskStateManager({
				taskId: "task-3",
				taskNumber: 1,
				workspacePath: "/workspace",
				metadata: { task: "Test" },
				provider: mockProvider as ClineProvider,
				apiConfiguration: { apiProvider: "anthropic" },
			})

			await manager.waitForModeInitialization()
			expect(manager.taskMode).toBe("code")
		})

		it("should throw error if task mode is accessed before initialization", () => {
			const manager = new TaskStateManager({
				taskId: "task-4",
				taskNumber: 1,
				workspacePath: "/workspace",
				metadata: { task: "Test" },
				provider: mockProvider as ClineProvider,
				apiConfiguration: { apiProvider: "anthropic" },
			})

			expect(() => manager.taskMode).toThrow("Task mode not initialized")
		})

		it("should return default mode if provider state fails", async () => {
			mockProvider.getState = vi.fn().mockRejectedValue(new Error("State error"))

			const manager = new TaskStateManager({
				taskId: "task-5",
				taskNumber: 1,
				workspacePath: "/workspace",
				metadata: { task: "Test" },
				provider: mockProvider as ClineProvider,
				apiConfiguration: { apiProvider: "anthropic" },
			})

			await manager.waitForModeInitialization()
			expect(manager.taskMode).toBe("architect")
		})
	})

	describe("taskToolProtocol", () => {
		it("should get and set task tool protocol", () => {
			expect(stateManager.taskToolProtocol).toBeDefined()

			stateManager.taskToolProtocol = "native"
			expect(stateManager.taskToolProtocol).toBe("native")
		})
	})

	describe("state management", () => {
		it("should set and get abort flag", () => {
			expect(stateManager.abort).toBe(false)

			stateManager.setAbort(true)
			expect(stateManager.abort).toBe(true)
		})

		it("should set and get paused flag", () => {
			expect(stateManager.isPaused).toBe(false)

			stateManager.setPaused(true)
			expect(stateManager.isPaused).toBe(true)
		})

		it("should set and get abandoned flag", () => {
			expect(stateManager.abandoned).toBe(false)

			stateManager.setAbandoned(true)
			expect(stateManager.abandoned).toBe(true)
		})

		it("should set and get abort reason", () => {
			expect(stateManager.abortReason).toBeUndefined()

			stateManager.setAbortReason("user_cancelled")
			expect(stateManager.abortReason).toBe("user_cancelled")
		})

		it("should set and get initialized flag", () => {
			expect(stateManager.isInitialized).toBe(false)

			stateManager.setInitialized(true)
			expect(stateManager.isInitialized).toBe(true)
		})

		it("should set and get didFinishAbortingStream flag", () => {
			expect(stateManager.didFinishAbortingStream).toBe(false)

			stateManager.setDidFinishAbortingStream(true)
			expect(stateManager.didFinishAbortingStream).toBe(true)
		})
	})

	describe("currentRequestAbortController", () => {
		it("should cancel current request", () => {
			const controller = new AbortController()
			stateManager.currentRequestAbortController = controller

			expect(controller.signal.aborted).toBe(false)

			stateManager.cancelCurrentRequest()
			expect(controller.signal.aborted).toBe(true)
			expect(stateManager.currentRequestAbortController).toBeUndefined()
		})
	})

	describe("getProvider", () => {
		it("should return provider if reference is valid", () => {
			const provider = stateManager.getProvider()
			expect(provider).toBe(mockProvider)
		})

		it("should return undefined if provider reference is lost", () => {
			const manager = new TaskStateManager({
				taskId: "task-6",
				taskNumber: 1,
				workspacePath: "/workspace",
				metadata: { task: "Test" },
				provider: {} as ClineProvider,
				apiConfiguration: { apiProvider: "anthropic" },
			})

			const providerObj = {}
			const lostRef = new WeakRef(providerObj)
			Object.assign(providerObj, null)
			;(manager as any).providerRef = lostRef

			const result = manager.getProvider()
			expect(result).toBeUndefined()
		})
	})

	describe("emitTaskEvent", () => {
		it("should emit task events", () => {
			const handler = vi.fn()
			stateManager.on(RooCodeEventName.TaskStarted, handler)

			stateManager.emitTaskEvent(RooCodeEventName.TaskStarted)

			expect(handler).toHaveBeenCalled()
		})
	})

	describe("dispose", () => {
		it("should remove all event listeners", () => {
			const handler = vi.fn()
			stateManager.on(RooCodeEventName.TaskStarted, handler)

			stateManager.dispose(new WeakRef(mockProvider as ClineProvider))

			stateManager.emitTaskEvent(RooCodeEventName.TaskStarted)
			expect(handler).not.toHaveBeenCalled()
		})
	})

	describe("updateApiConfiguration", () => {
		it("should be callable for interface compatibility", () => {
			expect(() => {
				stateManager.updateApiConfiguration({ apiProvider: "openai" })
			}).not.toThrow()
		})
	})
})
