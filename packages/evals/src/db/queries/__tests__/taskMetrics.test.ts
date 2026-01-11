import { eq } from "drizzle-orm"

import { findTaskMetrics, createTaskMetrics, updateTaskMetrics } from "../taskMetrics.js"
import { RecordNotFoundError } from "../errors.js"
import { schema } from "../../schema.js"
import { client as db } from "../../db.js"

describe("taskMetrics", () => {
	let taskMetricsIds: number[] = []

	afterEach(async () => {
		if (taskMetricsIds.length > 0) {
			for (const id of taskMetricsIds) {
				await db.delete(schema.taskMetrics).where(eq(schema.taskMetrics.id, id))
			}
		}

		taskMetricsIds = []
	})

	describe("findTaskMetrics", () => {
		it("should find task metrics by id", async () => {
			const metrics = await createTaskMetrics({
				duration: 1000,
				tokensIn: 100,
				tokensOut: 50,
				tokensContext: 150,
				cacheWrites: 0,
				cacheReads: 0,
				cost: 0.001,
				toolUsage: {
					read_file: { attempts: 1, failures: 0 },
					apply_diff: { attempts: 2, failures: 1 },
				},
			})
			taskMetricsIds.push(metrics.id)

			const found = await findTaskMetrics(metrics.id)

			expect(found).toBeDefined()
			expect(found!.id).toBe(metrics.id)
			expect(found!.duration).toBe(1000)
			expect(found!.tokensIn).toBe(100)
			expect(found!.tokensOut).toBe(50)
			expect(found!.tokensContext).toBe(150)
			expect(found!.cacheWrites).toBe(0)
			expect(found!.cacheReads).toBe(0)
			expect(found!.cost).toBe(0.001)
			expect(found!.toolUsage).toEqual({
				read_file: { attempts: 1, failures: 0 },
				apply_diff: { attempts: 2, failures: 1 },
			})
		})

		it("should throw RecordNotFoundError for non-existent metrics", async () => {
			await expect(findTaskMetrics(999999)).rejects.toThrow(RecordNotFoundError)
		})
	})

	describe("createTaskMetrics", () => {
		it("should create new task metrics", async () => {
			const metrics = await createTaskMetrics({
				duration: 5000,
				tokensIn: 1000,
				tokensOut: 500,
				tokensContext: 1500,
				cacheWrites: 10,
				cacheReads: 5,
				cost: 0.01,
				toolUsage: {
					read_file: { attempts: 5, failures: 1 },
					apply_diff: { attempts: 3, failures: 0 },
					execute_command: { attempts: 2, failures: 0 },
				},
			})
			taskMetricsIds.push(metrics.id)

			expect(metrics).toBeDefined()
			expect(metrics.id).toBeDefined()
			expect(metrics.duration).toBe(5000)
			expect(metrics.tokensIn).toBe(1000)
			expect(metrics.tokensOut).toBe(500)
			expect(metrics.tokensContext).toBe(1500)
			expect(metrics.cacheWrites).toBe(10)
			expect(metrics.cacheReads).toBe(5)
			expect(metrics.cost).toBe(0.01)
			expect(metrics.toolUsage).toEqual({
				read_file: { attempts: 5, failures: 1 },
				apply_diff: { attempts: 3, failures: 0 },
				execute_command: { attempts: 2, failures: 0 },
			})
			expect(metrics.createdAt).toBeDefined()
		})

		it("should create metrics with minimal tool usage", async () => {
			const metrics = await createTaskMetrics({
				duration: 100,
				tokensIn: 10,
				tokensOut: 5,
				tokensContext: 15,
				cacheWrites: 0,
				cacheReads: 0,
				cost: 0.0001,
				toolUsage: {},
			})
			taskMetricsIds.push(metrics.id)

			expect(metrics).toBeDefined()
			expect(metrics.toolUsage).toEqual({})
		})
	})

	describe("updateTaskMetrics", () => {
		it("should update task metrics", async () => {
			const metrics = await createTaskMetrics({
				duration: 1000,
				tokensIn: 100,
				tokensOut: 50,
				tokensContext: 150,
				cacheWrites: 0,
				cacheReads: 0,
				cost: 0.001,
				toolUsage: { read_file: { attempts: 1, failures: 0 } },
			})
			taskMetricsIds.push(metrics.id)

			const updated = await updateTaskMetrics(metrics.id, {
				duration: 2000,
				tokensIn: 200,
				tokensOut: 100,
				tokensContext: 300,
				cost: 0.002,
			})

			expect(updated).toBeDefined()
			expect(updated!.duration).toBe(2000)
			expect(updated!.tokensIn).toBe(200)
			expect(updated!.tokensOut).toBe(100)
			expect(updated!.tokensContext).toBe(300)
			expect(updated!.cost).toBe(0.002)
		})

		it("should update tool usage", async () => {
			const metrics = await createTaskMetrics({
				duration: 1000,
				tokensIn: 100,
				tokensOut: 50,
				tokensContext: 150,
				cacheWrites: 0,
				cacheReads: 0,
				cost: 0.001,
				toolUsage: { read_file: { attempts: 1, failures: 0 } },
			})
			taskMetricsIds.push(metrics.id)

			const updated = await updateTaskMetrics(metrics.id, {
				toolUsage: {
					read_file: { attempts: 5, failures: 1 },
					apply_diff: { attempts: 3, failures: 0 },
				},
			})

			expect(updated).toBeDefined()
			expect(updated!.toolUsage).toEqual({
				read_file: { attempts: 5, failures: 1 },
				apply_diff: { attempts: 3, failures: 0 },
			})
		})

		it("should throw RecordNotFoundError for non-existent metrics", async () => {
			await expect(updateTaskMetrics(999999, { duration: 2000 })).rejects.toThrow(RecordNotFoundError)
		})
	})
})
