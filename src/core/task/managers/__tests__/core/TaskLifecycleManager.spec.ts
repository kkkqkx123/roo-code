import { describe, it, expect, vi, beforeEach } from "vitest"
import { TaskLifecycleManager } from "../../core/TaskLifecycleManager"
import { StreamingManager } from "../../api/StreamingManager"
import { MessageQueueManager } from "../../messaging/MessageQueueManager"
import { RooCodeEventName } from "@roo-code/types"
import type { Task } from "../../../Task"
import type { ClineProvider } from "../../../../webview/ClineProvider"
import { MessageQueueService } from "../../messaging/MessageQueueService"

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
	let mockMessageQueueManager: MessageQueueManager
	let lifecycleManager: TaskLifecycleManager

	beforeEach(() => {
		mockStreamingManager = new StreamingManager({
			taskId: "task-1",
		})

		mockMessageQueueManager = new MessageQueueManager({
			taskId: "task-1",
			providerRef: new WeakRef({} as ClineProvider),
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
			messageQueueManager: mockMessageQueueManager,
			rooIgnoreController: undefined,
			rooProtectedController: undefined,
			isStreaming: false,
			diffViewProvider: { isEditing: false, revertChanges: vi.fn() },
			api: { getModel: vi.fn().mockReturnValue({ info: {} }) },
			streamingManager: mockStreamingManager,
			getStreamingState: () => mockStreamingManager.getStreamingState(),
			getAssistantMessageParser: () => mockStreamingManager.getAssistantMessageParser(),
			setAssistantMessageParser: vi.fn(),
			clearAssistantMessageParser: vi.fn(),
		} as any

		mockProvider = {
			getState: vi.fn().mockResolvedValue({
				mode: "code",
				apiConfiguration: { apiProvider: "anthropic" },
			}),
			log: vi.fn(),
			postStateToWebview: vi.fn().mockResolvedValue(undefined),
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

			// Create mock controllers with dispose spies
			const mockRooIgnoreController = {
				dispose: vi.fn(),
			}
			const mockRooProtectedController = {
				dispose: vi.fn(),
			}

			// Create a new task with the mocked services
			const taskWithServices = {
				...mockTask,
				rooIgnoreController: mockRooIgnoreController as any,
				rooProtectedController: mockRooProtectedController as any,
				getStreamingState: () => mockStreamingManager.getStreamingState(),
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
			expect(mockRooIgnoreController.dispose).toHaveBeenCalled()
			expect(mockRooProtectedController.dispose).toHaveBeenCalled()
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
		it("should truncate history at last ask message to avoid context pollution", async () => {
			mockTask.clineMessages = [
				{ type: "say", say: "text", text: "Message 1", ts: 1 },
				{ type: "say", say: "reasoning", text: "Reasoning 1", ts: 2 },
				{ type: "ask", say: "completion_result", text: "Ask 1", ts: 3 },
				{ type: "say", say: "text", text: "Message 2", ts: 4 },
				{ type: "say", say: "reasoning", text: "Reasoning 2", ts: 5 },
			]

			const result = await (lifecycleManager as any).prepareResumeHistory()

			// 应该截断到 ask 消息（包含），清除后续可能错误的推理路径
			expect(result).toEqual([
				{ type: "say", say: "text", text: "Message 1", ts: 1 },
				{ type: "say", say: "reasoning", text: "Reasoning 1", ts: 2 },
				{ type: "ask", say: "completion_result", text: "Ask 1", ts: 3 },
			])
		})

		it("should truncate history at last api_req_started message", async () => {
			mockTask.clineMessages = [
				{ type: "say", say: "text", text: "Message 1", ts: 1 },
				{ type: "say", say: "api_req_started", text: '{"cost": 0.01}', ts: 2 },
				{ type: "say", say: "text", text: "Message 2", ts: 3 },
				{ type: "say", say: "reasoning", text: "Reasoning", ts: 4 },
			]

			const result = await (lifecycleManager as any).prepareResumeHistory()

			// 应该截断到 api_req_started 消息（包含）
			expect(result).toEqual([
				{ type: "say", say: "text", text: "Message 1", ts: 1 },
				{ type: "say", say: "api_req_started", text: '{"cost": 0.01}', ts: 2 },
			])
		})

		it("should return all messages if no ask or api_req_started found", async () => {
			mockTask.clineMessages = [
				{ type: "say", say: "text", text: "Message 1", ts: 1 },
				{ type: "say", say: "text", text: "Message 2", ts: 2 },
			]

			const result = await (lifecycleManager as any).prepareResumeHistory()

			// 如果没有找到需要响应的消息，返回所有消息
			expect(result).toEqual([
				{ type: "say", say: "text", text: "Message 1", ts: 1 },
				{ type: "say", say: "text", text: "Message 2", ts: 2 },
			])
		})

		it("should clear incorrect reasoning paths after intervention point", async () => {
			// 模拟人为干涉的场景：AI 走了错误的推理路径，用户暂停并恢复
			mockTask.clineMessages = [
				{ type: "say", say: "text", text: "用户：添加用户认证功能", ts: 1 },
				{ type: "say", say: "reasoning", text: "我需要先读取当前代码结构", ts: 2 },
				{ type: "say", say: "api_req_started", text: '{"cost": 0.01}', ts: 3 },
				{ type: "say", say: "text", text: "已读取代码结构", ts: 4 },
				{ type: "say", say: "reasoning", text: "我应该使用 JWT 认证", ts: 5 },
				// 用户在这里发现 AI 理解错误，暂停任务
				{ type: "say", say: "reasoning", text: "让我继续实现 JWT...", ts: 6 },
				{ type: "say", say: "api_req_started", text: '{"cost": 0.02}', ts: 7 },
			]

			const result = await (lifecycleManager as any).prepareResumeHistory()

			// 应该保留到最后一个需要响应的消息（api_req_started），清除之后的错误路径
			// 最后一个 api_req_started 在索引 7，所以保留所有消息到索引 7
			expect(result).toEqual([
				{ type: "say", say: "text", text: "用户：添加用户认证功能", ts: 1 },
				{ type: "say", say: "reasoning", text: "我需要先读取当前代码结构", ts: 2 },
				{ type: "say", say: "api_req_started", text: '{"cost": 0.01}', ts: 3 },
				{ type: "say", say: "text", text: "已读取代码结构", ts: 4 },
				{ type: "say", say: "reasoning", text: "我应该使用 JWT 认证", ts: 5 },
				{ type: "say", say: "reasoning", text: "让我继续实现 JWT...", ts: 6 },
				{ type: "say", say: "api_req_started", text: '{"cost": 0.02}', ts: 7 },
			])
		})
	})
})
