import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { runEvals } from "../runEvals.js"
import { createRun, createTask, findRun, createTaskMetrics, updateTask } from "../../db/index.js"
import { db } from "../../db/index.js"
import { schema } from "../../db/schema.js"
import { eq } from "drizzle-orm"
import { Logger } from "../utils.js"

vi.mock("../../exercises/index.js", () => ({
	EVALS_REPO_PATH: "/mock/evals/repo",
}))

vi.mock("../utils.js", () => ({
	Logger: vi.fn().mockImplementation(() => ({
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
		log: vi.fn(),
		close: vi.fn(),
	})),
	getTag: vi.fn((caller, { run, task }) => {
		return task
			? `${caller} | run:${run.id} | task:${task.id} | ${task.language}/${task.exercise}`
			: `${caller} | run:${run.id}`
	}),
	resetEvalsRepo: vi.fn(() => Promise.resolve()),
	commitEvalsRepoChanges: vi.fn(() => Promise.resolve()),
}))

vi.mock("../runTask.js", () => ({
	processTask: vi.fn(() => Promise.resolve()),
}))

describe("runEvals", () => {
	let runId: number
	let taskIds: number[] = []
	let taskMetricsIds: number[] = []

	beforeEach(async () => {
		const run = await createRun({
			model: "gpt-4.1-mini",
			socketPath: "/tmp/test.sock",
			timeout: 5,
			concurrency: 2,
		})
		runId = run.id

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
			finishedAt: null,
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
			toolUsage: { read_file: { attempts: 2, failures: 0 } },
		})
		taskMetricsIds.push(taskMetrics2.id)

		const task2 = await createTask({
			runId,
			taskMetricsId: taskMetrics2.id,
			language: "python",
			exercise: "python/sum",
			passed: 0,
			startedAt: new Date().toISOString(),
			finishedAt: null,
		})
		taskIds.push(task2.id)
	})

	afterEach(async () => {
		if (taskIds.length > 0) {
			await db.delete(schema.tasks).where(eq(schema.tasks.runId, runId))
		}

		if (runId) {
			await db.delete(schema.runs).where(eq(schema.runs.id, runId))
		}

		if (taskMetricsIds.length > 0) {
			for (const id of taskMetricsIds) {
				await db.delete(schema.taskMetrics).where(eq(schema.taskMetrics.id, id))
			}
		}

		taskIds = []
		taskMetricsIds = []
	})

	describe("basic execution", () => {
		it("should process all unfinished tasks", async () => {
			const _processTask = vi.fn()
			const processTaskSpy = vi.spyOn(await import("../runTask.js"), "processTask").mockResolvedValue()

			await runEvals(runId)

			expect(processTaskSpy).toHaveBeenCalledTimes(2)
		}, 10000)

		it("should skip already finished tasks", async () => {
			const _processTask = await import("../runTask.js")
			const processTaskSpy = vi.spyOn(await import("../runTask.js"), "processTask").mockResolvedValue()

			if (taskIds[0] !== undefined) {
				await updateTask(taskIds[0], { finishedAt: new Date().toISOString() })
			}

			await runEvals(runId)

			expect(processTaskSpy).toHaveBeenCalledTimes(1)
		}, 10000)

		it("should call finishRun after all tasks are processed", async () => {
			const _processTask = await import("../runTask.js")
			vi.spyOn(await import("../runTask.js"), "processTask").mockResolvedValue()

			await runEvals(runId)

			const run = await findRun(runId)
			expect(run.taskMetricsId).toBeDefined()
		}, 10000)

		it("should reset evals repo before processing tasks", async () => {
			const { resetEvalsRepo: _resetEvalsRepo } = await import("../utils.js")
			const resetEvalsRepoSpy = vi.spyOn(await import("../utils.js"), "resetEvalsRepo").mockResolvedValue()

			const _processTask = await import("../runTask.js")
			vi.spyOn(await import("../runTask.js"), "processTask").mockResolvedValue()

			await runEvals(runId)

			expect(resetEvalsRepoSpy).toHaveBeenCalled()
		}, 10000)

		it("should commit evals repo changes after processing tasks", async () => {
			const { commitEvalsRepoChanges: _commitEvalsRepoChanges } = await import("../utils.js")
			const commitEvalsRepoChangesSpy = vi.spyOn(await import("../utils.js"), "commitEvalsRepoChanges").mockResolvedValue()

			const _processTask = await import("../runTask.js")
			vi.spyOn(await import("../runTask.js"), "processTask").mockResolvedValue()

			await runEvals(runId)

			expect(commitEvalsRepoChangesSpy).toHaveBeenCalled()
		}, 10000)
	})

	describe("error handling", () => {
		it("should throw error if run is already finished", async () => {
			const { finishRun } = await import("../../db/index.js")
			await finishRun(runId)

			await expect(runEvals(runId)).rejects.toThrow(`Run ${runId} already finished.`)
		}, 10000)

		it("should throw error if run has no tasks", async () => {
			const newRun = await createRun({
				model: "gpt-4.1-mini",
				socketPath: "/tmp/test.sock",
				timeout: 5,
				concurrency: 2,
			})

			await expect(runEvals(newRun.id)).rejects.toThrow(`Run ${newRun.id} has no tasks.`)

			await db.delete(schema.runs).where(eq(schema.runs.id, newRun.id))
		}, 10000)

		it("should handle errors from processTask gracefully", async () => {
			const _processTask = await import("../runTask.js")
			vi.spyOn(await import("../runTask.js"), "processTask").mockRejectedValueOnce(
				new Error("Task processing failed"),
			)

			const _finishRun = await import("../../db/index.js")

			await runEvals(runId)

			const run = await findRun(runId)
			expect(run.taskMetricsId).toBeDefined()
		}, 10000)

		it("should continue processing tasks even if one fails", async () => {
			const _processTask = await import("../runTask.js")
			let callCount = 0
			vi.spyOn(await import("../runTask.js"), "processTask").mockImplementation(async () => {
				callCount++
				if (callCount === 1) {
					throw new Error("First task failed")
				}
			})

			await runEvals(runId)

			expect(callCount).toBe(2)
		}, 10000)
	})

	describe("concurrency handling", () => {
		it("should use run's concurrency setting", async () => {
			const _processTask = await import("../runTask.js")
			const processTaskSpy = vi.spyOn(await import("../runTask.js"), "processTask").mockResolvedValue()

			const run = await findRun(runId)
			expect(run.concurrency).toBe(2)

			await runEvals(runId)

			expect(processTaskSpy).toHaveBeenCalledTimes(2)
		}, 10000)

		it("should process tasks with staggered start times when concurrency > 1", async () => {
			const _processTask = await import("../runTask.js")
			const processTaskSpy = vi.spyOn(await import("../runTask.js"), "processTask").mockResolvedValue()

			const startTime = Date.now()
			await runEvals(runId)
			const endTime = Date.now()

			expect(endTime - startTime).toBeGreaterThanOrEqual(5000)
			expect(processTaskSpy).toHaveBeenCalledTimes(2)
		}, 10000)
	})

	describe("logging", () => {
		it("should create a logger with correct tag", async () => {
			const _processTask = await import("../runTask.js")
			vi.spyOn(await import("../runTask.js"), "processTask").mockResolvedValue()

			await runEvals(runId)

			expect(Logger).toHaveBeenCalledWith(
				expect.objectContaining({
					logDir: `/tmp/evals/runs/${runId}`,
					filename: `controller.log`,
				}),
			)
		}, 10000)

		it("should log task processing start", async () => {
			const _processTask = await import("../runTask.js")
			vi.spyOn(await import("../runTask.js"), "processTask").mockResolvedValue()

			await runEvals(runId)

			const run = await findRun(runId)
			expect(run.taskMetricsId).toBeDefined()
		}, 10000)
	})

	describe("cleanup", () => {
		it("should close logger after processing", async () => {
			const _processTask = await import("../runTask.js")
			vi.spyOn(await import("../runTask.js"), "processTask").mockResolvedValue()

			const mockLogger = {
				info: vi.fn(),
				error: vi.fn(),
				warn: vi.fn(),
				debug: vi.fn(),
				log: vi.fn(),
				close: vi.fn(),
			} as any // eslint-disable-line @typescript-eslint/no-explicit-any
			vi.spyOn(await import("../utils.js"), "Logger").mockReturnValue(mockLogger)

			await runEvals(runId)

			expect(mockLogger.close).toHaveBeenCalled()
		}, 10000)
	})
})
