export enum ErrorCategory {
	CONNECTION = 'connection',
	STATE_SYNC = 'state_sync',
	MESSAGE_DELIVERY = 'message_delivery',
	API_REQUEST = 'api_request',
	TASK_CANCEL = 'task_cancel',
	UNKNOWN = 'unknown'
}

export interface ErrorContext {
	taskId?: string
	operation?: string
	timestamp: number
	additionalData?: Record<string, any>
}

export interface ErrorHandlingResult {
	handled: boolean
	shouldRetry: boolean
	retryDelay?: number
	userMessage?: string
	errorCode?: string
}

export interface ErrorStrategy {
	handle(error: Error, context: ErrorContext): Promise<ErrorHandlingResult>
}

export class ErrorHandler {
	private errorStrategies: Map<ErrorCategory, ErrorStrategy>

	constructor() {
		this.errorStrategies = new Map()
		this.initializeStrategies()
	}

	private initializeStrategies(): void {
		this.errorStrategies.set(ErrorCategory.CONNECTION, new ConnectionErrorStrategy())
		this.errorStrategies.set(ErrorCategory.STATE_SYNC, new StateSyncErrorStrategy())
		this.errorStrategies.set(ErrorCategory.MESSAGE_DELIVERY, new MessageDeliveryErrorStrategy())
		this.errorStrategies.set(ErrorCategory.API_REQUEST, new ApiRequestErrorStrategy())
		this.errorStrategies.set(ErrorCategory.TASK_CANCEL, new TaskCancelErrorStrategy())
		this.errorStrategies.set(ErrorCategory.UNKNOWN, new DefaultErrorStrategy())
	}

	async handleError(error: Error, context: ErrorContext): Promise<ErrorHandlingResult> {
		const category = this.categorizeError(error)
		const strategy = this.errorStrategies.get(category)

		if (!strategy) {
			console.error(`[ErrorHandler] No strategy found for error category: ${category}`)
			return {
				handled: false,
				shouldRetry: false,
				userMessage: error.message,
				errorCode: 'NO_STRATEGY'
			}
		}

		console.log(`[ErrorHandler] Handling error with category: ${category}, operation: ${context.operation}`)
		return await strategy.handle(error, context)
	}

	private categorizeError(error: Error): ErrorCategory {
		const errorMessage = error.message.toLowerCase()

		if (errorMessage.includes('connection') || errorMessage.includes('network') || errorMessage.includes('timeout')) {
			return ErrorCategory.CONNECTION
		}
		if (errorMessage.includes('state') || errorMessage.includes('sync') || errorMessage.includes('validation')) {
			return ErrorCategory.STATE_SYNC
		}
		if (errorMessage.includes('message') || errorMessage.includes('post') || errorMessage.includes('webview')) {
			return ErrorCategory.MESSAGE_DELIVERY
		}
		if (errorMessage.includes('api') || errorMessage.includes('request') || errorMessage.includes('context window')) {
			return ErrorCategory.API_REQUEST
		}
		if (errorMessage.includes('cancel') || errorMessage.includes('abort')) {
			return ErrorCategory.TASK_CANCEL
		}

		return ErrorCategory.UNKNOWN
	}

	getErrorCategory(error: Error): ErrorCategory {
		return this.categorizeError(error)
	}
}

class ConnectionErrorStrategy implements ErrorStrategy {
	async handle(error: Error, context: ErrorContext): Promise<ErrorHandlingResult> {
		console.error(`[ConnectionErrorStrategy] Handling connection error: ${error.message}`)

		return {
			handled: true,
			shouldRetry: true,
			retryDelay: 2000,
			userMessage: "Connection error, retrying...",
			errorCode: 'CONNECTION_ERROR'
		}
	}
}

class StateSyncErrorStrategy implements ErrorStrategy {
	async handle(error: Error, context: ErrorContext): Promise<ErrorHandlingResult> {
		console.error(`[StateSyncErrorStrategy] Handling state sync error: ${error.message}`)

		return {
			handled: true,
			shouldRetry: false,
			userMessage: "State synchronization error, please refresh",
			errorCode: 'STATE_SYNC_ERROR'
		}
	}
}

class MessageDeliveryErrorStrategy implements ErrorStrategy {
	async handle(error: Error, context: ErrorContext): Promise<ErrorHandlingResult> {
		console.error(`[MessageDeliveryErrorStrategy] Handling message delivery error: ${error.message}`)

		return {
			handled: true,
			shouldRetry: true,
			retryDelay: 1000,
			userMessage: "Message delivery failed, retrying...",
			errorCode: 'MESSAGE_DELIVERY_ERROR'
		}
	}
}

class ApiRequestErrorStrategy implements ErrorStrategy {
	async handle(error: Error, context: ErrorContext): Promise<ErrorHandlingResult> {
		console.error(`[ApiRequestErrorStrategy] Handling API request error: ${error.message}`)

		const errorMessage = error.message.toLowerCase()

		if (errorMessage.includes('context window')) {
			return {
				handled: true,
				shouldRetry: true,
				retryDelay: 5000,
				userMessage: "Context window exceeded, condensing context...",
				errorCode: 'CONTEXT_WINDOW_EXCEEDED'
			}
		}

		if (errorMessage.includes('rate limit')) {
			return {
				handled: true,
				shouldRetry: true,
				retryDelay: 60000,
				userMessage: "Rate limit exceeded, waiting...",
				errorCode: 'RATE_LIMIT_EXCEEDED'
			}
		}

		return {
			handled: true,
			shouldRetry: false,
			userMessage: "API request failed",
			errorCode: 'API_REQUEST_ERROR'
		}
	}
}

class TaskCancelErrorStrategy implements ErrorStrategy {
	async handle(error: Error, context: ErrorContext): Promise<ErrorHandlingResult> {
		console.error(`[TaskCancelErrorStrategy] Handling task cancel error: ${error.message}`)

		return {
			handled: true,
			shouldRetry: false,
			userMessage: "Task cancelled",
			errorCode: 'TASK_CANCELLED'
		}
	}
}

class DefaultErrorStrategy implements ErrorStrategy {
	async handle(error: Error, context: ErrorContext): Promise<ErrorHandlingResult> {
		console.error(`[DefaultErrorStrategy] Handling unknown error: ${error.message}`)

		return {
			handled: false,
			shouldRetry: false,
			userMessage: error.message,
			errorCode: 'UNKNOWN_ERROR'
		}
	}
}
