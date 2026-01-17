import EventEmitter from "events"
import * as vscode from "vscode"
import * as path from "path"
import delay from "delay"

import {
	type TaskProviderEvents,
	type HistoryItem,
	type CreateTaskOptions,
	type TokenUsage,
	type ToolUsage,
	RooCodeEventName,
} from "@roo-code/types"

import { Task } from "./Task"
import { readTaskMessages } from "../task-persistence/taskMessages"
import { saveTaskMessages } from "../task-persistence"
import { downloadTask } from "../../integrations/misc/export-markdown"
import { t } from "../../i18n"
import { GlobalFileNames } from "../../shared/globalFileNames"

interface PendingEditOperation {
	messageTs: number
	editedContent: string
	images?: string[]
	messageIndex: number
	apiConversationHistoryIndex: number
	timeoutId: NodeJS.Timeout
	createdAt: number
}

export class TaskManager extends EventEmitter<TaskProviderEvents> {
	private clineStack: Task[] = []
	private taskEventListeners: WeakMap<Task, Array<() => void>> = new WeakMap()
	private pendingOperations: Map<string, PendingEditOperation> = new Map()
	private static readonly PENDING_OPERATION_TIMEOUT_MS = 30000 // 30 seconds
	private taskCreationCallback: (task: Task) => void
	private recentTasksCache?: string[]
	private provider: any
	private getApiConfiguration: () => Promise<any>
	private getState: () => Promise<any>

	constructor(
		taskCreationCallback: (task: Task) => void,
		provider: any,
		getApiConfiguration: () => Promise<any>,
		getState: () => Promise<any>,
	) {
		super()
		this.taskCreationCallback = taskCreationCallback
		this.provider = provider
		this.getApiConfiguration = getApiConfiguration
		this.getState = getState
	}

	/**
	 * Adds a new Task instance to clineStack, marking the start of a new task.
	 * The instance is pushed to the top of the stack (LIFO order).
	 * When the task is completed, the top instance is removed, reactivating the
	 * previous task.
	 */
	async addClineToStack(task: Task): Promise<void> {
		// Add this cline instance into the stack that represents the order of
		// all the called tasks.
		this.clineStack.push(task)
		task.emit(RooCodeEventName.TaskFocused)
	}

	/**
	 * Removes and destroys the top Cline instance (the current finished task),
	 * activating the previous one (resuming the parent task).
	 */
	async removeClineFromStack(): Promise<void> {
		if (this.clineStack.length === 0) {
			return
		}

		// Pop the top Cline instance from the stack.
		let task = this.clineStack.pop()

		if (task) {
			task.emit(RooCodeEventName.TaskUnfocused)

			try {
				// Abort the running task and set isAbandoned to true so
				// all running promises will exit as well.
				await task.abortTask(true)
			} catch (e) {
				console.error(
					`[TaskManager#removeClineFromStack] abortTask() failed ${task.taskId}.${task.instanceId}: ${e.message}`,
				)
			}

			// Remove event listeners before clearing the reference.
			const cleanupFunctions = this.taskEventListeners.get(task)

			if (cleanupFunctions) {
				cleanupFunctions.forEach((cleanup) => cleanup())
				this.taskEventListeners.delete(task)
			}

			// Make sure no reference kept, once promises end it will be
			// garbage collected.
			task = undefined
		}
	}

	getTaskStackSize(): number {
		return this.clineStack.length
	}

	public getCurrentTaskStack(): string[] {
		return this.clineStack.map((cline) => cline.taskId)
	}

	/**
	 * Sets a pending edit operation with automatic timeout cleanup
	 */
	public setPendingEditOperation(
		operationId: string,
		editData: {
			messageTs: number
			editedContent: string
			images?: string[]
			messageIndex: number
			apiConversationHistoryIndex: number
		},
	): void {
		// Clear any existing operation with the same ID
		this.clearPendingEditOperation(operationId)

		// Create timeout for automatic cleanup
		const timeoutId = setTimeout(() => {
			this.clearPendingEditOperation(operationId)
			console.log(`[setPendingEditOperation] Automatically cleared stale pending operation: ${operationId}`)
		}, TaskManager.PENDING_OPERATION_TIMEOUT_MS)

		// Store the operation
		this.pendingOperations.set(operationId, {
			...editData,
			timeoutId,
			createdAt: Date.now(),
		})

		console.log(`[setPendingEditOperation] Set pending operation: ${operationId}`)
	}

	/**
	 * Gets a pending edit operation by ID
	 */
	public getPendingEditOperation(operationId: string): PendingEditOperation | undefined {
		return this.pendingOperations.get(operationId)
	}

	/**
	 * Clears a specific pending edit operation
	 */
	public clearPendingEditOperation(operationId: string): boolean {
		const operation = this.pendingOperations.get(operationId)
		if (operation) {
			clearTimeout(operation.timeoutId)
			this.pendingOperations.delete(operationId)
			console.log(`[clearPendingEditOperation] Cleared pending operation: ${operationId}`)
			return true
		}
		return false
	}

	/**
	 * Clears all pending edit operations
	 */
	public clearAllPendingEditOperations(): void {
		for (const [operationId, operation] of this.pendingOperations) {
			clearTimeout(operation.timeoutId)
		}
		this.pendingOperations.clear()
		console.log(`[clearAllPendingEditOperations] Cleared all pending operations`)
	}

	/**
	 * Gets the current active task from the stack
	 */
	public getCurrentTask(): Task | undefined {
		return this.clineStack[this.clineStack.length - 1]
	}

	/**
	 * Gets recent tasks from cache or stack
	 */
	public getRecentTasks(): string[] {
		if (this.recentTasksCache) {
			return this.recentTasksCache
		}
		return this.getCurrentTaskStack()
	}

	/**
	 * Creates a new task with the given prompt and options
	 */
	public async createTask(
		prompt: string,
		options?: CreateTaskOptions,
	): Promise<Task> {
		const apiConfiguration = await this.getApiConfiguration()
		const state = await this.getState()

		const newTask = new Task({
			provider: this.provider,
			apiConfiguration,
			...options,
			task: prompt,
			onCreated: this.taskCreationCallback,
			enableDiff: state.diffEnabled,
			enableCheckpoints: state.enableCheckpoints,
			checkpointTimeout: state.checkpointTimeout,
			fuzzyMatchThreshold: state.fuzzyMatchThreshold,
			consecutiveMistakeLimit: apiConfiguration.consecutiveMistakeLimit,
			experiments: state.experiments,
		})

		await this.addClineToStack(newTask)

		return newTask
	}

	/**
	 * Cancels the current task
	 */
	public async cancelTask(): Promise<void> {
		const currentTask = this.getCurrentTask()
		if (!currentTask) {
			return
		}

		// Cancel the task
		await currentTask.abortTask()
		
		// Update UI state to reflect task cancellation
		const provider = this.providerRef.deref()
		await provider?.postStateToWebview()
		
		// Remove from stack
		await this.removeClineFromStack()
	}

	/**
	 * Clears the current task
	 */
	public async clearTask(): Promise<void> {
		await this.removeClineFromStack()
	}

	/**
	 * Resumes a task by ID
	 */
	public resumeTask(taskId: string): void {
		// Implementation would depend on how tasks are resumed
		const currentTask = this.getCurrentTask()
		if (currentTask && currentTask.taskId === taskId) {
			currentTask.emit(RooCodeEventName.TaskResumable, taskId)
		}
	}

	/**
	 * Gets a task with its history item by ID
	 */
	public async getTaskWithId(id: string): Promise<{
		task: Task | undefined
		historyItem: HistoryItem
		apiConversationHistory: any[]
	}> {
		// Find task in stack
		const task = this.clineStack.find((t) => t.taskId === id)
		
		if (task) {
			return {
				task,
				historyItem: {
					id: task.taskId,
					number: task.taskNumber,
					ts: Date.now(),
					task: task.metadata.task || "",
					tokensIn: 0,
					tokensOut: 0,
					totalCost: 0,
					// Add other required properties with default values
				} as HistoryItem,
				apiConversationHistory: [],
			}
		}

		// If not in stack, would need to load from persistence
		// This is a simplified implementation
		throw new Error(`Task with ID ${id} not found`)
	}

	/**
	 * Shows a task by ID
	 */
	public async showTaskWithId(id: string): Promise<void> {
		const { task } = await this.getTaskWithId(id)
		if (task) {
			// Implementation would depend on how to show a task
			console.log(`Showing task: ${id}`)
		}
	}

	/**
	 * Exports a task by ID
	 */
	public async exportTaskWithId(id: string): Promise<void> {
		const { historyItem, apiConversationHistory } = await this.getTaskWithId(id)
		await downloadTask(historyItem.ts, apiConversationHistory)
	}

	/**
	 * Condenses task context
	 */
	public async condenseTaskContext(taskId: string): Promise<void> {
		const { task } = await this.getTaskWithId(taskId)
		if (task) {
			// Implementation would depend on the condense logic
			console.log(`Condensing task context: ${taskId}`)
		}
	}

	/**
	 * Deletes a task by ID
	 */
	public async deleteTaskWithId(id: string): Promise<void> {
		const taskIndex = this.clineStack.findIndex((t) => t.taskId === id)
		if (taskIndex !== -1) {
			const task = this.clineStack[taskIndex]
			await task.abortTask(true)
			
			// Remove from stack
			this.clineStack.splice(taskIndex, 1)
			
			// Clean up event listeners
			const cleanupFunctions = this.taskEventListeners.get(task)
			if (cleanupFunctions) {
				cleanupFunctions.forEach((cleanup) => cleanup())
				this.taskEventListeners.delete(task)
			}
		}
	}

	/**
	 * Deletes a task from state
	 */
	public async deleteTaskFromState(id: string): Promise<void> {
		await this.deleteTaskWithId(id)
	}

	/**
	 * Creates a task with history item
	 */
	public async createTaskWithHistoryItem(
		historyItem: HistoryItem & {
			rootTask?: any
			parentTask?: any
		},
		options?: { startTask?: boolean },
	): Promise<Task> {
		const {
			apiConfiguration,
			diffEnabled: enableDiff,
			enableCheckpoints,
			checkpointTimeout,
			fuzzyMatchThreshold,
			experiments,
			taskSyncEnabled,
		} = await this.getState()

		const currentTask = this.getCurrentTask()

		if (currentTask) {
			if (currentTask.taskId !== historyItem.id) {
				await this.removeClineFromStack()
			} else {
				currentTask.emit(RooCodeEventName.TaskUnfocused)
				this.clineStack.pop()
			}
		} else {
			await this.removeClineFromStack()
		}

		const task = new Task({
			provider: this.provider,
			apiConfiguration,
			enableDiff,
			enableCheckpoints,
			checkpointTimeout,
			fuzzyMatchThreshold,
			consecutiveMistakeLimit: apiConfiguration.consecutiveMistakeLimit,
			historyItem,
			experiments,
			rootTask: historyItem.rootTask,
			parentTask: historyItem.parentTask,
			taskNumber: historyItem.number,
			workspacePath: historyItem.workspace,
			onCreated: this.taskCreationCallback,
			startTask: options?.startTask ?? true,
			enableBridge: false,
			initialStatus: historyItem.status,
		})

		await this.addClineToStack(task)

		return task
	}

	/**
	 * Attaches event listeners to a task
	 */
	public attachTaskEventListeners(task: Task): void {
		// Create named listener functions so we can remove them later.
		const onTaskStarted = () => this.emit(RooCodeEventName.TaskStarted, task.taskId)
		const onTaskCompleted = (taskId: string, tokenUsage: TokenUsage, toolUsage: ToolUsage) =>
			this.emit(RooCodeEventName.TaskCompleted, taskId, tokenUsage, toolUsage)
		const onTaskAborted = async () => {
			this.emit(RooCodeEventName.TaskAborted, task.taskId)

			try {
				// Only rehydrate on genuine streaming failures.
				// User-initiated cancels are handled by cancelTask().
				if (task.abortReason === "streaming_failed") {
					// Defensive safeguard: if another path already replaced this instance, skip
					const current = this.getCurrentTask()
					if (current && current.instanceId !== task.instanceId) {
						console.log(
							`[onTaskAborted] Skipping rehydrate: current instance ${current.instanceId} != aborted ${task.instanceId}`,
						)
						return
					}

					const { historyItem } = await this.getTaskWithId(task.taskId)
					const rootTask = task.rootTask
					const parentTask = task.parentTask
					await this.createTaskWithHistoryItem({ ...historyItem, rootTask, parentTask })
				}
			} catch (error) {
				console.error(
					`[onTaskAborted] Failed to rehydrate after streaming failure: ${
						error instanceof Error ? error.message : String(error)
					}`,
				)
			}
		}
		const onTaskFocused = () => this.emit(RooCodeEventName.TaskFocused, task.taskId)
		const onTaskUnfocused = () => this.emit(RooCodeEventName.TaskUnfocused, task.taskId)
		const onTaskActive = (taskId: string) => this.emit(RooCodeEventName.TaskActive, taskId)
		const onTaskInteractive = (taskId: string) => this.emit(RooCodeEventName.TaskInteractive, taskId)
		const onTaskResumable = (taskId: string) => this.emit(RooCodeEventName.TaskResumable, taskId)
		const onTaskIdle = (taskId: string) => this.emit(RooCodeEventName.TaskIdle, taskId)
		const onTaskPaused = (taskId: string) => this.emit(RooCodeEventName.TaskPaused, taskId)
		const onTaskUnpaused = (taskId: string) => this.emit(RooCodeEventName.TaskUnpaused, taskId)
		const onTaskSpawned = (taskId: string) => this.emit(RooCodeEventName.TaskSpawned, taskId)
		const onTaskUserMessage = (taskId: string) => this.emit(RooCodeEventName.TaskUserMessage, taskId)
		const onTaskTokenUsageUpdated = (taskId: string, tokenUsage: TokenUsage, toolUsage: ToolUsage) =>
			this.emit(RooCodeEventName.TaskTokenUsageUpdated, taskId, tokenUsage, toolUsage)

		// Attach the listeners.
		task.on(RooCodeEventName.TaskStarted, onTaskStarted)
		task.on(RooCodeEventName.TaskCompleted, onTaskCompleted)
		task.on(RooCodeEventName.TaskAborted, onTaskAborted)
		task.on(RooCodeEventName.TaskFocused, onTaskFocused)
		task.on(RooCodeEventName.TaskUnfocused, onTaskUnfocused)
		task.on(RooCodeEventName.TaskActive, onTaskActive)
		task.on(RooCodeEventName.TaskInteractive, onTaskInteractive)
		task.on(RooCodeEventName.TaskResumable, onTaskResumable)
		task.on(RooCodeEventName.TaskIdle, onTaskIdle)
		task.on(RooCodeEventName.TaskPaused, onTaskPaused)
		task.on(RooCodeEventName.TaskUnpaused, onTaskUnpaused)
		task.on(RooCodeEventName.TaskSpawned, onTaskSpawned)
		task.on(RooCodeEventName.TaskUserMessage, onTaskUserMessage)
		task.on(RooCodeEventName.TaskTokenUsageUpdated, onTaskTokenUsageUpdated)

		// Store the cleanup functions for later removal.
		this.taskEventListeners.set(task, [
			() => task.off(RooCodeEventName.TaskStarted, onTaskStarted),
			() => task.off(RooCodeEventName.TaskCompleted, onTaskCompleted),
			() => task.off(RooCodeEventName.TaskAborted, onTaskAborted),
			() => task.off(RooCodeEventName.TaskFocused, onTaskFocused),
			() => task.off(RooCodeEventName.TaskUnfocused, onTaskUnfocused),
			() => task.off(RooCodeEventName.TaskActive, onTaskActive),
			() => task.off(RooCodeEventName.TaskInteractive, onTaskInteractive),
			() => task.off(RooCodeEventName.TaskResumable, onTaskResumable),
			() => task.off(RooCodeEventName.TaskIdle, onTaskIdle),
			() => task.off(RooCodeEventName.TaskUserMessage, onTaskUserMessage),
			() => task.off(RooCodeEventName.TaskPaused, onTaskPaused),
			() => task.off(RooCodeEventName.TaskUnpaused, onTaskUnpaused),
			() => task.off(RooCodeEventName.TaskSpawned, onTaskSpawned),
			() => task.off(RooCodeEventName.TaskTokenUsageUpdated, onTaskTokenUsageUpdated),
		])
	}

	/**
	 * Disposes the task manager and cleans up resources
	 */
	public async dispose(): Promise<void> {
		// Clear all tasks from the stack.
		while (this.clineStack.length > 0) {
			await this.removeClineFromStack()
		}

		// Clear all pending edit operations to prevent memory leaks
		this.clearAllPendingEditOperations()
	}
}