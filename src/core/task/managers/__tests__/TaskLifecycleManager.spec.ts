import { describe, it, expect, vi, beforeEach } from "vitest"
import { TaskLifecycleManager } from "../TaskLifecycleManager"
import { StreamingManager } from "../StreamingManager"
import { RooCodeEventName } from "@roo-code/types"
import type { Task } from "../../Task"
import type { ClineProvider } from "../../../webview/ClineProvider"
import { MessageQueueService } from "../../../message-queue/MessageQueueService"

vi.mock("../../../ignore/RooIgnoreController", () => ({
	RooIgnoreController: vi.fn().mockImplementation(() => ({
		dispose: vi.fn(),
		initialize: vi.fn().mockResolvedValue(undefined),
	})),
}))

vi.mock("../../../protect/RooProtectedController", () => ({
	RooProtectedController: vi.fn().mockImplementation(() => ({
		dispose: vi.fn(),
	})),
}))

describe("TaskLifecycleManager", () => {
	let mockTask: Partial<Task>
	let mockProvider: Partial<ClineProvider>
	let providerRef: WeakRef<ClineProvider>
	let mockStreamingManager: StreamingManager
	let lifecycleManager: TaskLifecycleManager

	beforeEach(() => {
		mockStreamingManager = new StreamingManager({
			taskId: "task-1",
		})

		mockTask = {
			taskId: "task-1",
			taskMode: "code",
			apiConfiguration: { apiProvider: "anthropic" },
			apiConversationHistory: [],
			clineMessages: [],
			taskToolProtocol: undefined,
			assistantMessageParser: undefined,
			say: vi.fn().mockResolvedValue(undefined),
			recursivelyMakeClineRequests: vi.fn().mockResolvedValue(true),
			emit: vi.fn(),
			abort: false,
			currentRequestAbortController: undefined,
			messageQueueService: new MessageQueueService(),
			rooIgnoreController: undefined,
			rooProtectedController: undefined,
			isStreaming: false,
			diffViewProvider: { isEditing: false, revertChanges: vi.fn() },
			api: { getModel: vi.fn().mockReturnValue({ info: {} }) },
			streamingManager: mockStreamingManager,
		} as any

		mockProvider = {
			getState: vi.fn().mockResolvedValue({
				mode: "code",
				apiConfiguration: { apiProvider: "anthropic" },
			}),
		} as any

		providerRef = new WeakRef(mockProvider as ClineProvider)

		lifecycleManager = new TaskLifecycleManager({
			task: mockTask as Task,
			providerRef,
			taskId: "task-1",
			taskNumber: 1,
			workspacePath: "/workspace",
			apiConfiguration: { apiProvider: "anthropic" },
			metadata: { task: "Test task" },
			enableCheckpoints: false,
		})
	})

	describe("startTask", () => {
		it("should say the task message and initiate task loop", async () => {
			await lifecycleManager.startTask("Hello world")

			expect(mockTask.say).toHaveBeenCalledWith("text", "Hello world")
			expect(mockTask.emit).toHaveBeenCalledWith(RooCodeEventName.TaskStarted)
		})

		it("should handle images", async () => {
			const images = ["image1.png", "image2.png"]

			await lifecycleManager.startTask("Test", images)

			expect(mockTask.say).toHaveBeenCalledWith("text", "Test")
			expect(mockTask.say).toHaveBeenCalledWith("user_feedback", "", ["image1.png"])
			expect(mockTask.say).toHaveBeenCalledWith("user_feedback", "", ["image2.png"])
		})

		it("should not start if task is abandoned", async () => {
			mockTask.abandoned = true

			await lifecycleManager.startTask("Test")

			expect(mockTask.say).not.toHaveBeenCalled()
		})

		it("should not start if task is user cancelled", async () => {
			mockTask.abortReason = "user_cancelled"

			await lifecycleManager.startTask("Test")

			expect(mockTask.say).not.toHaveBeenCalled()
		})
	})

	describe("abortTask", () => {
		it("should set abort flag and emit TaskAborted event", async () => {
			mockTask.currentRequestAbortController = new AbortController()

			await lifecycleManager.abortTask()

			expect(mockTask.abort).toBe(true)
			expect(mockTask.currentRequestAbortController?.signal.aborted).toBe(true)
			expect(mockTask.emit).toHaveBeenCalledWith(RooCodeEventName.TaskAborted)
		})

		it("should mark task as abandoned when isAbandoned is true", async () => {
			await lifecycleManager.abortTask(true)

			expect(mockTask.abandoned).toBe(true)
			expect(mockTask.abort).toBe(true)
		})
	})

	describe("dispose", () => {
		it("should abort current request and dispose resources", async () => {
			mockTask.currentRequestAbortController = new AbortController()
			
			// Create instances with dispose spies
			const mockMessageQueueService = new MessageQueueService()
			const { RooIgnoreController } = await import("../../../ignore/RooIgnoreController")
			const { RooProtectedController } = await import("../../../protect/RooProtectedController")
			const mockRooIgnoreController = new RooIgnoreController("/workspace")
			const mockRooProtectedController = new RooProtectedController("/workspace")

			// Spy on dispose methods
			const disposeSpy = vi.spyOn(mockMessageQueueService, 'dispose')
			const ignoreDisposeSpy = vi.spyOn(mockRooIgnoreController, 'dispose')
			const protectedDisposeSpy = vi.spyOn(mockRooProtectedController, 'dispose')

			// Create a new task with the mocked services
			const taskWithServices = {
				...mockTask,
				messageQueueService: mockMessageQueueService,
				rooIgnoreController: mockRooIgnoreController,
				rooProtectedController: mockRooProtectedController,
			} as any

			const lifecycleManagerWithServices = new TaskLifecycleManager({
				task: taskWithServices as Task,
				providerRef,
				taskId: "task-1",
				taskNumber: 1,
				workspacePath: "/workspace",
				apiConfiguration: { apiProvider: "anthropic" },
				metadata: { task: "Test task" },
				enableCheckpoints: false,
			})

			await lifecycleManagerWithServices.dispose()

			expect(taskWithServices.abort).toBe(true)
			expect(taskWithServices.currentRequestAbortController?.signal.aborted).toBe(true)
			expect(disposeSpy).toHaveBeenCalled()
			expect(ignoreDisposeSpy).toHaveBeenCalled()
			expect(protectedDisposeSpy).toHaveBeenCalled()
		})

		it("should revert diff changes if streaming and editing", async () => {
			mockStreamingManager.setStreamingState(true)
			if (mockTask.diffViewProvider) {
				mockTask.diffViewProvider.isEditing = true
			}

			await lifecycleManager.dispose()

			if (mockTask.diffViewProvider) {
				expect(mockTask.diffViewProvider.revertChanges).toHaveBeenCalled()
			}
		})
	})

	describe("prepareTaskHistory", () => {
		it("should set task mode and api configuration from provider state", async () => {
			await (lifecycleManager as any).prepareTaskHistory()

			expect(mockTask.taskMode).toBe("code")
			expect(mockTask.apiConfiguration).toEqual({ apiProvider: "anthropic" })
		})
	})

	describe("prepareResumeHistory", () => {
		it("should remove reasoning messages from cline messages", async () => {
			mockTask.clineMessages = [
				{ type: "say", say: "text", text: "Message 1", ts: 1 },
				{ type: "say", say: "reasoning", text: "Reasoning", ts: 2 },
				{ type: "say", say: "text", text: "Message 2", ts: 3 },
			]

			const result = await (lifecycleManager as any).prepareResumeHistory()

			expect(result).toEqual([
				{ type: "say", say: "text", text: "Message 1", ts: 1 },
				{ type: "say", say: "text", text: "Message 2", ts: 3 },
			])
		})

		it("should remove api_req_started messages without cost or cancelReason", async () => {
			mockTask.clineMessages = [
				{ type: "say", say: "api_req_started", text: '{"ask":"completion_result"}', ts: 1 },
				{ type: "say", say: "text", text: "Message", ts: 2 },
			]

			const result = await (lifecycleManager as any).prepareResumeHistory()

			expect(result).toEqual([
				{ type: "say", say: "text", text: "Message", ts: 2 },
			])
		})
	})
})
