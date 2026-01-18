// npx vitest run __tests__/new-task-delegation.spec.ts

import { describe, it, expect, vi } from "vitest"
import { RooCodeEventName } from "@roo-code/types"
import { Task } from "../core/task/Task"
import { SubtaskManager } from "../core/task/managers"

describe("Task.startSubtask() metadata-driven delegation", () => {
	it("Routes to provider.delegateParentAndOpenChild without pausing parent", async () => {
		const provider = {
			getState: vi.fn().mockResolvedValue({
				experiments: {},
			}),
			delegateParentAndOpenChild: vi.fn().mockResolvedValue({ taskId: "child-1" }),
			createTask: vi.fn(),
			handleModeSwitch: vi.fn(),
		} as any

		const subtaskManager = {
			startSubtask: vi.fn().mockResolvedValue(undefined),
		}

		const parent = Object.create(Task.prototype) as Task
		;(parent as any).taskId = "parent-1"
		;(parent as any).providerRef = { deref: () => provider }
		;(parent as any).emit = vi.fn()
		;(parent as any).subtaskManager = subtaskManager

		await (Task.prototype as any).startSubtask.call(parent, "Do something", [], "code")

		expect(subtaskManager.startSubtask).toHaveBeenCalledWith("Do something", [], "code")

		expect((parent as any).isPaused).not.toBe(true)
		expect((parent as any).childTaskId).toBeUndefined()
		const emittedEvents = (parent.emit as any).mock.calls.map((c: any[]) => c[0])
		expect(emittedEvents).not.toContain(RooCodeEventName.TaskPaused)
		expect(emittedEvents).not.toContain(RooCodeEventName.TaskUnpaused)

		expect(provider.createTask).not.toHaveBeenCalled()
	})
})
