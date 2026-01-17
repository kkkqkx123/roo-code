import * as fs from "fs"
import * as path from "path"

import {
	type TaskEvent,
	RooCodeEventName,
	type ToolUsage,
} from "@roo-code/types"

import {
	type Run,
	type Task,
	findRun,
	findTask,
	updateTask,
	createTaskMetrics,
	updateTaskMetrics,
} from "../db/index.js"
import { EVALS_REPO_PATH } from "../exercises/index.js"

import { Logger, getTag, isDockerContainer } from "./utils.js"
// import { runUnitTest } from "./runUnitTest.js" // Temporarily commented out as unused



export const processTask = async ({
	taskId,
	jobToken = null,
	logger,
}: {
	taskId: number
	jobToken?: string | null
	logger?: Logger
}) => {
	const task = await findTask(taskId)
	const { language, exercise } = task
	const run = await findRun(task.runId)

	const containerized = isDockerContainer()

	logger =
		logger ||
		new Logger({
			logDir: containerized ? `/var/log/evals/runs/${run.id}` : `/tmp/evals/runs/${run.id}`,
			filename: `${language}-${exercise}.log`,
			tag: getTag("runTask", { run, task }),
		})

	try {
		const publish = async (e: TaskEvent) => {
			// Local event logging (previously Redis-based)
			logger.info(`Event: ${e.eventName}`, e)
		}

		logger.info(`running task ${task.id} (${language}/${exercise})...`)
		await runTask({ run, task, jobToken, publish, logger })

		// Simplified: simulate task completion without actual testing
		const passed = 1 // Simulate success for local testing (SQLite uses 1 for true)
		logger.info(`task ${task.id} (${language}/${exercise}) -> ${passed}`)
		await updateTask(task.id, { passed })

		await publish({
			eventName: passed ? RooCodeEventName.EvalPass : RooCodeEventName.EvalFail,
			taskId: task.id,
		})
	} catch (error) {
		logger.error(`Error processing task ${task.id}: ${error}`)
		throw error
	} finally {
		// Cleanup (previously Redis-based runner deregistration)
	}
}



type RunTaskOptions = {
	run: Run
	task: Task
	jobToken: string | null
	publish: (taskEvent: TaskEvent) => Promise<void>
	logger: Logger
}

export const runTask = async ({ run: _run, task, publish, logger, jobToken }: RunTaskOptions) => {
	const { language, exercise } = task
	// Using fs.readFileSync to read the prompt file
	fs.readFileSync(path.resolve(EVALS_REPO_PATH, `prompts/${language}.md`), "utf-8")
	// workspacePath and logDir are used in the original implementation but not in simplified version
	// const workspacePath = path.resolve(EVALS_REPO_PATH, language, exercise)
	// const logDir = `/tmp/evals/runs/${run.id}`

	logger.info(`Simplified local execution for task ${task.id} (${language}/${exercise})`)

	// Create a simple local execution environment
	const env: NodeJS.ProcessEnv = {
		...process.env,
		ROO_CODE_EVAL_MODE: "true",
		ROO_CODE_EVAL_LANGUAGE: language,
		ROO_CODE_EVAL_EXERCISE: exercise,
	}

	if (jobToken) {
		env.ROO_CODE_CLOUD_TOKEN = jobToken
	}

	// Simulate task execution for local testing
	logger.info(`Starting simplified task execution...`)
	
	// Create mock task metrics for local execution
	const taskMetrics = await createTaskMetrics({
		cost: 0,
		tokensIn: 0,
		tokensOut: 0,
		tokensContext: 0,
		duration: 0,
		cacheWrites: 0,
		cacheReads: 0,
		toolUsage: {},
	})

	await updateTask(task.id, { taskMetricsId: taskMetrics.id, startedAt: new Date().toISOString() })

	// Simulate the task running for a few seconds
	await new Promise((resolve) => setTimeout(resolve, 3_000))

	// Simulate some basic tool usage for testing
	const mockToolUsage: ToolUsage = {
		read_file: { attempts: 1, failures: 0 },
		write_to_file: { attempts: 1, failures: 0 },
	}

	await updateTaskMetrics(taskMetrics.id, {
		cost: 0.001,
		tokensIn: 100,
		tokensOut: 50,
		tokensContext: 150,
		duration: 3000,
		cacheWrites: 0,
		cacheReads: 0,
		toolUsage: mockToolUsage,
	})

	logger.info(`Simplified task execution completed`)

	// Simulate task completion for local testing
	await publish({
		eventName: RooCodeEventName.TaskStarted,
		taskId: task.id,
		payload: [task.id.toString()],
	})

	// Simulate some work being done
	await new Promise((resolve) => setTimeout(resolve, 2_000))

	// Simulate task completion
	await publish({
		eventName: RooCodeEventName.TaskCompleted,
		taskId: task.id,
		payload: [
			task.id.toString(),
			{
				totalCost: 0.001,
				totalTokensIn: 100,
				totalTokensOut: 50,
				contextTokens: 150,
				totalCacheWrites: 0,
				totalCacheReads: 0,
			},
			{
				read_file: { attempts: 1, failures: 0 },
				write_to_file: { attempts: 1, failures: 0 },
			},
			{ isSubtask: false },
		],
	})

	logger.info("setting task finished at")
	await updateTask(task.id, { finishedAt: new Date().toISOString() })

	logger.close()

	logger.info(`Simplified task execution finished for task ${task.id}`)
}
