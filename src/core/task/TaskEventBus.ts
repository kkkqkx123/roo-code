import type { IDisposable } from "./TaskContainer"

export interface EventListener {
	(event: string, data: any): void
}

export interface EventSubscription {
	unsubscribe(): void
}

/**
 * 事件总线 - 解耦Task与各个管理器之间的事件传递
 * 使用WeakRef防止内存泄漏
 */
export class TaskEventBus implements IDisposable {
	private listeners = new Map<string, Set<WeakRef<EventListener>>>()
	private subscriptions = new Map<WeakRef<EventListener>, Set<string>>()

	emit(event: string, data: any): void {
		const listeners = this.listeners.get(event)
		if (!listeners) return

		// Create array to avoid modification during iteration
		const activeListeners = Array.from(listeners)
			.map(ref => ref.deref())
			.filter(listener => listener !== undefined) as EventListener[]

		// Clean up dead references
		if (activeListeners.length < listeners.size) {
			this.cleanupDeadReferences(event)
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

	on(event: string, listener: EventListener): EventSubscription {
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

	off(event: string, listener: EventListener): void {
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

	removeAllListeners(event?: string): void {
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

	private cleanupSubscription(listenerRef: WeakRef<EventListener>, event: string): void {
		const events = this.subscriptions.get(listenerRef)
		if (events) {
			events.delete(event)
			if (events.size === 0) {
				this.subscriptions.delete(listenerRef)
			}
		}
	}

	private cleanupDeadReferences(event: string): void {
		const listeners = this.listeners.get(event)
		if (!listeners) return

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
	}

	dispose(): void {
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