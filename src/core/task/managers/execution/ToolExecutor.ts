import type { ToolName, ToolUsage } from "@roo-code/types"
import { ToolRepetitionDetector } from "../../../tools/ToolRepetitionDetector"

export interface ToolExecutorOptions {
	consecutiveMistakeLimit: number
}

export class ToolExecutor {
	private consecutiveMistakeLimit: number
	private consecutiveMistakeCount: number = 0
	private consecutiveMistakeCountForApplyDiff: Map<string, number> = new Map()
	private consecutiveNoToolUseCount: number = 0
	toolUsage: ToolUsage = {}
	toolRepetitionDetector: ToolRepetitionDetector

	constructor(options: ToolExecutorOptions) {
		this.consecutiveMistakeLimit = options.consecutiveMistakeLimit
		this.toolRepetitionDetector = new ToolRepetitionDetector(this.consecutiveMistakeLimit)
	}

	recordToolUsage(toolName: ToolName): void {
		if (!this.toolUsage[toolName]) {
			this.toolUsage[toolName] = {
				attempts: 0,
				failures: 0,
			}
		}
		this.toolUsage[toolName].attempts++
	}

	recordToolError(toolName: ToolName, error?: string): void {
		if (!this.toolUsage[toolName]) {
			this.toolUsage[toolName] = {
				attempts: 0,
				failures: 0,
			}
		}
		this.toolUsage[toolName].failures++
	}

	recordToolSuccess(toolName: ToolName): void {
		if (!this.toolUsage[toolName]) {
			this.toolUsage[toolName] = {
				attempts: 0,
				failures: 0,
			}
		}
		this.toolUsage[toolName].attempts++
	}

	incrementMistakeCount(): void {
		this.consecutiveMistakeCount++
	}

	resetMistakeCount(): void {
		this.consecutiveMistakeCount = 0
	}

	incrementNoToolUseCount(): void {
		this.consecutiveNoToolUseCount++
	}

	resetNoToolUseCount(): void {
		this.consecutiveNoToolUseCount = 0
	}

	getMistakeCount(): number {
		return this.consecutiveMistakeCount
	}

	getNoToolUseCount(): number {
		return this.consecutiveNoToolUseCount
	}

	hasReachedMistakeLimit(): boolean {
		return this.consecutiveMistakeLimit > 0 && this.consecutiveMistakeCount >= this.consecutiveMistakeLimit
	}

	getToolUsage(): ToolUsage {
		return this.toolUsage
	}

	getRepetitionDetector(): ToolRepetitionDetector {
		return this.toolRepetitionDetector
	}

	incrementApplyDiffMistakeCount(filePath: string): void {
		const currentCount = this.consecutiveMistakeCountForApplyDiff.get(filePath) || 0
		this.consecutiveMistakeCountForApplyDiff.set(filePath, currentCount + 1)
	}

	getApplyDiffMistakeCount(filePath: string): number {
		return this.consecutiveMistakeCountForApplyDiff.get(filePath) || 0
	}

	resetApplyDiffMistakeCount(filePath: string): void {
		this.consecutiveMistakeCountForApplyDiff.delete(filePath)
	}
}
