export interface IDisposable {
	dispose(): void
}

export interface IAsyncDisposable {
	dispose(): Promise<void>
}

export interface InjectionToken<T> {
	symbol: symbol
	name: string
}

export interface Provider<T> {
	create(container: TaskContainer): T
}

export class TaskContainer {
	private services = new Map<symbol, any>()
	private disposables: IDisposable[] = []
	private asyncDisposables: IAsyncDisposable[] = []

	register<T>(token: InjectionToken<T>, instance: T): void {
		this.services.set(token.symbol, instance)
		
		// Track for disposal - let caller specify async/sync explicitly
		this.trackForDisposal(instance)
	}

	registerAsync<T>(token: InjectionToken<T>, instance: T & IAsyncDisposable): void {
		this.services.set(token.symbol, instance)
		this.trackForDisposal(instance, true)
	}

	private trackForDisposal(instance: any, isAsync: boolean = false): void {
		if (!instance || typeof instance.dispose !== 'function') {
			return
		}

		if (isAsync) {
			this.asyncDisposables.push(instance)
		} else {
			this.disposables.push(instance)
		}
	}

	get<T>(token: InjectionToken<T>): T {
		const service = this.services.get(token.symbol)
		if (!service) {
			throw new Error(`Service ${token.name} not found in container`)
		}
		return service
	}

	has<T>(token: InjectionToken<T>): boolean {
		return this.services.has(token.symbol)
	}

	registerDisposable(disposable: IDisposable): void {
		this.disposables.push(disposable)
	}

	registerAsyncDisposable(disposable: IAsyncDisposable): void {
		this.asyncDisposables.push(disposable)
	}

	async dispose(): Promise<void> {
		// Check if already disposed
		if (this.services.size === 0) {
			return
		}

		// Dispose async disposables first
		const asyncDisposePromises = this.asyncDisposables.map(async (d) => {
			try {
				if (d && typeof d.dispose === 'function') {
					await d.dispose()
				}
			} catch (error) {
				console.error(`Error disposing async service:`, error)
			}
		})

		await Promise.all(asyncDisposePromises)

		// Then dispose sync disposables
		this.disposables.forEach((d) => {
			try {
				if (d && typeof d.dispose === 'function') {
					d.dispose()
				}
			} catch (error) {
				console.error(`Error disposing sync service:`, error)
			}
		})

		// Clear references
		this.services.clear()
		this.disposables.length = 0
		this.asyncDisposables.length = 0
	}

	isDisposed(): boolean {
		return this.services.size === 0
	}

	// Cleanup dead weak references
	cleanup(): void {
		// No-op for now since we removed weak references
	}
}

// Create injection tokens for all services
export const TOKENS = {
	TaskStateManager: { symbol: Symbol('TaskStateManager'), name: 'TaskStateManager' },
	UsageTracker: { symbol: Symbol('UsageTracker'), name: 'UsageTracker' },
	StreamingManager: { symbol: Symbol('StreamingManager'), name: 'StreamingManager' },
	MessageQueueManager: { symbol: Symbol('MessageQueueManager'), name: 'MessageQueueManager' },
	TaskMessageManager: { symbol: Symbol('TaskMessageManager'), name: 'TaskMessageManager' },
	ContextManager: { symbol: Symbol('ContextManager'), name: 'ContextManager' },
	FileEditorManager: { symbol: Symbol('FileEditorManager'), name: 'FileEditorManager' },
	ToolExecutor: { symbol: Symbol('ToolExecutor'), name: 'ToolExecutor' },
	UserInteractionManager: { symbol: Symbol('UserInteractionManager'), name: 'UserInteractionManager' },
	CheckpointManager: { symbol: Symbol('CheckpointManager'), name: 'CheckpointManager' },
	ApiRequestManager: { symbol: Symbol('ApiRequestManager'), name: 'ApiRequestManager' },
	PromptManager: { symbol: Symbol('PromptManager'), name: 'PromptManager' },
	TaskLifecycleManager: { symbol: Symbol('TaskLifecycleManager'), name: 'TaskLifecycleManager' },
	SubtaskManager: { symbol: Symbol('SubtaskManager'), name: 'SubtaskManager' },
	BrowserSessionManager: { symbol: Symbol('BrowserSessionManager'), name: 'BrowserSessionManager' },
	ConfigurationManager: { symbol: Symbol('ConfigurationManager'), name: 'ConfigurationManager' },
	ConversationHistoryManager: { symbol: Symbol('ConversationHistoryManager'), name: 'ConversationHistoryManager' },
}