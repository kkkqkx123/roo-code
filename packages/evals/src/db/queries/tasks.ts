import { and, asc, eq, sql } from "drizzle-orm"

import type { ExerciseLanguage } from "../../exercises/index.js"

import { RecordNotFoundError, RecordNotCreatedError } from "./errors.js"
import type { InsertTask, UpdateTask } from "../schema.js"
import { tasks, schema } from "../schema.js"
import { client as db } from "../db.js"

export const findTask = async (id: number) => {
	const run = await db.query.tasks.findFirst({ where: eq(tasks.id, id) })

	if (!run) {
		throw new RecordNotFoundError()
	}

	return run
}

export const createTask = async (args: InsertTask) => {
	const records = await db
		.insert(tasks)
		.values({
			...args,
			createdAt: new Date().toISOString(),
		})
		.returning()

	const record = records[0]

	if (!record) {
		throw new RecordNotCreatedError()
	}

	return record
}

export const updateTask = async (id: number, values: UpdateTask) => {
	const records = await db.update(tasks).set(values).where(eq(tasks.id, id)).returning()
	const record = records[0]

	if (!record) {
		throw new RecordNotFoundError()
	}

	return record
}

type GetTask = {
	runId: number
	language: ExerciseLanguage
	exercise: string
}

export const getTask = async ({ runId, language, exercise }: GetTask) => {
	const task = await db.query.tasks.findFirst({
		where: and(eq(tasks.runId, runId), eq(tasks.language, language), eq(tasks.exercise, exercise)),
	})
	return task ?? null
}

export const getTasks = async (runId: number) =>
	db.query.tasks.findMany({
		where: eq(tasks.runId, runId),
		with: { taskMetrics: true },
		orderBy: asc(tasks.id),
	})

export const getLanguageScores = async () => {
	const records = await db
		.select({
			runId: tasks.runId,
			language: tasks.language,
			score: sql<number>`cast(sum(case when ${tasks.passed} = 1 then 1 else 0 end) as float) / count(*)`,
		})
		.from(tasks)
		.groupBy(tasks.runId, tasks.language)

	const results: Record<number, Record<ExerciseLanguage, number>> = {}

	// Initialize with all runs that have tasks
	for (const { runId, language, score } of records) {
		if (!results[runId]) {
			results[runId] = { go: 0, java: 0, javascript: 0, python: 0, rust: 0 }
		}

		results[runId][language] = score
	}

	// Get all unique run IDs from tasks to ensure we include runs with zero scores
	const allRunIds = await db.select({ runId: tasks.runId }).from(tasks).groupBy(tasks.runId)
	for (const { runId } of allRunIds) {
		if (!results[runId]) {
			results[runId] = { go: 0, java: 0, javascript: 0, python: 0, rust: 0 }
		}
	}

	// Also get all run IDs from the runs table to include runs with no tasks
	const allRuns = await db.select({ id: schema.runs.id }).from(schema.runs)
	for (const { id } of allRuns) {
		if (!results[id]) {
			results[id] = { go: 0, java: 0, javascript: 0, python: 0, rust: 0 }
		}
	}

	return results
}
