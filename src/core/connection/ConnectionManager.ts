export interface ConnectionOptions {
	maxReconnectAttempts?: number
	reconnectDelayBase?: number
	maxReconnectDelay?: number
	heartbeatInterval?: number
	heartbeatTimeout?: number
}

export interface ConnectionState {
	isConnected: boolean
	reconnectAttempts: number
	lastConnectedAt?: number
	lastError?: Error
}

export class ConnectionManager {
	private isConnected = false
	private reconnectAttempts = 0
	private maxReconnectAttempts = 5
	private reconnectDelayBase = 1000
	private maxReconnectDelay = 30000
	private heartbeatInterval = 30000
	private heartbeatTimeout = 5000

	private heartbeatTimer?: NodeJS.Timeout
	private connectionStateCallbacks: Set<(state: ConnectionState) => void> = new Set()
	private lastError?: Error

	constructor(options?: ConnectionOptions) {
		if (options) {
			this.maxReconnectAttempts = options.maxReconnectAttempts ?? this.maxReconnectAttempts
			this.reconnectDelayBase = options.reconnectDelayBase ?? this.reconnectDelayBase
			this.maxReconnectDelay = options.maxReconnectDelay ?? this.maxReconnectDelay
			this.heartbeatInterval = options.heartbeatInterval ?? this.heartbeatInterval
			this.heartbeatTimeout = options.heartbeatTimeout ?? this.heartbeatTimeout
		}
	}

	async ensureConnection(): Promise<boolean> {
		if (this.isConnected) {
			console.log("[ConnectionManager] Already connected")
			return true
		}

		console.log(`[ConnectionManager] Attempting to connect (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`)

		while (this.reconnectAttempts < this.maxReconnectAttempts) {
			try {
				await this.connect()
				this.isConnected = true
				this.reconnectAttempts = 0
				this.lastError = undefined
				this.startHeartbeat()
				this.notifyStateChange()

				console.log("[ConnectionManager] Connected successfully")
				return true
			} catch (error) {
				this.reconnectAttempts++
				this.lastError = error instanceof Error ? error : new Error(String(error))
				this.notifyStateChange()

				if (this.reconnectAttempts < this.maxReconnectAttempts) {
					const delay = this.getReconnectDelay()
					console.warn(`[ConnectionManager] Connection failed (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}), retrying in ${delay}ms: ${this.lastError?.message}`)
					await this.delay(delay)
				} else {
					console.error(`[ConnectionManager] Max reconnect attempts (${this.maxReconnectAttempts}) reached`)
				}
			}
		}

		return false
	}

	private async connect(): Promise<void> {
		console.log("[ConnectionManager] Establishing connection...")

		await this.performConnection()

		console.log("[ConnectionManager] Connection established")
	}

	private async performConnection(): Promise<void> {
		console.log("[ConnectionManager] Performing connection handshake...")

		await new Promise((resolve, reject) => {
			setTimeout(() => {
				resolve(undefined)
			}, 100)
		})
	}

	private startHeartbeat(): void {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer)
		}

		this.heartbeatTimer = setInterval(async () => {
			try {
				await this.checkConnection()
			} catch (error) {
				console.error("[ConnectionManager] Heartbeat failed:", error)
				this.handleConnectionLoss()
			}
		}, this.heartbeatInterval)

		console.log(`[ConnectionManager] Heartbeat started (interval: ${this.heartbeatInterval}ms)`)
	}

	private stopHeartbeat(): void {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer)
			this.heartbeatTimer = undefined
			console.log("[ConnectionManager] Heartbeat stopped")
		}
	}

	private async checkConnection(): Promise<void> {
		console.debug("[ConnectionManager] Checking connection...")

		await this.performHeartbeatCheck()

		console.debug("[ConnectionManager] Connection check passed")
	}

	private async performHeartbeatCheck(): Promise<void> {
		await new Promise((resolve) => setTimeout(resolve, 50))
	}

	private handleConnectionLoss(): void {
		console.warn("[ConnectionManager] Connection lost")

		this.isConnected = false
		this.stopHeartbeat()
		this.notifyStateChange()
	}

	private getReconnectDelay(): number {
		const delay = this.reconnectDelayBase * Math.pow(2, this.reconnectAttempts - 1)
		return Math.min(delay, this.maxReconnectDelay)
	}

	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms))
	}

	disconnect(): void {
		console.log("[ConnectionManager] Disconnecting...")

		this.isConnected = false
		this.reconnectAttempts = 0
		this.stopHeartbeat()
		this.notifyStateChange()

		console.log("[ConnectionManager] Disconnected")
	}

	async reconnect(): Promise<boolean> {
		console.log("[ConnectionManager] Reconnecting...")

		this.disconnect()
		return await this.ensureConnection()
	}

	getConnectionState(): ConnectionState {
		return {
			isConnected: this.isConnected,
			reconnectAttempts: this.reconnectAttempts,
			lastConnectedAt: this.isConnected ? Date.now() : undefined,
			lastError: this.lastError
		}
	}

	onConnectionStateChange(callback: (state: ConnectionState) => void): () => void {
		this.connectionStateCallbacks.add(callback)

		return () => {
			this.connectionStateCallbacks.delete(callback)
		}
	}

	private notifyStateChange(): void {
		const state = this.getConnectionState()
		this.connectionStateCallbacks.forEach(callback => {
			try {
				callback(state)
			} catch (error) {
				console.error("[ConnectionManager] Error in state change callback:", error)
			}
		})
	}

	isHealthy(): boolean {
		return this.isConnected && this.reconnectAttempts === 0
	}

	reset(): void {
		console.log("[ConnectionManager] Resetting connection state")

		this.disconnect()
		this.reconnectAttempts = 0
		this.lastError = undefined
		this.notifyStateChange()
	}

	dispose(): void {
		console.log("[ConnectionManager] Disposing...")

		this.disconnect()
		this.connectionStateCallbacks.clear()

		console.log("[ConnectionManager] Disposed")
	}
}
