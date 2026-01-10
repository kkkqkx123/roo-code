import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core"
import { relations } from "drizzle-orm"

import type { RooCodeSettings, ToolName, ToolUsage } from "@roo-code/types"

import type { ExerciseLanguage } from "../exercises/index.js"

/**
 * runs
 */

export const runs = sqliteTable("runs", {
	id: integer().primaryKey({ autoIncrement: true }),
	taskMetricsId: integer("task_metrics_id").references(() => taskMetrics.id),
	model: text().notNull(),
	name: text(),
	description: text(),
	contextWindow: integer(),
	inputPrice: real(),
	outputPrice: real(),
	cacheWritesPrice: real(),
	cacheReadsPrice: real(),
	settings: text().$type<RooCodeSettings>(), // SQLite uses text for JSON storage
	jobToken: text(), // Optional for local runs
	pid: integer(),
	socketPath: text("socket_path"), // Optional for local runs
	concurrency: integer().default(2).notNull(),
	timeout: integer().default(5).notNull(),
	passed: integer().default(0).notNull(),
	failed: integer().default(0).notNull(),
	createdAt: text("created_at").notNull().default(("CURRENT_TIMESTAMP")), // SQLite uses text for timestamps
})

export const runsRelations = relations(runs, ({ one }) => ({
	taskMetrics: one(taskMetrics, { fields: [runs.taskMetricsId], references: [taskMetrics.id] }),
}))

export type Run = typeof runs.$inferSelect

export type InsertRun = Omit<typeof runs.$inferInsert, "id" | "createdAt">

export type UpdateRun = Partial<Omit<Run, "id" | "createdAt">>

/**
 * tasks
 */

export const tasks = sqliteTable(
	"tasks",
	{
		id: integer().primaryKey({ autoIncrement: true }),
		runId: integer("run_id")
			.references(() => runs.id, { onDelete: "cascade" })
			.notNull(),
		taskMetricsId: integer("task_metrics_id").references(() => taskMetrics.id),
		language: text().notNull().$type<ExerciseLanguage>(),
		exercise: text().notNull(),
		iteration: integer().default(1).notNull(),
		passed: integer(), // SQLite doesn't have boolean, use integer (0 or 1)
		startedAt: text("started_at"),
		finishedAt: text("finished_at"),
		createdAt: text("created_at").notNull().default(("CURRENT_TIMESTAMP")),
	},
	(table) => [
		uniqueIndex("tasks_language_exercise_iteration_idx").on(
			table.runId,
			table.language,
			table.exercise,
			table.iteration,
		),
	],
)

export const tasksRelations = relations(tasks, ({ one }) => ({
	run: one(runs, { fields: [tasks.runId], references: [runs.id] }),
	taskMetrics: one(taskMetrics, { fields: [tasks.taskMetricsId], references: [taskMetrics.id] }),
}))

export type Task = typeof tasks.$inferSelect

export type InsertTask = Omit<typeof tasks.$inferInsert, "id" | "createdAt">

export type UpdateTask = Partial<Omit<Task, "id" | "createdAt">>

/**
 * taskMetrics
 */

export const taskMetrics = sqliteTable("taskMetrics", {
	id: integer().primaryKey({ autoIncrement: true }),
	tokensIn: integer("tokens_in").notNull(),
	tokensOut: integer("tokens_out").notNull(),
	tokensContext: integer("tokens_context").notNull(),
	cacheWrites: integer("cache_writes").notNull(),
	cacheReads: integer("cache_reads").notNull(),
	cost: real().notNull(),
	duration: integer().notNull(),
	toolUsage: text("tool_usage").$type<ToolUsage>(), // SQLite uses text for JSON storage
	createdAt: text("created_at").notNull().default(("CURRENT_TIMESTAMP")),
})

export type TaskMetrics = typeof taskMetrics.$inferSelect

export type InsertTaskMetrics = Omit<typeof taskMetrics.$inferInsert, "id" | "createdAt">

export type UpdateTaskMetrics = Partial<Omit<TaskMetrics, "id" | "createdAt">>

/**
 * toolErrors
 */

export const toolErrors = sqliteTable("toolErrors", {
	id: integer().primaryKey({ autoIncrement: true }),
	runId: integer("run_id").references(() => runs.id),
	taskId: integer("task_id").references(() => tasks.id),
	toolName: text("tool_name").notNull().$type<ToolName>(),
	error: text().notNull(),
	createdAt: text("created_at").notNull().default(("CURRENT_TIMESTAMP")),
})

export const toolErrorsRelations = relations(toolErrors, ({ one }) => ({
	run: one(runs, { fields: [toolErrors.runId], references: [runs.id] }),
	task: one(tasks, { fields: [toolErrors.taskId], references: [tasks.id] }),
}))

export type ToolError = typeof toolErrors.$inferSelect

export type InsertToolError = Omit<typeof toolErrors.$inferInsert, "id" | "createdAt">

export type UpdateToolError = Partial<Omit<ToolError, "id" | "createdAt">>

/**
 * schema
 */

export const schema = { runs, runsRelations, tasks, tasksRelations, taskMetrics, toolErrors, toolErrorsRelations }
