import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { TaskLifecycleManager } from "../TaskLifecycleManager"
import type { ClineProvider } from "../../../../webview/ClineProvider"
import type { ProviderSettings } from "@shared/types"
import { RooCodeEventName } from "@shared/types"

describe("TaskLifecycleManager", () => {
	let mockTask: any
	let mockProvider: any
	let mockApiConfig: ProviderSettings
	let lifecycleManager: TaskLifecycleManager

	beforeEach(() => {
		mockTask = {
			taskId: "test-task-id",
			taskNumber: 1,
			abort: false,
			abandoned: false,
			abortReason: undefined,
			taskToolProtocol: undefined,
			taskMode: "default",
			apiConfiguration: {},
			apiConversationHistory: [],
			clineMessages: [],
			say: vi.fn().mockResolvedValue(undefined),
			ask: vi.fn().mockResolvedValue({ response: "messageResponse", text: "", images: [] }),
			recursivelyMakeClineRequests: vi.fn().mockResolvedValue(true),
			emit: vi.fn(),
			getModel: vi.fn().mockReturnValue({ info: { name: "test-model" } }),
			getAssistantMessageParser: vi.fn().mockReturnValue(undefined),
			setAssistantMessageParser: vi.fn(),
			clearAssistantMessageParser: vi.fn(),
			currentRequestAbortController: undefined,
			autoApprovalTimeoutRef: undefined,
			rooIgnoreController: undefined,
			rooProtectedController: undefined,
			diffViewProvider: {
				isEditing: false,
				revertChanges: vi.fn(),
			},
		}

		mockProvider = {
			log: vi.fn(),
			getState: vi.fn().mockResolvedValue({
				mode: "default",
				apiConfiguration: {},
				currentTaskItem: { id: "test-task-id", status: "active" },
			}),
			postStateToWebview: vi.fn().mockResolvedValue(undefined),
		}

		mockApiConfig = {
			apiProvider: "anthropic" as any,
			apiModelId: "claude-3-5-sonnet-20241022",
		}

		lifecycleManager = new TaskLifecycleManager({
			task: mockTask,
			providerRef: new WeakRef(mockProvider),
			taskId: "test-task-id",
			taskNumber: 1,
			workspacePath: "/mock/workspace",
			apiConfiguration: mockApiConfig,
			metadata: { task: "Test task" },
			enableCheckpoints: true,
		})
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("Constructor", () => {
		it("should initialize with correct properties", () => {
			expect(lifecycleManager).toBeDefined()
		})
	})

	describe("shouldAbortEarly", () => {
		it("should return true when task is aborted", () => {
			mockTask.abort = true
			const result = (lifecycleManager as any).shouldAbortEarly()
			expect(result).toBe(true)
		})

		it("should return true when task is abandoned", () => {
			mockTask.abandoned = true
			const result = (lifecycleManager as any).shouldAbortEarly()
			expect(result).toBe(true)
		})

		it("should return true when task is user cancelled", () => {
			mockTask.abortReason = "user_cancelled"
			const result = (lifecycleManager as any).shouldAbortEarly()
			expect(result).toBe(true)
		})

		it("should return false when task is active", () => {
			mockTask.abort = false
			mockTask.abandoned = false
			mockTask.abortReason = undefined
			const result = (lifecycleManager as any).shouldAbortEarly()
			expect(result).toBe(false)
		})
	})

	describe("findLastResponseIndex", () => {
		it("should find last ask message index", () => {
			mockTask.clineMessages = [
				{ type: "say", say: "text", ts: 1 },
				{ type: "ask", ask: "command", ts: 2 },
				{ type: "say", say: "text", ts: 3 },
			]
			const index = (lifecycleManager as any).findLastResponseIndex()
			expect(index).toBe(1)
		})

		it("should find last api_req_started message index", () => {
			mockTask.clineMessages = [
				{ type: "say", say: "text", ts: 1 },
				{ type: "say", say: "api_req_started", ts: 2 },
				{ type: "say", say: "text", ts: 3 },
			]
			const index = (lifecycleManager as any).findLastResponseIndex()
			expect(index).toBe(1)
		})

		it("should return -1 when no response message found", () => {
			mockTask.clineMessages = [
				{ type: "say", say: "text", ts: 1 },
				{ type: "say", say: "text", ts: 2 },
			]
			const index = (lifecycleManager as any).findLastResponseIndex()
			expect(index).toBe(-1)
		})

		it("should return -1 when messages array is empty", () => {
			mockTask.clineMessages = []
			const index = (lifecycleManager as any).findLastResponseIndex()
			expect(index).toBe(-1)
		})
	})

	describe("abortTask", () => {
		it("should set abort flag when called", async () => {
			await lifecycleManager.abortTask()
			expect(mockTask.abort).toBe(true)
		})

		it("should set abandoned flag when isAbandoned is true", async () => {
			await lifecycleManager.abortTask(true)
			expect(mockTask.abandoned).toBe(true)
		})

		it("should abort current request if exists", async () => {
			const mockAbortController = { abort: vi.fn() }
			mockTask.currentRequestAbortController = mockAbortController
			
			await lifecycleManager.abortTask()
			
			expect(mockAbortController.abort).toHaveBeenCalled()
		})

		it("should emit TaskAborted event", async () => {
			await lifecycleManager.abortTask()
			expect(mockTask.emit).toHaveBeenCalledWith(RooCodeEventName.TaskAborted)
		})

		it("should post state to webview", async () => {
			await lifecycleManager.abortTask()
			expect(mockProvider.postStateToWebview).toHaveBeenCalled()
		})
	})

	describe("dispose", () => {
		it("should set abort flag", async () => {
			await lifecycleManager.dispose()
			expect(mockTask.abort).toBe(true)
		})

		it("should abort current request if exists", async () => {
			const mockAbortController = { abort: vi.fn() }
			mockTask.currentRequestAbortController = mockAbortController
			
			await lifecycleManager.dispose()
			
			expect(mockAbortController.abort).toHaveBeenCalled()
			expect(mockTask.currentRequestAbortController).toBeUndefined()
		})

		it("should clear auto approval timeout if exists", async () => {
			const mockTimeoutRef = vi.fn()
			mockTask.autoApprovalTimeoutRef = mockTimeoutRef
			global.clearTimeout = vi.fn()
			
			await lifecycleManager.dispose()
			
			expect(global.clearTimeout).toHaveBeenCalledWith(mockTimeoutRef)
		})

		it("should dispose RooIgnoreController if exists", async () => {
			const mockRooIgnoreController = { dispose: vi.fn() }
			mockTask.rooIgnoreController = mockRooIgnoreController
			
			await lifecycleManager.dispose()
			
			expect(mockRooIgnoreController.dispose).toHaveBeenCalled()
		})

		it("should dispose RooProtectedController if exists", async () => {
			const mockRooProtectedController = { dispose: vi.fn() }
			mockTask.rooProtectedController = mockRooProtectedController
			
			await lifecycleManager.dispose()
			
			expect(mockRooProtectedController.dispose).toHaveBeenCalled()
		})
	})

	describe("delay", () => {
		it("should delay for specified milliseconds", async () => {
			const startTime = Date.now()
			await (lifecycleManager as any).delay(100)
			const endTime = Date.now()
			expect(endTime - startTime).toBeGreaterThanOrEqual(100)
		})
	})
})
