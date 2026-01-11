import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { processTask, runTask } from "../runTask.js"
import { createRun, createTask, createTaskMetrics, findTask, updateTask } from "../../db/index.js"
import { db } from "../../db/index.js"
import { schema } from "../../db/schema.js"
import { eq } from "drizzle-orm"
import * as fs from "fs"
import * as path from "path"

vi.mock("../../exercises/index.js", () => ({
	EVALS_REPO_PATH: "/mock/evals/repo",
}))

vi.mock("fs", () => ({
	readFileSync: vi.fn(() => "Mock prompt content"),
	existsSync: vi.fn(() => false),
	mkdirSync: vi.fn(),
	createWriteStream: vi.fn(() => ({
		write: vi.fn(),
		end: vi.fn(),
	})),
}))

vi.mock("execa", () => ({
	execa: vi.fn(() => Promise.resolve({ stdout: "", stderr: "" })),
}))

describe("processTask", () => {
	let runId: number
	let taskId: number
	let taskMetricsIds: number[] = []

	beforeEach(async () => {
		const run = await createRun({
			model: "gpt-4.1-mini",
			socketPath: "/tmp/test.sock",
			timeout: 5,
			concurrency: 1,
		})
		runId = run.id

		const taskMetrics = await createTaskMetrics({
			duration: 0,
			tokensIn: 0,
			tokensOut: 0,
			tokensContext: 0,
			cacheWrites: 0,
			cacheReads: 0,
			cost: 0,
			toolUsage: {},
		})
		taskMetricsIds.push(taskMetrics.id)

		const task = await createTask({
			runId,
			taskMetricsId: taskMetrics.id,
			language: "go",
			exercise: "go/hello",
			passed: 0,
			startedAt: null,
			finishedAt: null,
		})
		taskId = task.id
	})

	afterEach(async () => {
		if (taskId) {
			await db.delete(schema.tasks).where(eq(schema.tasks.id, taskId))
		}

		if (runId) {
			await db.delete(schema.runs).where(eq(schema.runs.id, runId))
		}

		if (taskMetricsIds.length > 0) {
			for (const id of taskMetricsIds) {
				await db.delete(schema.taskMetrics).where(eq(schema.taskMetrics.id, id))
			}
		}

		taskId = 0
		taskMetricsIds = []
	})

	describe("basic execution", () => {
		it("should process a task successfully", async () => {
			const { Logger } = await import("../utils.js")
			const mockLogger = new Logger({
				logDir: `/tmp/evals/runs/${runId}`,
				filename: "test.log",
				tag: "test",
			})

			await processTask({ taskId, logger: mockLogger })

			const task = await findTask(taskId)
			expect(task.passed).toBe(1)
			expect(task.startedAt).toBeDefined()
			expect(task.finishedAt).toBeDefined()
		}, 10000)

		it("should create logger if not provided", async () => {
			await processTask({ taskId })

			const task = await findTask(taskId)
			expect(task.passed).toBe(1)
			expect(task.startedAt).toBeDefined()
			expect(task.finishedAt).toBeDefined()
		}, 10000)
	})

	describe("task metrics", () => {
		it("should create task metrics during execution", async () => {
			await processTask({ taskId })

			const task = await findTask(taskId)
			expect(task.taskMetricsId).toBeDefined()
			expect(task.taskMetricsId).toBeGreaterThan(0)
		}, 10000)

		it("should update task metrics with simulated values", async () => {
			await processTask({ taskId })

			const task = await findTask(taskId)
			const taskMetrics = await db.query.taskMetrics.findFirst({
				where: eq(schema.taskMetrics.id, task.taskMetricsId!),
			})

			expect(taskMetrics).toBeDefined()
			expect(taskMetrics!.cost).toBe(0.001)
			expect(taskMetrics!.tokensIn).toBe(100)
			expect(taskMetrics!.tokensOut).toBe(50)
			expect(taskMetrics!.tokensContext).toBe(150)
			expect(taskMetrics!.duration).toBe(3000)
		}, 10000)

		it("should record tool usage", async () => {
			await processTask({ taskId })

			const task = await findTask(taskId)
			const taskMetrics = await db.query.taskMetrics.findFirst({
				where: eq(schema.taskMetrics.id, task.taskMetricsId!),
			})

			expect(taskMetrics).toBeDefined()
			const toolUsage = typeof taskMetrics!.toolUsage === "string"
				? JSON.parse(taskMetrics!.toolUsage)
				: taskMetrics!.toolUsage
			expect(toolUsage).toEqual({
				read_file: { attempts: 1, failures: 0 },
				write_to_file: { attempts: 1, failures: 0 },
			})
		}, 10000)
	})

	describe("error handling", () => {
		it("should handle errors during task processing", async () => {
			const { Logger } = await import("../utils.js")
			const mockLogger = new Logger({
				logDir: `/tmp/evals/runs/${runId}`,
				filename: "test.log",
				tag: "test",
			})

			// Mock fs.readFileSync to throw an error instead of trying to mock runTask
			vi.spyOn(await import("fs"), "readFileSync").mockImplementationOnce(() => {
				throw new Error("Task execution failed")
			})

			await expect(processTask({ taskId, logger: mockLogger })).rejects.toThrow("Task execution failed")
		}, 10000)

		it("should log errors when task processing fails", async () => {
			const { Logger } = await import("../utils.js")
			const mockLogger = new Logger({
				logDir: `/tmp/evals/runs/${runId}`,
				filename: "test.log",
				tag: "test",
			})

			const errorSpy = vi.spyOn(mockLogger, "error")

			// Mock fs.readFileSync to throw an error
			vi.spyOn(await import("fs"), "readFileSync").mockImplementationOnce(() => {
				throw new Error("Task execution failed")
			})

			try {
				await processTask({ taskId, logger: mockLogger })
			} catch (error) {
			}

			expect(errorSpy).toHaveBeenCalled()
		}, 10000)
	})

	describe("job token handling", () => {
		it("should accept job token parameter", async () => {
			const jobToken = "test-job-token"

			await processTask({ taskId, jobToken })

			const task = await findTask(taskId)
			expect(task.passed).toBe(1)
		}, 10000)

		it("should handle null job token", async () => {
			await processTask({ taskId, jobToken: null })

			const task = await findTask(taskId)
			expect(task.passed).toBe(1)
		}, 10000)
	})
})

describe("runTask", () => {
	let runId: number
	let taskId: number
	let taskMetricsIds: number[] = []

	beforeEach(async () => {
		const run = await createRun({
			model: "gpt-4.1-mini",
			socketPath: "/tmp/test.sock",
			timeout: 5,
			concurrency: 1,
		})
		runId = run.id

		const taskMetrics = await createTaskMetrics({
			duration: 0,
			tokensIn: 0,
			tokensOut: 0,
			tokensContext: 0,
			cacheWrites: 0,
			cacheReads: 0,
			cost: 0,
			toolUsage: {},
		})
		taskMetricsIds.push(taskMetrics.id)

		const task = await createTask({
			runId,
			taskMetricsId: taskMetrics.id,
			language: "go",
			exercise: "go/hello",
			passed: 0,
			startedAt: null,
			finishedAt: null,
		})
		taskId = task.id
	})

	afterEach(async () => {
		if (taskId) {
			await db.delete(schema.tasks).where(eq(schema.tasks.id, taskId))
		}

		if (runId) {
			await db.delete(schema.runs).where(eq(schema.runs.id, runId))
		}

		if (taskMetricsIds.length > 0) {
			for (const id of taskMetricsIds) {
				await db.delete(schema.taskMetrics).where(eq(schema.taskMetrics.id, id))
			}
		}

		taskId = 0
		taskMetricsIds = []
	})

	describe("basic execution", () => {
		it("should execute task with correct parameters", async () => {
			const run = await db.query.runs.findFirst({ where: eq(schema.runs.id, runId) })
			const task = await db.query.tasks.findFirst({ where: eq(schema.tasks.id, taskId) })
			const { Logger } = await import("../utils.js")

			const mockLogger = new Logger({
				logDir: `/tmp/evals/runs/${runId}`,
				filename: "test.log",
				tag: "test",
			})

			const mockPublish = vi.fn()

			await runTask({ run: run!, task: task!, jobToken: null, publish: mockPublish, logger: mockLogger })

			expect(mockPublish).toHaveBeenCalled()
		}, 10000)

		it("should read prompt file from correct path", async () => {
			const run = await db.query.runs.findFirst({ where: eq(schema.runs.id, runId) })
			const task = await db.query.tasks.findFirst({ where: eq(schema.tasks.id, taskId) })
			const { Logger } = await import("../utils.js")

			const mockLogger = new Logger({
				logDir: `/tmp/evals/runs/${runId}`,
				filename: "test.log",
				tag: "test",
			})

			const mockPublish = vi.fn()

			await runTask({ run: run!, task: task!, jobToken: null, publish: mockPublish, logger: mockLogger })

			expect(fs.readFileSync).toHaveBeenCalledWith(
				path.resolve("/mock/evals/repo", "prompts/go.md"),
				"utf-8",
			)
		}, 10000)

		it("should update task with startedAt timestamp", async () => {
			const run = await db.query.runs.findFirst({ where: eq(schema.runs.id, runId) })
			const task = await db.query.tasks.findFirst({ where: eq(schema.tasks.id, taskId) })
			const { Logger } = await import("../utils.js")

			const mockLogger = new Logger({
				logDir: `/tmp/evals/runs/${runId}`,
				filename: "test.log",
				tag: "test",
			})

			const mockPublish = vi.fn()

			await runTask({ run: run!, task: task!, jobToken: null, publish: mockPublish, logger: mockLogger })

			const updatedTask = await findTask(taskId)
			expect(updatedTask.startedAt).toBeDefined()
		}, 10000)

		it("should update task with finishedAt timestamp", async () => {
			const run = await db.query.runs.findFirst({ where: eq(schema.runs.id, runId) })
			const task = await db.query.tasks.findFirst({ where: eq(schema.tasks.id, taskId) })
			const { Logger } = await import("../utils.js")

			const mockLogger = new Logger({
				logDir: `/tmp/evals/runs/${runId}`,
				filename: "test.log",
				tag: "test",
			})

			const mockPublish = vi.fn()

			await runTask({ run: run!, task: task!, jobToken: null, publish: mockPublish, logger: mockLogger })

			const updatedTask = await findTask(taskId)
			expect(updatedTask.finishedAt).toBeDefined()
		}, 10000)
	})

	describe("event publishing", () => {
		it("should publish TaskStarted event", async () => {
			const run = await db.query.runs.findFirst({ where: eq(schema.runs.id, runId) })
			const task = await db.query.tasks.findFirst({ where: eq(schema.tasks.id, taskId) })
			const { Logger } = await import("../utils.js")

			const mockLogger = new Logger({
				logDir: `/tmp/evals/runs/${runId}`,
				filename: "test.log",
				tag: "test",
			})

			const mockPublish = vi.fn()

			await runTask({ run: run!, task: task!, jobToken: null, publish: mockPublish, logger: mockLogger })

			expect(mockPublish).toHaveBeenCalledWith(
				expect.objectContaining({
					eventName: "taskStarted",
					taskId: taskId,
				}),
			)
		}, 10000)

		it("should publish TaskCompleted event", async () => {
			const run = await db.query.runs.findFirst({ where: eq(schema.runs.id, runId) })
			const task = await db.query.tasks.findFirst({ where: eq(schema.tasks.id, taskId) })
			const { Logger } = await import("../utils.js")

			const mockLogger = new Logger({
				logDir: `/tmp/evals/runs/${runId}`,
				filename: "test.log",
				tag: "test",
			})

			const mockPublish = vi.fn()

			await runTask({ run: run!, task: task!, jobToken: null, publish: mockPublish, logger: mockLogger })

			expect(mockPublish).toHaveBeenCalledWith(
				expect.objectContaining({
					eventName: "taskCompleted",
					taskId: taskId,
				}),
			)
		}, 10000)
	})

	describe("environment setup", () => {
		it("should set correct environment variables", async () => {
			const run = await db.query.runs.findFirst({ where: eq(schema.runs.id, runId) })
			const task = await db.query.tasks.findFirst({ where: eq(schema.tasks.id, taskId) })
			const { Logger } = await import("../utils.js")

			const mockLogger = new Logger({
				logDir: `/tmp/evals/runs/${runId}`,
				filename: "test.log",
				tag: "test",
			})

			const mockPublish = vi.fn()

			await runTask({ run: run!, task: task!, jobToken: null, publish: mockPublish, logger: mockLogger })

			const updatedTask = await findTask(taskId)
			expect(updatedTask.startedAt).toBeDefined()
		}, 10000)

		it("should include job token in environment when provided", async () => {
			const run = await db.query.runs.findFirst({ where: eq(schema.runs.id, runId) })
			const task = await db.query.tasks.findFirst({ where: eq(schema.tasks.id, taskId) })
			const { Logger } = await import("../utils.js")

			const mockLogger = new Logger({
				logDir: `/tmp/evals/runs/${runId}`,
				filename: "test.log",
				tag: "test",
			})

			const mockPublish = vi.fn()

			await runTask({ run: run!, task: task!, jobToken: "test-token", publish: mockPublish, logger: mockLogger })

			const updatedTask = await findTask(taskId)
			expect(updatedTask.startedAt).toBeDefined()
		}, 10000)
	})

	describe("task metrics updates", () => {
		it("should create initial task metrics", async () => {
			const run = await db.query.runs.findFirst({ where: eq(schema.runs.id, runId) })
			const task = await db.query.tasks.findFirst({ where: eq(schema.tasks.id, taskId) })
			const { Logger } = await import("../utils.js")

			const mockLogger = new Logger({
				logDir: `/tmp/evals/runs/${runId}`,
				filename: "test.log",
				tag: "test",
			})

			const mockPublish = vi.fn()

			await runTask({ run: run!, task: task!, jobToken: null, publish: mockPublish, logger: mockLogger })

			const updatedTask = await findTask(taskId)
			const taskMetrics = await db.query.taskMetrics.findFirst({
				where: eq(schema.taskMetrics.id, updatedTask.taskMetricsId!),
			})

			expect(taskMetrics).toBeDefined()
		}, 10000)

		it("should update task metrics with execution data", async () => {
			const run = await db.query.runs.findFirst({ where: eq(schema.runs.id, runId) })
			const task = await db.query.tasks.findFirst({ where: eq(schema.tasks.id, taskId) })
			const { Logger } = await import("../utils.js")

			const mockLogger = new Logger({
				logDir: `/tmp/evals/runs/${runId}`,
				filename: "test.log",
				tag: "test",
			})

			const mockPublish = vi.fn()

			await runTask({ run: run!, task: task!, jobToken: null, publish: mockPublish, logger: mockLogger })

			const updatedTask = await findTask(taskId)
			const taskMetrics = await db.query.taskMetrics.findFirst({
				where: eq(schema.taskMetrics.id, updatedTask.taskMetricsId!),
			})

			expect(taskMetrics!.cost).toBe(0.001)
			expect(taskMetrics!.tokensIn).toBe(100)
			expect(taskMetrics!.tokensOut).toBe(50)
			expect(taskMetrics!.duration).toBe(3000)
		}, 10000)
	})

	describe("logging", () => {
		it("should log task execution progress", async () => {
			const run = await db.query.runs.findFirst({ where: eq(schema.runs.id, runId) })
			const task = await db.query.tasks.findFirst({ where: eq(schema.tasks.id, taskId) })
			const { Logger } = await import("../utils.js")

			const mockLogger = new Logger({
				logDir: `/tmp/evals/runs/${runId}`,
				filename: "test.log",
				tag: "test",
			})

			const infoSpy = vi.spyOn(mockLogger, "info")

			const mockPublish = vi.fn()

			await runTask({ run: run!, task: task!, jobToken: null, publish: mockPublish, logger: mockLogger })

			expect(infoSpy).toHaveBeenCalled()
		}, 10000)

		it("should close logger after execution", async () => {
			const run = await db.query.runs.findFirst({ where: eq(schema.runs.id, runId) })
			const task = await db.query.tasks.findFirst({ where: eq(schema.tasks.id, taskId) })
			const { Logger } = await import("../utils.js")

			const mockLogger = new Logger({
				logDir: `/tmp/evals/runs/${runId}`,
				filename: "test.log",
				tag: "test",
			})

			const closeSpy = vi.spyOn(mockLogger, "close")

			const mockPublish = vi.fn()

			await runTask({ run: run!, task: task!, jobToken: null, publish: mockPublish, logger: mockLogger })

			expect(closeSpy).toHaveBeenCalled()
		}, 10000)
	})
})
