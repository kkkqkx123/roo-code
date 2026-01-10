import { eq, sql } from "drizzle-orm"

import { RecordNotFoundError, RecordNotCreatedError } from "./errors.js"
import type { InsertTaskMetrics, UpdateTaskMetrics } from "../schema.js"
import { taskMetrics } from "../schema.js"
import { client as db } from "../db.js"

export const findTaskMetrics = async (id: number) => {
	const run = await db.query.taskMetrics.findFirst({ where: eq(taskMetrics.id, id) })

	if (!run) {
		throw new RecordNotFoundError()
	}

	return run
}

export const createTaskMetrics = async (args: InsertTaskMetrics) => {
	const records = await db
		.insert(taskMetrics)
		.values({
			duration: args.duration,
			tokensIn: args.tokensIn,
			tokensOut: args.tokensOut,
			tokensContext: args.tokensContext,
			cacheWrites: args.cacheWrites,
			cacheReads: args.cacheReads,
			cost: args.cost,
			toolUsage: sql`${JSON.stringify(args.toolUsage)}`,
			createdAt: new Date().toISOString(),
		})
		.returning()

	const record = records[0]

	if (!record) {
		throw new RecordNotCreatedError()
	}

	return record
}

export const updateTaskMetrics = async (id: number, values: UpdateTaskMetrics) => {
	const updateValues: any = { ...values }
	if (values.toolUsage !== undefined) {
		updateValues.toolUsage = sql`${JSON.stringify(values.toolUsage)}`
	}

	const records = await db.update(taskMetrics).set(updateValues).where(eq(taskMetrics.id, id)).returning()
	const record = records[0]

	if (!record) {
		throw new RecordNotFoundError()
	}

	return record
}
