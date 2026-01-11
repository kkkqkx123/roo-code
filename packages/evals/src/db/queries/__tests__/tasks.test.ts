import { eq } from "drizzle-orm"

import { findTask, createTask, updateTask, getTask, getTasks, getLanguageScores } from "../tasks.js"
import { createRun } from "../runs.js"
import { createTaskMetrics } from "../taskMetrics.js"
import { RecordNotFoundError } from "../errors.js"
import { schema } from "../../schema.js"
import { client as db } from "../../db.js"

describe("tasks", () => {
	let runId: number
	let taskIds: number[] = []
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
		if (taskIds.length > 0) {
			await db.delete(schema.tasks).where(eq(schema.tasks.runId, runId))
		}

		await db.delete(schema.runs).where(eq(schema.runs.id, runId))

		if (taskMetricsIds.length > 0) {
			for (const id of taskMetricsIds) {
				await db.delete(schema.taskMetrics).where(eq(schema.taskMetrics.id, id))
			}
		}

		taskIds = []
		taskMetricsIds = []
	})

	describe("findTask", () => {
		it("should find a task by id", async () => {
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
				passed: 1,
				startedAt: new Date().toISOString(),
				finishedAt: new Date().toISOString(),
			})
			taskIds.push(task.id)

			const found = await findTask(task.id)

			expect(found).toBeDefined()
			if (found) {
				expect(found.id).toBe(task.id)
				expect(found.language).toBe("go")
				expect(found.exercise).toBe("go/hello")
				expect(found.passed).toBe(1)
			}
		})

		it("should throw RecordNotFoundError for non-existent task", async () => {
			await expect(findTask(999999)).rejects.toThrow(RecordNotFoundError)
		})
	})

	describe("createTask", () => {
		it("should create a new task", async () => {
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
				exercise: "python/hello-world",
				passed: 1,
				startedAt: new Date().toISOString(),
				finishedAt: new Date().toISOString(),
			})
			taskIds.push(task.id)

			expect(task).toBeDefined()
			expect(task.id).toBeDefined()
			expect(task.runId).toBe(runId)
			expect(task.language).toBe("python")
			expect(task.exercise).toBe("python/hello-world")
			expect(task.passed).toBe(1)
		})

		it("should create a task without task metrics", async () => {
			const task = await createTask({
				runId,
				taskMetricsId: null,
				language: "rust",
				exercise: "rust/hello",
				passed: 0,
				startedAt: new Date().toISOString(),
				finishedAt: new Date().toISOString(),
			})
			taskIds.push(task.id)

			expect(task).toBeDefined()
			expect(task.taskMetricsId).toBeNull()
		})
	})

	describe("updateTask", () => {
		it("should update a task", async () => {
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
			taskIds.push(task.id)

			const updated = await updateTask(task.id, { passed: 1 })

			expect(updated).toBeDefined()
			if (updated) {
				expect(updated.passed).toBe(1)
			}
		})

		it("should throw RecordNotFoundError for non-existent task", async () => {
			await expect(updateTask(999999, { passed: 1 })).rejects.toThrow(RecordNotFoundError)
		})
	})

	describe("getTask", () => {
		it("should get a task by runId, language, and exercise", async () => {
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
				passed: 1,
				startedAt: new Date().toISOString(),
				finishedAt: new Date().toISOString(),
			})
			taskIds.push(task.id)

			const found = await getTask({
				runId,
				language: "javascript",
				exercise: "javascript/hello",
			})

			expect(found).toBeDefined()
			if (found) {
				expect(found.id).toBe(task.id)
			}
		})

		it("should return null for non-existent task", async () => {
			const found = await getTask({
				runId,
				language: "go",
				exercise: "go/nonexistent",
			})

			expect(found).toBeNull()
		})
	})

	describe("getTasks", () => {
		it("should get all tasks for a run", async () => {
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

			const task1 = await createTask({
				runId,
				taskMetricsId: taskMetrics1.id,
				language: "go",
				exercise: "go/hello",
				passed: 1,
				startedAt: new Date().toISOString(),
				finishedAt: new Date().toISOString(),
			})
			taskIds.push(task1.id)

			const taskMetrics2 = await createTaskMetrics({
				duration: 2000,
				tokensIn: 200,
				tokensOut: 100,
				tokensContext: 300,
				cacheWrites: 0,
				cacheReads: 0,
				cost: 0.002,
				toolUsage: { apply_diff: { attempts: 2, failures: 0 } },
			})
			taskMetricsIds.push(taskMetrics2.id)

			const task2 = await createTask({
				runId,
				taskMetricsId: taskMetrics2.id,
				language: "python",
				exercise: "python/hello",
				passed: 0,
				startedAt: new Date().toISOString(),
				finishedAt: new Date().toISOString(),
			})
			taskIds.push(task2.id)

			const tasks = await getTasks(runId)

			expect(tasks).toHaveLength(2)
			expect(tasks[0]?.language).toBe("go")
			expect(tasks[1]?.language).toBe("python")
			expect(tasks[0]?.taskMetrics).toBeDefined()
			expect(tasks[1]?.taskMetrics).toBeDefined()
		})

		it("should return empty array for run with no tasks", async () => {
			const tasks = await getTasks(runId)

			expect(tasks).toHaveLength(0)
		})
	})

	describe("getLanguageScores", () => {
		it("should calculate language scores for a run", async () => {
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

			await createTask({
				runId,
				taskMetricsId: taskMetrics1.id,
				language: "go",
				exercise: "go/hello",
				passed: 1,
				startedAt: new Date().toISOString(),
				finishedAt: new Date().toISOString(),
			})

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

			await createTask({
				runId,
				taskMetricsId: taskMetrics2.id,
				language: "go",
				exercise: "go/world",
				passed: 0,
				startedAt: new Date().toISOString(),
				finishedAt: new Date().toISOString(),
			})

			const taskMetrics3 = await createTaskMetrics({
				duration: 1000,
				tokensIn: 100,
				tokensOut: 50,
				tokensContext: 150,
				cacheWrites: 0,
				cacheReads: 0,
				cost: 0.001,
				toolUsage: { read_file: { attempts: 1, failures: 0 } },
			})
			taskMetricsIds.push(taskMetrics3.id)

			await createTask({
				runId,
				taskMetricsId: taskMetrics3.id,
				language: "python",
				exercise: "python/hello",
				passed: 1,
				startedAt: new Date().toISOString(),
				finishedAt: new Date().toISOString(),
			})

			const scores = await getLanguageScores()

			expect(scores[runId]).toBeDefined()
			expect(scores[runId]?.go).toBe(0.5)
			expect(scores[runId]?.python).toBe(1.0)
		})

		it("should return zero scores for languages with no tasks", async () => {
			const scores = await getLanguageScores()

			expect(scores[runId]).toBeDefined()
			expect(scores[runId]?.go).toBe(0)
			expect(scores[runId]?.python).toBe(0)
			expect(scores[runId]?.javascript).toBe(0)
			expect(scores[runId]?.rust).toBe(0)
			expect(scores[runId]?.java).toBe(0)
		})
	})
})
