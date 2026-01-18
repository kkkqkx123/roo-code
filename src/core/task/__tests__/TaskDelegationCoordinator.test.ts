import { describe, it, expect, vi, beforeEach } from "vitest"
import { RooCodeEventName } from "@shared/types"
import { TaskDelegationCoordinator } from "../TaskDelegationCoordinator"

describe("TaskDelegationCoordinator", () => {
	let coordinator: TaskDelegationCoordinator
	let mockDependencies: any

	beforeEach(() => {
		vi.clearAllMocks()

		mockDependencies = {
			getCurrentTask: vi.fn(),
			removeClineFromStack: vi.fn().mockResolvedValue(undefined),
			createTask: vi.fn().mockResolvedValue({ taskId: "child-1" }),
			createTaskWithHistoryItem: vi.fn().mockResolvedValue({ taskId: "parent-1" }),
			getTaskWithId: vi.fn(),
			updateTaskHistory: vi.fn().mockResolvedValue([]),
			handleModeSwitch: vi.fn().mockResolvedValue(undefined),
			log: vi.fn(),
			emit: vi.fn(),
			globalStoragePath: "/tmp",
		}

		coordinator = new TaskDelegationCoordinator(mockDependencies)
	})

	describe("delegateParentAndOpenChild", () => {
		it("should throw error when no current task exists", async () => {
			mockDependencies.getCurrentTask.mockReturnValue(undefined)

			await expect(
				coordinator.delegateParentAndOpenChild({
					parentTaskId: "parent-1",
					message: "Do something",
					initialTodos: [],
					mode: "code",
				}),
			).rejects.toThrow("[delegateParentAndOpenChild] No current task")
		})

		it("should throw error when parent task ID mismatches", async () => {
			const mockParent = {
				taskId: "parent-2",
				flushPendingToolResultsToHistory: vi.fn().mockResolvedValue(undefined),
			}
			mockDependencies.getCurrentTask.mockReturnValue(mockParent)

			await expect(
				coordinator.delegateParentAndOpenChild({
					parentTaskId: "parent-1",
					message: "Do something",
					initialTodos: [],
					mode: "code",
				}),
			).rejects.toThrow("[delegateParentAndOpenChild] Parent mismatch")
		})

		it("should successfully delegate parent and create child task", async () => {
			const mockParent = {
				taskId: "parent-1",
				flushPendingToolResultsToHistory: vi.fn().mockResolvedValue(undefined),
			}
			mockDependencies.getCurrentTask.mockReturnValue(mockParent)
			mockDependencies.getTaskWithId.mockResolvedValue({
				historyItem: {
					id: "parent-1",
					status: "active",
					childIds: [],
				},
			})
			mockDependencies.createTask.mockResolvedValue({ taskId: "child-1" })

			const result = await coordinator.delegateParentAndOpenChild({
				parentTaskId: "parent-1",
				message: "Do something",
				initialTodos: [{ id: "1", content: "Test todo", status: "pending" }],
				mode: "code",
			})

			expect(result).toBeDefined()
			expect(result.taskId).toBe("child-1")
			expect(mockDependencies.removeClineFromStack).toHaveBeenCalled()
			expect(mockDependencies.handleModeSwitch).toHaveBeenCalledWith("code")
			expect(mockDependencies.createTask).toHaveBeenCalledWith(
				"Do something",
				undefined,
				mockParent,
				{
					initialTodos: [{ id: "1", content: "Test todo", status: "pending" }],
					initialStatus: "active",
				},
			)
		})

		it("should update parent history with delegation metadata", async () => {
			const mockParent = {
				taskId: "parent-1",
				flushPendingToolResultsToHistory: vi.fn().mockResolvedValue(undefined),
			}
			mockDependencies.getCurrentTask.mockReturnValue(mockParent)
			mockDependencies.getTaskWithId.mockResolvedValue({
				historyItem: {
					id: "parent-1",
					status: "active",
					childIds: [],
				},
			})
			mockDependencies.createTask.mockResolvedValue({ taskId: "child-1" })

			await coordinator.delegateParentAndOpenChild({
				parentTaskId: "parent-1",
				message: "Do something",
				initialTodos: [],
				mode: "code",
			})

			expect(mockDependencies.updateTaskHistory).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "parent-1",
					status: "delegated",
					delegatedToId: "child-1",
					awaitingChildId: "child-1",
					childIds: ["child-1"],
				}),
			)
		})

		it("should emit TaskDelegated event", async () => {
			const mockParent = {
				taskId: "parent-1",
				flushPendingToolResultsToHistory: vi.fn().mockResolvedValue(undefined),
			}
			mockDependencies.getCurrentTask.mockReturnValue(mockParent)
			mockDependencies.getTaskWithId.mockResolvedValue({
				historyItem: {
					id: "parent-1",
					status: "active",
					childIds: [],
				},
			})
			mockDependencies.createTask.mockResolvedValue({ taskId: "child-1" })

			await coordinator.delegateParentAndOpenChild({
				parentTaskId: "parent-1",
				message: "Do something",
				initialTodos: [],
				mode: "code",
			})

			expect(mockDependencies.emit).toHaveBeenCalledWith(
				RooCodeEventName.TaskDelegated,
				"parent-1",
				"child-1",
			)
		})

		it("should handle flushPendingToolResultsToHistory errors gracefully", async () => {
			const mockParent = {
				taskId: "parent-1",
				flushPendingToolResultsToHistory: vi.fn().mockRejectedValue(new Error("Flush error")),
			}
			mockDependencies.getCurrentTask.mockReturnValue(mockParent)
			mockDependencies.getTaskWithId.mockResolvedValue({
				historyItem: {
					id: "parent-1",
					status: "active",
					childIds: [],
				},
			})
			mockDependencies.createTask.mockResolvedValue({ taskId: "child-1" })

			await expect(
				coordinator.delegateParentAndOpenChild({
					parentTaskId: "parent-1",
					message: "Do something",
					initialTodos: [],
					mode: "code",
				}),
			).resolves.toBeDefined()

			expect(mockDependencies.log).toHaveBeenCalledWith(
				expect.stringContaining("[delegateParentAndOpenChild] Error flushing pending tool results"),
			)
		})

		it("should handle removeClineFromStack errors gracefully", async () => {
			const mockParent = {
				taskId: "parent-1",
				flushPendingToolResultsToHistory: vi.fn().mockResolvedValue(undefined),
			}
			mockDependencies.getCurrentTask.mockReturnValue(mockParent)
			mockDependencies.removeClineFromStack.mockRejectedValue(new Error("Remove error"))
			mockDependencies.getTaskWithId.mockResolvedValue({
				historyItem: {
					id: "parent-1",
					status: "active",
					childIds: [],
				},
			})
			mockDependencies.createTask.mockResolvedValue({ taskId: "child-1" })

			await expect(
				coordinator.delegateParentAndOpenChild({
					parentTaskId: "parent-1",
					message: "Do something",
					initialTodos: [],
					mode: "code",
				}),
			).resolves.toBeDefined()

			expect(mockDependencies.log).toHaveBeenCalledWith(
				expect.stringContaining("[delegateParentAndOpenChild] Error during parent disposal"),
			)
		})
	})

	describe("reopenParentFromDelegation", () => {
		it("should update parent history metadata before reopening", async () => {
			mockDependencies.getTaskWithId.mockResolvedValue({
				historyItem: {
					id: "parent-1",
					status: "delegated",
					delegatedToId: "child-1",
					awaitingChildId: "child-1",
					childIds: ["child-1"],
				},
			})
			mockDependencies.getCurrentTask.mockReturnValue({ taskId: "child-1" })
			mockDependencies.createTaskWithHistoryItem.mockResolvedValue({
				taskId: "parent-1",
				resumeAfterDelegation: vi.fn().mockResolvedValue(undefined),
				overwriteClineMessages: vi.fn().mockResolvedValue(undefined),
				overwriteApiConversationHistory: vi.fn().mockResolvedValue(undefined),
			})

			await coordinator.reopenParentFromDelegation({
				parentTaskId: "parent-1",
				childTaskId: "child-1",
				completionResultSummary: "Child completed",
			})

			expect(mockDependencies.updateTaskHistory).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "parent-1",
					status: "active",
					completedByChildId: "child-1",
					completionResultSummary: "Child completed",
					awaitingChildId: undefined,
					childIds: ["child-1"],
				}),
			)
		})

		it("should remove child from stack before reopening parent", async () => {
			mockDependencies.getTaskWithId.mockResolvedValue({
				historyItem: {
					id: "parent-1",
					status: "delegated",
					awaitingChildId: "child-1",
					childIds: [],
				},
			})
			mockDependencies.getCurrentTask.mockReturnValue({ taskId: "child-1" })
			mockDependencies.createTaskWithHistoryItem.mockResolvedValue({
				taskId: "parent-1",
				resumeAfterDelegation: vi.fn().mockResolvedValue(undefined),
				overwriteClineMessages: vi.fn().mockResolvedValue(undefined),
				overwriteApiConversationHistory: vi.fn().mockResolvedValue(undefined),
			})

			await coordinator.reopenParentFromDelegation({
				parentTaskId: "parent-1",
				childTaskId: "child-1",
				completionResultSummary: "Done",
			})

			expect(mockDependencies.removeClineFromStack).toHaveBeenCalled()
		})

		it("should create parent task with startTask: false option", async () => {
			mockDependencies.getTaskWithId.mockResolvedValue({
				historyItem: {
					id: "parent-1",
					status: "delegated",
					awaitingChildId: "child-1",
					childIds: [],
				},
			})
			mockDependencies.getCurrentTask.mockReturnValue({ taskId: "child-1" })
			mockDependencies.createTaskWithHistoryItem.mockResolvedValue({
				taskId: "parent-1",
				resumeAfterDelegation: vi.fn().mockResolvedValue(undefined),
				overwriteClineMessages: vi.fn().mockResolvedValue(undefined),
				overwriteApiConversationHistory: vi.fn().mockResolvedValue(undefined),
			})

			await coordinator.reopenParentFromDelegation({
				parentTaskId: "parent-1",
				childTaskId: "child-1",
				completionResultSummary: "Done",
			})

			expect(mockDependencies.createTaskWithHistoryItem).toHaveBeenCalledWith(
				expect.objectContaining({
					status: "active",
					completedByChildId: "child-1",
				}),
				{ startTask: false },
			)
		})

		it("should emit TaskDelegationCompleted and TaskDelegationResumed events", async () => {
			mockDependencies.getTaskWithId.mockResolvedValue({
				historyItem: {
					id: "parent-1",
					status: "delegated",
					awaitingChildId: "child-1",
					childIds: [],
				},
			})
			mockDependencies.getCurrentTask.mockReturnValue({ taskId: "child-1" })
			mockDependencies.createTaskWithHistoryItem.mockResolvedValue({
				taskId: "parent-1",
				resumeAfterDelegation: vi.fn().mockResolvedValue(undefined),
				overwriteClineMessages: vi.fn().mockResolvedValue(undefined),
				overwriteApiConversationHistory: vi.fn().mockResolvedValue(undefined),
			})

			await coordinator.reopenParentFromDelegation({
				parentTaskId: "parent-1",
				childTaskId: "child-1",
				completionResultSummary: "Done",
			})

			const eventCalls = mockDependencies.emit.mock.calls
			const eventNames = eventCalls.map((call: any[]) => call[0])

			expect(eventNames).toContain(RooCodeEventName.TaskDelegationCompleted)
			expect(eventNames).toContain(RooCodeEventName.TaskDelegationResumed)

			const completedIdx = eventNames.indexOf(RooCodeEventName.TaskDelegationCompleted)
			const resumedIdx = eventNames.indexOf(RooCodeEventName.TaskDelegationResumed)
			expect(resumedIdx).toBeGreaterThan(completedIdx)
		})

		it("should NOT emit TaskPaused or TaskUnpaused events", async () => {
			mockDependencies.getTaskWithId.mockResolvedValue({
				historyItem: {
					id: "parent-1",
					status: "delegated",
					awaitingChildId: "child-1",
					childIds: [],
				},
			})
			mockDependencies.getCurrentTask.mockReturnValue({ taskId: "child-1" })
			mockDependencies.createTaskWithHistoryItem.mockResolvedValue({
				taskId: "parent-1",
				resumeAfterDelegation: vi.fn().mockResolvedValue(undefined),
				overwriteClineMessages: vi.fn().mockResolvedValue(undefined),
				overwriteApiConversationHistory: vi.fn().mockResolvedValue(undefined),
			})

			await coordinator.reopenParentFromDelegation({
				parentTaskId: "parent-1",
				childTaskId: "child-1",
				completionResultSummary: "Done",
			})

			const eventNames = mockDependencies.emit.mock.calls.map((call: any[]) => call[0])
			expect(eventNames).not.toContain(RooCodeEventName.TaskPaused)
			expect(eventNames).not.toContain(RooCodeEventName.TaskUnpaused)
		})
	})
})
