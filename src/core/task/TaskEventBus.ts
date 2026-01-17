import type { IDisposable } from "./TaskContainer"

// Event type definitions for type safety
export enum TaskEvent {
	TokenUsageUpdated = 'taskTokenUsageUpdated',
	StreamingStateChanged = 'taskStreamingStateChanged',
	TaskStatusChanged = 'taskStatusChanged',
	TaskCompleted = 'taskCompleted',
	TaskFailed = 'taskFailed',
	TaskDisposed = 'taskDisposed',
	MessageReceived = 'messageReceived',
	ToolExecutionStarted = 'toolExecutionStarted',
	ToolExecutionCompleted = 'toolExecutionCompleted',
	CheckpointSaved = 'checkpointSaved',
	CheckpointRestored = 'checkpointRestored'
}

// Union type for backward compatibility
export type EventType = TaskEvent | string

export interface EventListener {
	(event: EventType, data: any): void
}

export interface EventSubscription {
	unsubscribe(): void
}

/**
 * 事件总线 - 解耦Task与各个管理器之间的事件传递
 * 使用WeakRef防止内存泄漏
 */
export class TaskEventBus implements IDisposable {
	private listeners = new Map<EventType, Set<WeakRef<EventListener>>>()
	private subscriptions = new Map<WeakRef<EventListener>, Set<EventType>>()
	private cleanupTimer?: NodeJS.Timeout
	private cleanupInterval = 5000 // Cleanup every 5 seconds

	emit(event: EventType, data: any): void {
		const listeners = this.listeners.get(event)
		if (!listeners) return

		// Create array to avoid modification during iteration
		const activeListeners = Array.from(listeners)
			.map(ref => ref.deref())
			.filter(listener => listener !== undefined) as EventListener[]

		// Schedule cleanup if needed
		if (activeListeners.length < listeners.size) {
			this.scheduleCleanup()
		}

		// Notify active listeners
		activeListeners.forEach(listener => {
			try {
				listener(event, data)
			} catch (error) {
				console.error(`Error in event listener for ${event}:`, error)
			}
		})
	}

	on(event: EventType, listener: EventListener): EventSubscription {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set())
		}

		const listenerRef = new WeakRef(listener)
		this.listeners.get(event)!.add(listenerRef)

		// Track subscription for cleanup
		if (!this.subscriptions.has(listenerRef)) {
			this.subscriptions.set(listenerRef, new Set())
		}
		this.subscriptions.get(listenerRef)!.add(event)

		return {
			unsubscribe: () => this.off(event, listener)
		}
	}

	off(event: EventType, listener: EventListener): void {
		const listeners = this.listeners.get(event)
		if (!listeners) return

		// Find and remove the listener reference
		for (const ref of listeners) {
			if (ref.deref() === listener) {
				listeners.delete(ref)
				break
			}
		}

		// Clean up subscription tracking
		for (const [ref, events] of this.subscriptions) {
			if (ref.deref() === listener) {
				events.delete(event)
				if (events.size === 0) {
					this.subscriptions.delete(ref)
				}
				break
			}
		}
	}

	removeAllListeners(event?: EventType): void {
		if (event) {
			// Remove specific event listeners
			const listeners = this.listeners.get(event)
			if (listeners) {
				for (const ref of listeners) {
					const listener = ref.deref()
					if (listener) {
						this.cleanupSubscription(ref, event)
					}
				}
				listeners.clear()
				this.listeners.delete(event)
			}
		} else {
			// Remove all listeners
			for (const [eventName, listeners] of this.listeners) {
				for (const ref of listeners) {
					const listener = ref.deref()
					if (listener) {
						this.cleanupSubscription(ref, eventName)
					}
				}
				listeners.clear()
			}
			this.listeners.clear()
		}
	}

	private cleanupSubscription(listenerRef: WeakRef<EventListener>, event: EventType): void {
		const events = this.subscriptions.get(listenerRef)
		if (events) {
			events.delete(event)
			if (events.size === 0) {
				this.subscriptions.delete(listenerRef)
			}
		}
	}

	private scheduleCleanup(): void {
		if (!this.cleanupTimer) {
			this.cleanupTimer = setTimeout(() => {
				this.cleanupAllDeadReferences()
				this.cleanupTimer = undefined
			}, this.cleanupInterval)
		}
	}

	private cleanupAllDeadReferences(): void {
		for (const [event, listeners] of this.listeners) {
			const deadRefs: WeakRef<EventListener>[] = []
			for (const ref of listeners) {
				if (ref.deref() === undefined) {
					deadRefs.push(ref)
				}
			}

			deadRefs.forEach(ref => {
				listeners.delete(ref)
				// Clean up subscription tracking
				this.subscriptions.delete(ref)
			})

			// Remove empty event sets
			if (listeners.size === 0) {
				this.listeners.delete(event)
			}
		}
	}

	setCleanupInterval(interval: number): void {
		this.cleanupInterval = interval
	}

	dispose(): void {
		if (this.cleanupTimer) {
			clearTimeout(this.cleanupTimer)
			this.cleanupTimer = undefined
		}
		this.removeAllListeners()
		this.listeners.clear()
		this.subscriptions.clear()
	}

	// Get statistics for debugging
	getStats(): { events: number; listeners: number; deadRefs: number } {
		let totalListeners = 0
		let deadRefs = 0

		for (const listeners of this.listeners.values()) {
			totalListeners += listeners.size
			for (const ref of listeners) {
				if (ref.deref() === undefined) {
					deadRefs++
				}
			}
		}

		return {
			events: this.listeners.size,
			listeners: totalListeners,
			deadRefs
		}
	}
}