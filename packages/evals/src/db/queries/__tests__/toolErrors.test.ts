import { eq } from "drizzle-orm"

import { createToolError } from "../toolErrors.js"
import { createRun } from "../runs.js"
import { createTask } from "../tasks.js"
import { createTaskMetrics } from "../taskMetrics.js"
import { schema } from "../../schema.js"
import { client as db } from "../../db.js"

describe("toolErrors", () => {
	let runId: number
	let taskId: number | null = null
	let toolErrorIds: number[] = []
	let taskMetricsIds: number[] = []

	beforeEach(async () => {
		const run = await createRun({
			model: "gpt-4.1-mini",
			socketPath: "/tmp/test.sock",
			timeout: 5,
		})
		runId = run.id
	})

	afterEach(async () => {
		if (toolErrorIds.length > 0) {
			await db.delete(schema.toolErrors).where(eq(schema.toolErrors.runId, runId))
		}

		if (taskId !== null) {
			await db.delete(schema.tasks).where(eq(schema.tasks.id, taskId))
		}

		await db.delete(schema.runs).where(eq(schema.runs.id, runId))

		if (taskMetricsIds.length > 0) {
			for (const id of taskMetricsIds) {
				await db.delete(schema.taskMetrics).where(eq(schema.taskMetrics.id, id))
			}
		}

		toolErrorIds = []
		taskId = null
		taskMetricsIds = []
	})

	describe("createToolError", () => {
		it("should create a tool error associated with a task", async () => {
			const taskMetrics = await createTaskMetrics({
				duration: 1000,
				tokensIn: 100,
				tokensOut: 50,
				tokensContext: 150,
				cacheWrites: 0,
				cacheReads: 0,
				cost: 0.001,
				toolUsage: { read_file: { attempts: 1, failures: 0 } },
			})
			taskMetricsIds.push(taskMetrics.id)

			const task = await createTask({
				runId,
				taskMetricsId: taskMetrics.id,
				language: "go",
				exercise: "go/hello",
				passed: 0,
				startedAt: new Date().toISOString(),
				finishedAt: new Date().toISOString(),
			})
			taskId = task.id

			const toolError = await createToolError({
				runId,
				taskId: task.id,
				toolName: "apply_diff",
				error: "Syntax error in diff",
			})
			toolErrorIds.push(toolError.id)

			expect(toolError).toBeDefined()
			expect(toolError.id).toBeDefined()
			expect(toolError.runId).toBe(runId)
			expect(toolError.taskId).toBe(task.id)
			expect(toolError.toolName).toBe("apply_diff")
			expect(toolError.error).toBe("Syntax error in diff")
			expect(toolError.createdAt).toBeDefined()
		})

		it("should create a tool error associated with a run (no task)", async () => {
			const toolError = await createToolError({
				runId,
				taskId: null,
				toolName: "browser_action",
				error: "Browser connection timeout",
			})
			toolErrorIds.push(toolError.id)

			expect(toolError).toBeDefined()
			expect(toolError.id).toBeDefined()
			expect(toolError.runId).toBe(runId)
			expect(toolError.taskId).toBeNull()
			expect(toolError.toolName).toBe("browser_action")
			expect(toolError.error).toBe("Browser connection timeout")
		})

		it("should create multiple tool errors for the same task", async () => {
			const taskMetrics = await createTaskMetrics({
				duration: 1000,
				tokensIn: 100,
				tokensOut: 50,
				tokensContext: 150,
				cacheWrites: 0,
				cacheReads: 0,
				cost: 0.001,
				toolUsage: { read_file: { attempts: 1, failures: 0 } },
			})
			taskMetricsIds.push(taskMetrics.id)

			const task = await createTask({
				runId,
				taskMetricsId: taskMetrics.id,
				language: "python",
				exercise: "python/hello",
				passed: 0,
				startedAt: new Date().toISOString(),
				finishedAt: new Date().toISOString(),
			})
			taskId = task.id

			const toolError1 = await createToolError({
				runId,
				taskId: task.id,
				toolName: "execute_command",
				error: "Command failed with exit code 1",
			})
			toolErrorIds.push(toolError1.id)

			const toolError2 = await createToolError({
				runId,
				taskId: task.id,
				toolName: "execute_command",
				error: "Command failed with exit code 2",
			})
			toolErrorIds.push(toolError2.id)

			expect(toolError1.id).not.toBe(toolError2.id)
			expect(toolError1.taskId).toBe(toolError2.taskId)
		})

		it("should create tool errors for different tool types", async () => {
			const taskMetrics = await createTaskMetrics({
				duration: 1000,
				tokensIn: 100,
				tokensOut: 50,
				tokensContext: 150,
				cacheWrites: 0,
				cacheReads: 0,
				cost: 0.001,
				toolUsage: { read_file: { attempts: 1, failures: 0 } },
			})
			taskMetricsIds.push(taskMetrics.id)

			const task = await createTask({
				runId,
				taskMetricsId: taskMetrics.id,
				language: "javascript",
				exercise: "javascript/hello",
				passed: 0,
				startedAt: new Date().toISOString(),
				finishedAt: new Date().toISOString(),
			})
			taskId = task.id

			const readFileError = await createToolError({
				runId,
				taskId: task.id,
				toolName: "read_file",
				error: "File not found",
			})
			toolErrorIds.push(readFileError.id)

			const applyDiffError = await createToolError({
				runId,
				taskId: task.id,
				toolName: "apply_diff",
				error: "Patch failed to apply",
			})
			toolErrorIds.push(applyDiffError.id)

			const executeCommandError = await createToolError({
				runId,
				taskId: task.id,
				toolName: "execute_command",
				error: "Command not found",
			})
			toolErrorIds.push(executeCommandError.id)

			expect(readFileError.toolName).toBe("read_file")
			expect(applyDiffError.toolName).toBe("apply_diff")
			expect(executeCommandError.toolName).toBe("execute_command")
		})

		it("should handle long error messages", async () => {
			const longError = "A".repeat(1000)

			const toolError = await createToolError({
				runId,
				taskId: null,
				toolName: "execute_command",
				error: longError,
			})
			toolErrorIds.push(toolError.id)

			expect(toolError.error).toBe(longError)
			expect(toolError.error.length).toBe(1000)
		})
	})
})
