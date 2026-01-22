import EventEmitter from "events"
import type { TodoItem, HistoryItem, TaskProviderEvents } from "@shared/types"
import { RooCodeEventName } from "@shared/types"
import { readApiMessages, saveApiMessages, readTaskMessages, saveTaskMessages } from "../task-persistence"
import { ErrorHandler } from "../error/ErrorHandler"

export interface DelegationDependencies {
	getCurrentTask: () => any
	removeClineFromStack: () => Promise<void>
	createTask: (
		prompt: string,
		images?: string[],
		parent?: any,
		options?: any,
	) => Promise<any>
	createTaskWithHistoryItem: (historyItem: HistoryItem, options?: any) => Promise<any>
	getTaskWithId: (id: string) => Promise<{ historyItem: HistoryItem }>
	updateTaskHistory: (item: HistoryItem) => Promise<HistoryItem[]>
	handleModeSwitch: (newMode: string) => Promise<void>
	log: (message: string) => void
	emit: <K extends keyof TaskProviderEvents>(event: K, ...args: TaskProviderEvents[K]) => void
	globalStoragePath: string
}

export class TaskDelegationCoordinator extends EventEmitter<TaskProviderEvents> {
	private dependencies: DelegationDependencies
	private errorHandler: ErrorHandler

	constructor(dependencies: DelegationDependencies) {
		super()
		this.dependencies = dependencies
		this.errorHandler = new ErrorHandler()
	}

	async delegateParentAndOpenChild(params: {
		parentTaskId: string
		message: string
		initialTodos: TodoItem[]
		mode: string
	}): Promise<any> {
		const { parentTaskId, message, initialTodos, mode } = params

		const parent = this.dependencies.getCurrentTask()
		if (!parent) {
			throw new Error("[delegateParentAndOpenChild] No current task")
		}
		if (parent.taskId !== parentTaskId) {
			throw new Error(
				`[delegateParentAndOpenChild] Parent mismatch: expected ${parentTaskId}, current ${parent.taskId}`,
			)
		}

		try {
			await this.executeWithRetry(
				async () => await parent.flushPendingToolResultsToHistory(),
				"flushPendingToolResultsToHistory",
				3
			)
		} catch (error) {
			this.dependencies.log(
				`[delegateParentAndOpenChild] Error flushing pending tool results (non-fatal): ${
					error instanceof Error ? error.message : String(error)
				}`,
			)
		}

		try {
			await this.executeWithRetry(
				async () => await this.dependencies.removeClineFromStack(),
				"removeClineFromStack",
				3
			)
		} catch (error) {
			this.dependencies.log(
				`[delegateParentAndOpenChild] Error during parent disposal (non-fatal): ${
					error instanceof Error ? error.message : String(error)
				}`,
			)
		}

		try {
			await this.executeWithRetry(
				async () => await this.dependencies.handleModeSwitch(mode as any),
				"handleModeSwitch",
				3
			)
		} catch (e) {
			this.dependencies.log(
				`[delegateParentAndOpenChild] handleModeSwitch failed for mode '${mode}': ${
					(e as Error)?.message ?? String(e)
				}`,
			)
		}

		const child = await this.dependencies.createTask(message, undefined, parent as any, {
			initialTodos,
			initialStatus: "active",
		})

		try {
			await this.executeWithRetry(
				async () => {
					const { historyItem } = await this.dependencies.getTaskWithId(parentTaskId)
					const childIds = Array.from(new Set([...(historyItem.childIds ?? []), child.taskId]))
					const updatedHistory: typeof historyItem = {
						...historyItem,
						status: "delegated",
						delegatedToId: child.taskId,
						awaitingChildId: child.taskId,
						childIds,
					}
					await this.dependencies.updateTaskHistory(updatedHistory)
				},
				"updateTaskHistory",
				3
			)
		} catch (err) {
			this.dependencies.log(
				`[delegateParentAndOpenChild] Failed to persist parent metadata for ${parentTaskId} -> ${child.taskId}: ${
					(err as Error)?.message ?? String(err)
				}`,
			)
		}

		try {
			this.dependencies.emit(RooCodeEventName.TaskDelegated, parentTaskId, child.taskId)
		} catch {
		}

		await this.waitForUIStateUpdate(5000)

		return child
	}

	async reopenParentFromDelegation(params: {
		parentTaskId: string
		childTaskId: string
		completionResultSummary: string
	}): Promise<void> {
		const { parentTaskId, childTaskId, completionResultSummary } = params
		const globalStoragePath = this.dependencies.globalStoragePath

		const { historyItem } = await this.dependencies.getTaskWithId(parentTaskId)

		let parentClineMessages: any[] = []
		try {
			parentClineMessages = await this.executeWithRetry(
				async () => await readTaskMessages({
					taskId: parentTaskId,
					globalStoragePath,
				}),
				"readTaskMessages",
				3
			)
		} catch {
			parentClineMessages = []
		}

		let parentApiMessages: any[] = []
		try {
			parentApiMessages = await this.executeWithRetry(
				async () => (await readApiMessages({
					taskId: parentTaskId,
					globalStoragePath,
				})) as any[],
				"readApiMessages",
				3
			)
		} catch {
			parentApiMessages = []
		}

		const ts = Date.now()

		if (!Array.isArray(parentClineMessages)) parentClineMessages = []
		if (!Array.isArray(parentApiMessages)) parentApiMessages = []

		const subtaskUiMessage: any = {
			type: "say",
			say: "subtask_result",
			text: completionResultSummary,
			ts,
		}
		parentClineMessages.push(subtaskUiMessage)
		await this.executeWithRetry(
			async () => await saveTaskMessages({ messages: parentClineMessages, taskId: parentTaskId, globalStoragePath }),
			"saveTaskMessages",
			3
		)

		let toolUseId: string | undefined
		for (let i = parentApiMessages.length - 1; i >= 0; i--) {
			const msg = parentApiMessages[i]
			if (msg.role === "assistant" && Array.isArray(msg.content)) {
				for (const block of msg.content) {
					if (block.type === "tool_use" && block.name === "new_task") {
						toolUseId = block.id
						break
					}
				}
				if (toolUseId) break
			}
		}

		if (toolUseId) {
			const lastMsg = parentApiMessages[parentApiMessages.length - 1]
			let alreadyHasToolResult = false
			if (lastMsg?.role === "user" && Array.isArray(lastMsg.content)) {
				for (const block of lastMsg.content) {
					if (block.type === "tool_result" && block.tool_use_id === toolUseId) {
						block.content = `Subtask ${childTaskId} completed.\n\nResult:\n${completionResultSummary}`
						alreadyHasToolResult = true
						break
					}
				}
			}

			if (!alreadyHasToolResult) {
				parentApiMessages.push({
					role: "user",
					content: [
						{
							type: "tool_result" as const,
							tool_use_id: toolUseId,
							content: `Subtask ${childTaskId} completed.\n\nResult:\n${completionResultSummary}`,
						},
					],
					ts,
				})
			}
		} else {
			parentApiMessages.push({
				role: "user",
				content: [
					{
						type: "text",
						text: `Subtask ${childTaskId} completed.\n\nResult:\n${completionResultSummary}`,
					},
				],
				ts,
			})
		}

		await this.executeWithRetry(
			async () => await saveApiMessages({ messages: parentApiMessages as any, taskId: parentTaskId, globalStoragePath }),
			"saveApiMessages",
			3
		)

		try {
			const { historyItem: childHistory } = await this.dependencies.getTaskWithId(childTaskId)
			await this.dependencies.updateTaskHistory({
				...childHistory,
				status: "completed",
			})
		} catch (err) {
			this.dependencies.log(
				`[reopenParentFromDelegation] Failed to persist child completed status for ${childTaskId}: ${
					(err as Error)?.message ?? String(err)
				}`,
			)
		}

		const childIds = Array.from(new Set([...(historyItem.childIds ?? []), childTaskId]))
		const updatedHistory: typeof historyItem = {
			...historyItem,
			status: "active",
			completedByChildId: childTaskId,
			completionResultSummary,
			awaitingChildId: undefined,
			childIds,
		}
		await this.dependencies.updateTaskHistory(updatedHistory)

		try {
			this.dependencies.emit(RooCodeEventName.TaskDelegationCompleted, parentTaskId, childTaskId, completionResultSummary)
		} catch {
		}

		const current = this.dependencies.getCurrentTask()
		if (current?.taskId === childTaskId) {
			await this.dependencies.removeClineFromStack()
		}

		const parentInstance = await this.dependencies.createTaskWithHistoryItem(updatedHistory, { startTask: false })

		if (parentInstance) {
			try {
				await parentInstance.overwriteClineMessages(parentClineMessages)
			} catch {
			}
			try {
				await parentInstance.overwriteApiConversationHistory(parentApiMessages as any)
			} catch {
			}

			await parentInstance.resumeAfterDelegation()
		}

		try {
			this.dependencies.emit(RooCodeEventName.TaskDelegationResumed, parentTaskId, childTaskId)
		} catch {
		}

		await this.waitForUIStateUpdate(5000)
	}

	private async executeWithRetry<T>(
		operation: () => Promise<T>,
		operationName: string,
		maxRetries: number = 3
	): Promise<T> {
		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				this.dependencies.log(`[TaskDelegationCoordinator#${operationName}] Attempt ${attempt + 1}/${maxRetries}`)
				const result = await operation()
				this.dependencies.log(`[TaskDelegationCoordinator#${operationName}] Operation completed successfully`)
				return result
			} catch (error) {
				this.dependencies.log(`[TaskDelegationCoordinator#${operationName}] Error on attempt ${attempt + 1}: ${error}`)
				
				const result = await this.errorHandler.handleError(
					error instanceof Error ? error : new Error(String(error)),
					{
						operation: operationName,
						taskId: this.dependencies.getCurrentTask()?.taskId,
						timestamp: Date.now()
					}
				)

				if (attempt === maxRetries - 1 || !result.shouldRetry) {
					this.dependencies.log(`[TaskDelegationCoordinator#${operationName}] Max retries reached or no retry allowed, throwing error`)
					throw error
				}

				const delay = 1000 * (attempt + 1)
				this.dependencies.log(`[TaskDelegationCoordinator#${operationName}] Retrying after ${delay}ms`)
				await this.delay(delay)
			}
		}
		throw new Error(`Operation ${operationName} failed after ${maxRetries} attempts`)
	}

	private async waitForUIStateUpdate(timeoutMs: number = 5000): Promise<boolean> {
		const startTime = Date.now()
		const checkInterval = 100
		
		while (Date.now() - startTime < timeoutMs) {
			const currentTask = this.dependencies.getCurrentTask()
			if (!currentTask) {
				await this.delay(checkInterval)
				continue
			}

			try {
				const provider = currentTask.getProvider?.()
				if (provider) {
					await this.delay(checkInterval)
					return true
				}
			} catch (error) {
				this.dependencies.log(`[TaskDelegationCoordinator#waitForUIStateUpdate] Error checking UI state: ${error}`)
			}

			await this.delay(checkInterval)
		}

		this.dependencies.log(`[TaskDelegationCoordinator#waitForUIStateUpdate] UI state update confirmation timeout after ${timeoutMs}ms`)
		return false
	}

	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms))
	}
}
