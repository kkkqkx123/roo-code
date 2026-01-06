import { FileContextTracker } from "../../context-tracking/FileContextTracker"
import { RooIgnoreController } from "../../ignore/RooIgnoreController"
import { RooProtectedController } from "../../protect/RooProtectedController"
import type { ClineProvider } from "../../webview/ClineProvider"

export interface ContextManagerOptions {
	cwd: string
	provider: ClineProvider
	taskId: string
}

export class ContextManager {
	readonly cwd: string
	readonly taskId: string
	rooIgnoreController?: RooIgnoreController
	rooProtectedController?: RooProtectedController
	fileContextTracker: FileContextTracker

	constructor(options: ContextManagerOptions) {
		this.cwd = options.cwd
		this.taskId = options.taskId

		this.rooIgnoreController = new RooIgnoreController(this.cwd)
		this.rooProtectedController = new RooProtectedController(this.cwd)
		this.fileContextTracker = new FileContextTracker(options.provider, this.taskId)

		this.rooIgnoreController.initialize().catch((error) => {
			console.error("[ContextManager] Failed to initialize RooIgnoreController:", error)
		})
	}

	async isFileIgnored(filePath: string): Promise<boolean> {
		if (this.rooIgnoreController) {
			return !this.rooIgnoreController.validateAccess(filePath)
		}
		return false
	}

	async isFileProtected(filePath: string): Promise<boolean> {
		if (this.rooProtectedController) {
			return this.rooProtectedController.isWriteProtected(filePath)
		}
		return false
	}

	getFileContextTracker(): FileContextTracker {
		return this.fileContextTracker
	}

	getRooIgnoreController(): RooIgnoreController | undefined {
		return this.rooIgnoreController
	}

	getRooProtectedController(): RooProtectedController | undefined {
		return this.rooProtectedController
	}

	async dispose(): Promise<void> {
		this.fileContextTracker.dispose()
	}
}
