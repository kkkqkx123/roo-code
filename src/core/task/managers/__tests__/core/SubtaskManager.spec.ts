import { describe, it, expect, vi, beforeEach } from "vitest"
import { SubtaskManager } from "../../core/SubtaskManager"
import { RooCodeEventName, TodoStatus, TodoItem } from "@roo-code/types"
import type { Task } from "../../../Task"
import type { ClineProvider } from "../../../../webview/ClineProvider"

describe("SubtaskManager", () => {
	let mockTask: Partial<Task>
	let mockProvider: ClineProvider
	let providerRef: WeakRef<ClineProvider>
	let subtaskManager: SubtaskManager

	beforeEach(() => {
		mockTask = {
			taskId: "parent-1",
			emit: vi.fn(),
			apiConversationHistory: [],
			clineMessages: [],
			saveClineMessages: vi.fn().mockResolvedValue(undefined),
		} as any

		mockProvider = {
			delegateParentAndOpenChild: vi.fn().mockResolvedValue({ taskId: "child-1" }),
		} as unknown as ClineProvider

		providerRef = new WeakRef(mockProvider)

		subtaskManager = new SubtaskManager({
			task: mockTask as Task,
			providerRef,
			taskId: "parent-1",
			rootTaskId: "root-1",
			parentTaskId: undefined,
			taskNumber: 1,
			workspacePath: "/workspace",
			apiConfiguration: {},
		})
	})

	describe("startSubtask", () => {
		it("should delegate to provider and emit TaskDelegated event", async () => {
			const message = "Do something"
			const initialTodos: TodoItem[] = [{ id: "1", content: "Todo 1", status: "pending" as TodoStatus }]
			const mode = "code"

			await subtaskManager.startSubtask(message, initialTodos, mode)

			expect((mockProvider as any).delegateParentAndOpenChild).toHaveBeenCalledWith({
				parentTaskId: "parent-1",
				message,
				initialTodos,
				mode,
			})

			expect(mockTask.emit).toHaveBeenCalledWith(RooCodeEventName.TaskDelegated, "parent-1", "child-1")
			expect(subtaskManager.getChildTaskId()).toBe("child-1")
		})

		it("should throw error if provider reference is lost", async () => {
			const mockProviderRef = {
				deref: vi.fn().mockReturnValue(null),
			} as unknown as WeakRef<ClineProvider>

			const managerWithLostRef = new SubtaskManager({
				task: mockTask as Task,
				providerRef: mockProviderRef,
				taskId: "parent-1",
				taskNumber: 1,
				workspacePath: "/workspace",
				apiConfiguration: {},
			})

			await expect(
				managerWithLostRef.startSubtask("Do something", [], "code"),
			).rejects.toThrow("Provider reference lost")
		})
	})

	describe("resumeAfterDelegation", () => {
		it("should clean up conversation history and cline messages", async () => {
			mockTask.apiConversationHistory = [
				{
					role: "user",
					content: [
						{ type: "text", text: "Some message" },
						{ type: "text", text: "Task delegated to subtask\nSome details" },
					],
				},
			]

			mockTask.clineMessages = [
				{ type: "say", say: "text", text: "Message 1", ts: 1 },
				{ type: "say", say: "reasoning", text: "Reasoning", ts: 2 },
				{ type: "say", say: "text", text: "Message 2", ts: 3 },
			]

			subtaskManager.childTaskId = "child-1"

			await subtaskManager.resumeAfterDelegation()

			expect(mockTask.clineMessages).toEqual([
				{ type: "say", say: "text", text: "Message 1", ts: 1 },
				{ type: "say", say: "text", text: "Message 2", ts: 3 },
			])

			expect(mockTask.saveClineMessages).toHaveBeenCalled()
			expect(subtaskManager.getChildTaskId()).toBeUndefined()
		})

		it("should handle empty conversation history", async () => {
			mockTask.apiConversationHistory = []

			await subtaskManager.resumeAfterDelegation()

			expect(mockTask.saveClineMessages).not.toHaveBeenCalled()
		})

		it("should remove api_req_started messages without cost or cancelReason", async () => {
			mockTask.apiConversationHistory = [
				{
					role: "user",
					content: [{ type: "text", text: "Some message" }],
				},
			]

			mockTask.clineMessages = [
				{ type: "say", say: "api_req_started", text: '{}', ts: 1 },
				{ type: "say", say: "text", text: "Message", ts: 2 },
			]

			await subtaskManager.resumeAfterDelegation()

			expect(mockTask.clineMessages).toEqual([
				{ type: "say", say: "text", text: "Message", ts: 2 },
			])
		})
	})

	describe("pendingNewTaskToolCallId", () => {
		it("should set and get pending new task tool call id", () => {
			expect(subtaskManager.getPendingNewTaskToolCallId()).toBeUndefined()

			subtaskManager.setPendingNewTaskToolCallId("tool-call-123")
			expect(subtaskManager.getPendingNewTaskToolCallId()).toBe("tool-call-123")

			subtaskManager.clearPendingNewTaskToolCallId()
			expect(subtaskManager.getPendingNewTaskToolCallId()).toBeUndefined()
		})
	})
})
