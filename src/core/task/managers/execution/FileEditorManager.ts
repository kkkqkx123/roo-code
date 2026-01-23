import { DiffViewProvider } from "../../../../integrations/editor/DiffViewProvider"
import type { DiffStrategy } from "@shared/types/tool-config"
import { MultiSearchReplaceDiffStrategy } from "../../../diff/strategies/multi-search-replace"
import { MultiFileSearchReplaceDiffStrategy } from "../../../diff/strategies/multi-file-search-replace"
import { EXPERIMENT_IDS, experiments } from "@shared/config/experiment-config"
import { ErrorHandler } from "../../../error/ErrorHandler"

export interface FileEditorManagerOptions {
	cwd: string
	fuzzyMatchThreshold: number
	enableDiff: boolean
	provider: any
}

export class FileEditorManager {
	readonly cwd: string
	readonly diffViewProvider: DiffViewProvider
	diffStrategy?: DiffStrategy
	diffEnabled: boolean
	fuzzyMatchThreshold: number
	didEditFile: boolean = false
	private errorHandler: ErrorHandler

	constructor(options: FileEditorManagerOptions) {
		this.cwd = options.cwd
		this.fuzzyMatchThreshold = options.fuzzyMatchThreshold
		this.diffEnabled = options.enableDiff
		this.diffViewProvider = new DiffViewProvider(this.cwd, {} as any)
		this.errorHandler = new ErrorHandler()

		if (this.diffEnabled) {
			this.diffStrategy = new MultiSearchReplaceDiffStrategy(this.fuzzyMatchThreshold)

			options.provider.getState().then((state: any) => {
				const isMultiFileApplyDiffEnabled = experiments.isEnabled(
					state.experiments ?? {},
					EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF,
				)

				if (isMultiFileApplyDiffEnabled) {
					this.diffStrategy = new MultiFileSearchReplaceDiffStrategy(this.fuzzyMatchThreshold)
				}
			})
		}
	}

	async reset(): Promise<void> {
		try {
			await this.executeWithRetry(
				async () => await this.diffViewProvider.reset(),
				"reset",
				3
			)
		} catch (error) {
			console.error("[FileEditorManager] Failed to reset:", error)
			throw error
		}
	}

	async revertChanges(): Promise<void> {
		try {
			await this.executeWithRetry(
				async () => await this.diffViewProvider.revertChanges(),
				"revertChanges",
				3
			)
		} catch (error) {
			console.error("[FileEditorManager] Failed to revert changes:", error)
			throw error
		}
	}

	get isEditing(): boolean {
		return this.diffViewProvider.isEditing
	}

	setDidEditFile(edited: boolean): void {
		this.didEditFile = edited
	}

	getDidEditFile(): boolean {
		return this.didEditFile
	}

	getDiffStrategy(): DiffStrategy | undefined {
		return this.diffStrategy
	}

	async dispose(): Promise<void> {
		try {
			if (this.diffViewProvider.isEditing) {
				await this.executeWithRetry(
					async () => await this.diffViewProvider.revertChanges(),
					"dispose",
					3
				)
			}
		} catch (error) {
			console.error("[FileEditorManager] Failed to dispose:", error)
		}
	}

	private async executeWithRetry<T>(
		operation: () => Promise<T>,
		operationName: string,
		maxRetries: number = 3
	): Promise<T> {
		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				console.log(`[FileEditorManager#${operationName}] Attempt ${attempt + 1}/${maxRetries}`)
				const result = await operation()
				console.log(`[FileEditorManager#${operationName}] Operation completed successfully`)
				return result
			} catch (error) {
				console.error(`[FileEditorManager#${operationName}] Error on attempt ${attempt + 1}: ${error}`)
				
				const result = await this.errorHandler.handleError(
					error instanceof Error ? error : new Error(String(error)),
					{
						operation: operationName,
						timestamp: Date.now()
					}
				)

				if (attempt === maxRetries - 1 || !result.shouldRetry) {
					console.log(`[FileEditorManager#${operationName}] Max retries reached or no retry allowed, throwing error`)
					throw error
				}

				const delay = 1000 * (attempt + 1)
				console.log(`[FileEditorManager#${operationName}] Retrying after ${delay}ms`)
				await this.delay(delay)
			}
		}
		throw new Error(`Operation ${operationName} failed after ${maxRetries} attempts`)
	}

	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms))
	}
}
