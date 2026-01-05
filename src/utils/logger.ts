import * as vscode from "vscode"

export enum LogLevel {
	DEBUG = "DEBUG",
	INFO = "INFO",
	WARN = "WARN",
	ERROR = "ERROR",
}

export class Logger {
	private outputChannel: vscode.OutputChannel
	private minLevel: LogLevel
	private prefix: string

	constructor(
		outputChannel: vscode.OutputChannel,
		prefix: string = "",
		minLevel: LogLevel = LogLevel.INFO,
	) {
		this.outputChannel = outputChannel
		this.prefix = prefix
		this.minLevel = minLevel
	}

	private shouldLog(level: LogLevel): boolean {
		const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR]
		return levels.indexOf(level) >= levels.indexOf(this.minLevel)
	}

	private format(level: LogLevel, message: string): string {
		const timestamp = new Date().toISOString()
		return `[${timestamp}] [${level}] ${this.prefix ? `[${this.prefix}] ` : ""}${message}`
	}

	private log(level: LogLevel, message: string): void {
		if (!this.shouldLog(level)) return
		this.outputChannel.appendLine(this.format(level, message))
	}

	debug(message: string): void {
		this.log(LogLevel.DEBUG, message)
	}

	info(message: string): void {
		this.log(LogLevel.INFO, message)
	}

	warn(message: string): void {
		this.log(LogLevel.WARN, message)
	}

	error(message: string, error?: Error | unknown): void {
		if (error) {
			if (error instanceof Error) {
				this.log(LogLevel.ERROR, `${message}: ${error.message}`)
				if (error.stack) {
					this.log(LogLevel.ERROR, `Stack: ${error.stack}`)
				}
			} else {
				this.log(LogLevel.ERROR, `${message}: ${String(error)}`)
			}
		} else {
			this.log(LogLevel.ERROR, message)
		}
	}
}

export function createLogger(
	outputChannel: vscode.OutputChannel,
	prefix: string = "",
	minLevel?: LogLevel,
): Logger {
	const level =
		minLevel ||
		(process.env.NODE_ENV === "development" ? LogLevel.DEBUG : LogLevel.INFO)
	return new Logger(outputChannel, prefix, level)
}
