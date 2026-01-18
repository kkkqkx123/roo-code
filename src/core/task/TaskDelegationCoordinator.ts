import EventEmitter from "events"
import type { TodoItem, HistoryItem, TaskProviderEvents } from "@roo-code/types"
import { RooCodeEventName } from "@roo-code/types"
import { readApiMessages, saveApiMessages, readTaskMessages, saveTaskMessages } from "../task-persistence"

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

	constructor(dependencies: DelegationDependencies) {
		super()
		this.dependencies = dependencies
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
			await parent.flushPendingToolResultsToHistory()
		} catch (error) {
			this.dependencies.log(
				`[delegateParentAndOpenChild] Error flushing pending tool results (non-fatal): ${
					error instanceof Error ? error.message : String(error)
				}`,
			)
		}

		try {
			await this.dependencies.removeClineFromStack()
		} catch (error) {
			this.dependencies.log(
				`[delegateParentAndOpenChild] Error during parent disposal (non-fatal): ${
					error instanceof Error ? error.message : String(error)
				}`,
			)
		}

		try {
			await this.dependencies.handleModeSwitch(mode as any)
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
			parentClineMessages = await readTaskMessages({
				taskId: parentTaskId,
				globalStoragePath,
			})
		} catch {
			parentClineMessages = []
		}

		let parentApiMessages: any[] = []
		try {
			parentApiMessages = (await readApiMessages({
				taskId: parentTaskId,
				globalStoragePath,
			})) as any[]
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
		await saveTaskMessages({ messages: parentClineMessages, taskId: parentTaskId, globalStoragePath })

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

		await saveApiMessages({ messages: parentApiMessages as any, taskId: parentTaskId, globalStoragePath })

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
	}
}
