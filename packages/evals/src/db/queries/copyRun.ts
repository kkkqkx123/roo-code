import { eq } from "drizzle-orm"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"

import type { InsertRun, InsertTask, InsertTaskMetrics, InsertToolError } from "../schema.js"
import { schema } from "../schema.js"

import { RecordNotFoundError, RecordNotCreatedError } from "./errors.js"

export const copyRun = async ({
	sourceDb,
	targetDb,
	runId,
}: {
	sourceDb: BetterSQLite3Database<typeof schema>
	targetDb: BetterSQLite3Database<typeof schema>
	runId: number
}) => {
	const sourceRun = await sourceDb.query.runs.findFirst({
		where: eq(schema.runs.id, runId),
		with: { taskMetrics: true },
	})

	if (!sourceRun) {
		throw new RecordNotFoundError(`Run with ID ${runId} not found`)
	}

	let newRunTaskMetricsId: number | null = null

	if (sourceRun.taskMetrics) {
		// Parse toolUsage if it's stored as a string, then stringify for storage
		const toolUsage = typeof sourceRun.taskMetrics.toolUsage === 'string' 
			? JSON.parse(sourceRun.taskMetrics.toolUsage) 
			: sourceRun.taskMetrics.toolUsage

		const newRunTaskMetrics = await targetDb
			.insert(schema.taskMetrics)
			.values({
				tokensIn: sourceRun.taskMetrics.tokensIn,
				tokensOut: sourceRun.taskMetrics.tokensOut,
				tokensContext: sourceRun.taskMetrics.tokensContext,
				cacheWrites: sourceRun.taskMetrics.cacheWrites,
				cacheReads: sourceRun.taskMetrics.cacheReads,
				cost: sourceRun.taskMetrics.cost,
				duration: sourceRun.taskMetrics.duration,
				toolUsage: JSON.stringify(toolUsage) as any,
				createdAt: new Date().toISOString(),
			})
			.returning()

		const createdRunTaskMetrics = newRunTaskMetrics[0]

		if (!createdRunTaskMetrics) {
			throw new RecordNotCreatedError("Failed to create run taskMetrics")
		}

		newRunTaskMetricsId = createdRunTaskMetrics.id
	}

	// Handle settings field - parse if it's a string, keep as object for type safety
	const settings = sourceRun.settings ? (
		typeof sourceRun.settings === 'string' 
			? JSON.parse(sourceRun.settings) 
			: sourceRun.settings
	) : undefined

	// Copy all fields, ensuring required fields are provided
	const runData: InsertRun = {
		taskMetricsId: newRunTaskMetricsId,
		model: sourceRun.model,
		name: sourceRun.name,
		description: sourceRun.description,
		contextWindow: sourceRun.contextWindow,
		inputPrice: sourceRun.inputPrice,
		outputPrice: sourceRun.outputPrice,
		cacheWritesPrice: sourceRun.cacheWritesPrice,
		cacheReadsPrice: sourceRun.cacheReadsPrice,
		settings: settings,
		jobToken: sourceRun.jobToken,
		pid: sourceRun.pid,
		socketPath: sourceRun.socketPath,
		concurrency: sourceRun.concurrency,
		timeout: sourceRun.timeout,
		passed: sourceRun.passed,
		failed: sourceRun.failed,
	}

	const newRuns = await targetDb
		.insert(schema.runs)
		.values({ ...runData, createdAt: new Date().toISOString() })
		.returning()

	const newRun = newRuns[0]

	if (!newRun) {
		throw new RecordNotCreatedError("Failed to create run")
	}

	const newRunId = newRun.id

	const sourceTasks = await sourceDb.query.tasks.findMany({
		where: eq(schema.tasks.runId, runId),
		with: { taskMetrics: true },
	})

	const taskIdMapping = new Map<number, number>()

	for (const sourceTask of sourceTasks) {
		let newTaskMetricsId: number | null = null

		if (sourceTask.taskMetrics) {
			// Parse toolUsage if it's stored as a string, keep as object for now
			const toolUsage = typeof sourceTask.taskMetrics.toolUsage === 'string' 
				? JSON.parse(sourceTask.taskMetrics.toolUsage) 
				: sourceTask.taskMetrics.toolUsage

			const taskMetricsData = {
				tokensIn: sourceTask.taskMetrics.tokensIn,
				tokensOut: sourceTask.taskMetrics.tokensOut,
				tokensContext: sourceTask.taskMetrics.tokensContext,
				cacheWrites: sourceTask.taskMetrics.cacheWrites,
				cacheReads: sourceTask.taskMetrics.cacheReads,
				cost: sourceTask.taskMetrics.cost,
				duration: sourceTask.taskMetrics.duration,
				toolUsage: JSON.stringify(toolUsage),
			}

			const newTaskMetrics = await targetDb
				.insert(schema.taskMetrics)
				.values({
					tokensIn: sourceTask.taskMetrics.tokensIn,
					tokensOut: sourceTask.taskMetrics.tokensOut,
					tokensContext: sourceTask.taskMetrics.tokensContext,
					cacheWrites: sourceTask.taskMetrics.cacheWrites,
					cacheReads: sourceTask.taskMetrics.cacheReads,
					cost: sourceTask.taskMetrics.cost,
					duration: sourceTask.taskMetrics.duration,
					toolUsage: JSON.stringify(toolUsage) as any,
					createdAt: new Date().toISOString(),
				})
				.returning()

			const createdTaskMetrics = newTaskMetrics[0]

			if (!createdTaskMetrics) {
				throw new RecordNotCreatedError("Failed to create task taskMetrics")
			}

			newTaskMetricsId = createdTaskMetrics.id
		}

		// Filter out undefined values to avoid parameter binding issues
		const taskData: InsertTask = Object.fromEntries(
			Object.entries({
				runId: newRunId,
				taskMetricsId: newTaskMetricsId,
				language: sourceTask.language,
				exercise: sourceTask.exercise,
				passed: sourceTask.passed,
				startedAt: sourceTask.startedAt,
				finishedAt: sourceTask.finishedAt,
			}).filter(([_, value]) => value !== undefined)
		) as InsertTask

		const newTasks = await targetDb
			.insert(schema.tasks)
			.values({ ...taskData, createdAt: new Date().toISOString() })
			.returning()

		const newTask = newTasks[0]

		if (!newTask) {
			throw new RecordNotCreatedError("Failed to create task")
		}

		taskIdMapping.set(sourceTask.id, newTask.id)
	}

	for (const [oldTaskId, newTaskId] of taskIdMapping) {
		const sourceTaskToolErrors = await sourceDb.query.toolErrors.findMany({
			where: eq(schema.toolErrors.taskId, oldTaskId),
		})

		for (const sourceToolError of sourceTaskToolErrors) {
			const toolErrorData: InsertToolError = {
				runId: newRunId,
				taskId: newTaskId,
				toolName: sourceToolError.toolName,
				error: sourceToolError.error,
			}

			await targetDb.insert(schema.toolErrors).values({
				...toolErrorData,
				createdAt: new Date().toISOString(),
			})
		}
	}

	const sourceRunToolErrors = await sourceDb.query.toolErrors.findMany({
		where: eq(schema.toolErrors.runId, runId),
	})

	for (const sourceToolError of sourceRunToolErrors) {
		if (sourceToolError.taskId && taskIdMapping.has(sourceToolError.taskId)) {
			continue
		}

		const toolErrorData: InsertToolError = {
			runId: newRunId,
			taskId: sourceToolError.taskId ? taskIdMapping.get(sourceToolError.taskId) || null : null,
			toolName: sourceToolError.toolName,
			error: sourceToolError.error,
		}

		await targetDb.insert(schema.toolErrors).values({ ...toolErrorData, createdAt: new Date().toISOString() })
	}

	return newRunId
}
