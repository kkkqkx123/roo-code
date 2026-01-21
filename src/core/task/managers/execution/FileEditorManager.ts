import { DiffViewProvider } from "../../../../integrations/editor/DiffViewProvider"
import type { DiffStrategy } from "@core/tools/tool-config"
import { MultiSearchReplaceDiffStrategy } from "../../../diff/strategies/multi-search-replace"
import { MultiFileSearchReplaceDiffStrategy } from "../../../diff/strategies/multi-file-search-replace"
import { EXPERIMENT_IDS, experiments } from "../../../../shared/experiments"

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

	constructor(options: FileEditorManagerOptions) {
		this.cwd = options.cwd
		this.fuzzyMatchThreshold = options.fuzzyMatchThreshold
		this.diffEnabled = options.enableDiff
		this.diffViewProvider = new DiffViewProvider(this.cwd, {} as any)

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
		await this.diffViewProvider.reset()
	}

	async revertChanges(): Promise<void> {
		await this.diffViewProvider.revertChanges()
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
		if (this.diffViewProvider.isEditing) {
			await this.diffViewProvider.revertChanges()
		}
	}
}
