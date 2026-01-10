import PQueue from "p-queue"

import { findRun, finishRun, getTasks } from "../db/index.js"
import { EVALS_REPO_PATH } from "../exercises/index.js"

import { Logger, getTag, resetEvalsRepo, commitEvalsRepoChanges } from "./utils.js"
import { processTask } from "./runTask.js"

export const runEvals = async (runId: number) => {
	const run = await findRun(runId)

	if (run.taskMetricsId) {
		throw new Error(`Run ${run.id} already finished.`)
	}

	const tasks = await getTasks(runId)

	if (tasks.length === 0) {
		throw new Error(`Run ${run.id} has no tasks.`)
	}

	const logger = new Logger({
		logDir: `/tmp/evals/runs/${run.id}`,
		filename: `controller.log`,
		tag: getTag("runEvals", { run }),
	})

	logger.info(`running ${tasks.length} task(s)`)

	await resetEvalsRepo({ run, cwd: EVALS_REPO_PATH })

	const queue = new PQueue({ concurrency: run.concurrency })

	const STAGGER_DELAY_MS = 5000
	const filteredTasks = tasks.filter((task) => task.finishedAt === null)

	const createTaskRunner = (task: (typeof filteredTasks)[number]) => async () => {
		try {
			await processTask({ taskId: task.id, logger })
		} catch (error) {
			logger.error("error processing task", error)
		}
	}

	try {
		// Add tasks with staggered start times when concurrency > 1
		for (let i = 0; i < filteredTasks.length; i++) {
			const task = filteredTasks[i]
			if (!task) continue
			if (run.concurrency > 1 && i > 0) {
				await new Promise((resolve) => setTimeout(resolve, STAGGER_DELAY_MS))
			}
			queue.add(createTaskRunner(task))
		}

		await queue.onIdle()

		logger.info("finishRun")
		const result = await finishRun(run.id)
		logger.info("result ->", result)

		// Commit changes for local runs
		await commitEvalsRepoChanges({ run, cwd: EVALS_REPO_PATH })
	} finally {
		logger.info("cleaning up")
		logger.close()
	}
}
