import { eq } from "drizzle-orm"

import { findRun, createRun, updateRun, getRuns, finishRun, deleteRun, getIncompleteRuns, deleteRunsByIds } from "../runs.js"
import { createTask } from "../tasks.js"
import { createTaskMetrics } from "../taskMetrics.js"
import { createToolError } from "../toolErrors.js"
import { RecordNotFoundError } from "../errors.js"
import { schema } from "../../schema.js"
import { client as db } from "../../db.js"

describe("runs", () => {
	let runIds: number[] = []
	let taskIds: number[] = []
	let taskMetricsIds: number[] = []
	let toolErrorIds: number[] = []

	afterEach(async () => {
		if (toolErrorIds.length > 0) {
			for (const runId of runIds) {
				await db.delete(schema.toolErrors).where(eq(schema.toolErrors.runId, runId))
			}
		}

		if (taskIds.length > 0) {
			for (const runId of runIds) {
				await db.delete(schema.tasks).where(eq(schema.tasks.runId, runId))
			}
		}

		if (runIds.length > 0) {
			if (runIds[0] !== undefined) {
				await db.delete(schema.runs).where(eq(schema.runs.id, runIds[0]))
			}
		}

		if (taskMetricsIds.length > 0) {
			for (const id of taskMetricsIds) {
				await db.delete(schema.taskMetrics).where(eq(schema.taskMetrics.id, id))
			}
		}

		runIds = []
		taskIds = []
		taskMetricsIds = []
		toolErrorIds = []
	})

	describe("findRun", () => {
		it("should find a run by id", async () => {
			const run = await createRun({
				model: "gpt-4.1-mini",
				socketPath: "/tmp/test.sock",
				timeout: 5,
			})
			runIds.push(run.id)

			const found = await findRun(run.id)

			expect(found).toBeDefined()
			if (found) {
				expect(found.id).toBe(run.id)
				expect(found.model).toBe("gpt-4.1-mini")
				expect(found.socketPath).toBe("/tmp/test.sock")
				expect(found.timeout).toBe(5)
			}
		})

		it("should throw RecordNotFoundError for non-existent run", async () => {
			await expect(findRun(999999)).rejects.toThrow(RecordNotFoundError)
		})
	})

	describe("createRun", () => {
		it("should create a new run with minimal parameters", async () => {
			const run = await createRun({
				model: "gpt-3.5-turbo",
				socketPath: "/tmp/minimal.sock",
				timeout: 5,
			})
			runIds.push(run.id)

			expect(run).toBeDefined()
			expect(run.id).toBeDefined()
			expect(run.model).toBe("gpt-3.5-turbo")
			expect(run.socketPath).toBe("/tmp/minimal.sock")
			expect(run.timeout).toBe(5)
			expect(run.concurrency).toBe(2)
			expect(run.passed).toBe(0)
			expect(run.failed).toBe(0)
			expect(run.createdAt).toBeDefined()
		})

		it("should create a new run with all parameters", async () => {
			const run = await createRun({
				model: "gpt-4.1-mini",
				socketPath: "/tmp/full.sock",
				name: "Test Run",
				description: "A test run description",
				contextWindow: 128000,
				inputPrice: 2.5,
				outputPrice: 10,
				cacheWritesPrice: 0.3,
				cacheReadsPrice: 0.08,
				settings: { modelTemperature: 0.7 },
				jobToken: "test-token",
				pid: 12345,
				concurrency: 4,
				timeout: 10,
			})
			runIds.push(run.id)

			expect(run).toBeDefined()
			expect(run.model).toBe("gpt-4.1-mini")
			expect(run.name).toBe("Test Run")
			expect(run.description).toBe("A test run description")
			expect(run.contextWindow).toBe(128000)
			expect(run.inputPrice).toBe(2.5)
			expect(run.outputPrice).toBe(10)
			expect(run.cacheWritesPrice).toBe(0.3)
			expect(run.cacheReadsPrice).toBe(0.08)
			expect(run.jobToken).toBe("test-token")
			expect(run.pid).toBe(12345)
			expect(run.concurrency).toBe(4)
			expect(run.timeout).toBe(10)
		})
	})

	describe("updateRun", () => {
		it("should update a run", async () => {
			const run = await createRun({
				model: "gpt-4.1-mini",
				socketPath: "/tmp/test.sock",
				timeout: 5,
			})
			runIds.push(run.id)

			const updated = await updateRun(run.id, {
				passed: 5,
				failed: 2,
			})

			expect(updated).toBeDefined()
			if (updated) {
				expect(updated.passed).toBe(5)
				expect(updated.failed).toBe(2)
			}
		})

		it("should throw RecordNotFoundError for non-existent run", async () => {
			await expect(updateRun(999999, { passed: 5 })).rejects.toThrow(RecordNotFoundError)
		})
	})

	describe("getRuns", () => {
		it("should get all runs ordered by id descending", async () => {
			const run1 = await createRun({
				model: "gpt-4.1-mini",
				socketPath: "/tmp/run1.sock",
				timeout: 5,
			})
			runIds.push(run1.id)

			const run2 = await createRun({
				model: "gpt-3.5-turbo",
				socketPath: "/tmp/run2.sock",
				timeout: 5,
			})
			runIds.push(run2.id)

			const runs = await getRuns()

			expect(runs.length).toBeGreaterThanOrEqual(2)
			expect(runs[0]?.id).toBeGreaterThan(runs[1]?.id || 0)
		})

		it("should include task metrics in results", async () => {
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

			const run = await createRun({
				model: "gpt-4.1-mini",
				socketPath: "/tmp/test.sock",
				timeout: 5,
			})
			runIds.push(run.id)

			await updateRun(run.id, { taskMetricsId: taskMetrics.id })

			const runs = await getRuns()
			const foundRun = runs.find((r) => r.id === run.id)

			expect(foundRun).toBeDefined()
			expect(foundRun!.taskMetrics).toBeDefined()
			expect(foundRun!.taskMetrics!.id).toBe(taskMetrics.id)
		})
	})

	describe("getIncompleteRuns", () => {
		it("should get runs without task metrics", async () => {
			const completeRun = await createRun({
				model: "gpt-4.1-mini",
				socketPath: "/tmp/complete.sock",
				timeout: 5,
			})
			runIds.push(completeRun.id)

			const incompleteRun = await createRun({
				model: "gpt-3.5-turbo",
				socketPath: "/tmp/incomplete.sock",
				timeout: 5,
			})
			runIds.push(incompleteRun.id)

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

			await updateRun(completeRun.id, { taskMetricsId: taskMetrics.id })

			const incompleteRuns = await getIncompleteRuns()

			expect(incompleteRuns.length).toBeGreaterThanOrEqual(1)
			expect(incompleteRuns.some((r) => r.id === incompleteRun.id)).toBe(true)
			expect(incompleteRuns.some((r) => r.id === completeRun.id)).toBe(false)
		})
	})

	describe("deleteRun", () => {
		it("should delete a run and all related data", async () => {
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

			const run = await createRun({
				model: "gpt-4.1-mini",
				socketPath: "/tmp/test.sock",
				timeout: 5,
			})
			runIds.push(run.id)

			await updateRun(run.id, { taskMetricsId: taskMetrics.id })

			const task = await createTask({
				runId: run.id,
				taskMetricsId: taskMetrics.id,
				language: "go",
				exercise: "go/hello",
				passed: 1,
				startedAt: new Date().toISOString(),
				finishedAt: new Date().toISOString(),
			})
			taskIds.push(task.id)

			const toolError = await createToolError({
				runId: run.id,
				taskId: task.id,
				toolName: "apply_diff",
				error: "Test error",
			})
			toolErrorIds.push(toolError.id)

			await deleteRun(run.id)

			const foundRun = await db.query.runs.findFirst({ where: eq(schema.runs.id, run.id) })
			expect(foundRun).toBeUndefined()

			const foundTask = await db.query.tasks.findFirst({ where: eq(schema.tasks.id, task.id) })
			expect(foundTask).toBeUndefined()

			const foundToolError = await db.query.toolErrors.findFirst({ where: eq(schema.toolErrors.id, toolError.id) })
			expect(foundToolError).toBeUndefined()

			const foundTaskMetrics = await db.query.taskMetrics.findFirst({ where: eq(schema.taskMetrics.id, taskMetrics.id) })
			expect(foundTaskMetrics).toBeUndefined()
		})

		it("should throw RecordNotFoundError for non-existent run", async () => {
			await expect(deleteRun(999999)).rejects.toThrow(RecordNotFoundError)
		})
	})

	describe("deleteRunsByIds", () => {
		it("should delete multiple runs by their IDs", async () => {
			const run1 = await createRun({
				model: "gpt-4.1-mini",
				socketPath: "/tmp/run1.sock",
				timeout: 5,
			})
			runIds.push(run1.id)

			const run2 = await createRun({
				model: "gpt-3.5-turbo",
				socketPath: "/tmp/run2.sock",
				timeout: 5,
			})
			runIds.push(run2.id)

			await deleteRunsByIds([run1.id, run2.id])

			const foundRun1 = await db.query.runs.findFirst({ where: eq(schema.runs.id, run1.id) })
			expect(foundRun1).toBeUndefined()

			const foundRun2 = await db.query.runs.findFirst({ where: eq(schema.runs.id, run2.id) })
			expect(foundRun2).toBeUndefined()
		})

		it("should handle empty array of IDs", async () => {
			await expect(deleteRunsByIds([])).resolves.not.toThrow()
		})

		it("should delete all related data for multiple runs", async () => {
			const taskMetrics1 = await createTaskMetrics({
				duration: 1000,
				tokensIn: 100,
				tokensOut: 50,
				tokensContext: 150,
				cacheWrites: 0,
				cacheReads: 0,
				cost: 0.001,
				toolUsage: { read_file: { attempts: 1, failures: 0 } },
			})
			taskMetricsIds.push(taskMetrics1.id)

			const run1 = await createRun({
				model: "gpt-4.1-mini",
				socketPath: "/tmp/run1.sock",
				timeout: 5,
			})
			runIds.push(run1.id)

			const task1 = await createTask({
				runId: run1.id,
				taskMetricsId: taskMetrics1.id,
				language: "go",
				exercise: "go/hello",
				passed: 1,
				startedAt: new Date().toISOString(),
				finishedAt: new Date().toISOString(),
			})
			taskIds.push(task1.id)

			const taskMetrics2 = await createTaskMetrics({
				duration: 1000,
				tokensIn: 100,
				tokensOut: 50,
				tokensContext: 150,
				cacheWrites: 0,
				cacheReads: 0,
				cost: 0.001,
				toolUsage: { read_file: { attempts: 1, failures: 0 } },
			})
			taskMetricsIds.push(taskMetrics2.id)

			const run2 = await createRun({
				model: "gpt-3.5-turbo",
				socketPath: "/tmp/run2.sock",
				timeout: 5,
			})
			runIds.push(run2.id)

			const task2 = await createTask({
				runId: run2.id,
				taskMetricsId: taskMetrics2.id,
				language: "python",
				exercise: "python/hello",
				passed: 0,
				startedAt: new Date().toISOString(),
				finishedAt: new Date().toISOString(),
			})
			taskIds.push(task2.id)

			await deleteRunsByIds([run1.id, run2.id])

			const foundTask1 = await db.query.tasks.findFirst({ where: eq(schema.tasks.id, task1.id) })
			expect(foundTask1).toBeUndefined()

			const foundTask2 = await db.query.tasks.findFirst({ where: eq(schema.tasks.id, task2.id) })
			expect(foundTask2).toBeUndefined()

			const foundTaskMetrics1 = await db.query.taskMetrics.findFirst({ where: eq(schema.taskMetrics.id, taskMetrics1.id) })
			expect(foundTaskMetrics1).toBeUndefined()

			const foundTaskMetrics2 = await db.query.taskMetrics.findFirst({ where: eq(schema.taskMetrics.id, taskMetrics2.id) })
			expect(foundTaskMetrics2).toBeUndefined()
		})
	})
})
