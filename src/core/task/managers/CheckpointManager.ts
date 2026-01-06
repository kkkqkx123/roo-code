import type { CheckpointDiffOptions, CheckpointRestoreOptions } from "../../checkpoints"
import {
	checkpointSave,
	checkpointRestore,
	checkpointDiff,
	getCheckpointService,
} from "../../checkpoints"
import type { TaskStateManager } from "./TaskStateManager"
import type { MessageManager } from "./MessageManager"

export interface CheckpointManagerOptions {
	stateManager: TaskStateManager
	messageManager: MessageManager
	taskId: string
	enableCheckpoints: boolean
	checkpointTimeout: number
}

export class CheckpointManager {
	private stateManager: TaskStateManager
	private messageManager: MessageManager
	private taskId: string
	enableCheckpoints: boolean
	checkpointTimeout: number
	checkpointService?: any
	checkpointServiceInitializing = false

	constructor(options: CheckpointManagerOptions) {
		this.stateManager = options.stateManager
		this.messageManager = options.messageManager
		this.taskId = options.taskId
		this.enableCheckpoints = options.enableCheckpoints
		this.checkpointTimeout = options.checkpointTimeout
	}

	async checkpointSave(force: boolean = false, suppressMessage: boolean = false): Promise<void> {
		if (!this.enableCheckpoints) {
			return
		}

		try {
			await checkpointSave(
				this.stateManager as any,
				force,
				suppressMessage,
			)
		} catch (error) {
			console.error("[CheckpointManager] Failed to save checkpoint:", error)
		}
	}

	async checkpointRestore(options: CheckpointRestoreOptions): Promise<void> {
		if (!this.enableCheckpoints) {
			return
		}

		try {
			await checkpointRestore(
				this.stateManager as any,
				options,
			)
		} catch (error) {
			console.error("[CheckpointManager] Failed to restore checkpoint:", error)
			throw error
		}
	}

	async checkpointDiff(options: CheckpointDiffOptions): Promise<void> {
		if (!this.enableCheckpoints) {
			return
		}

		try {
			await checkpointDiff(
				this.stateManager as any,
				options,
			)
		} catch (error) {
			console.error("[CheckpointManager] Failed to diff checkpoint:", error)
			throw error
		}
	}

	getService(): any {
		if (!this.checkpointService && !this.checkpointServiceInitializing) {
			this.checkpointServiceInitializing = true
			this.checkpointService = getCheckpointService(this.stateManager as any)
			this.checkpointServiceInitializing = false
		}
		return this.checkpointService
	}

	isEnabled(): boolean {
		return this.enableCheckpoints
	}

	getTimeout(): number {
		return this.checkpointTimeout
	}
}
