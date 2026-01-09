import type { TokenUsage, ToolUsage, ToolName, ClineMessage } from "@roo-code/types"
import { hasTokenUsageChanged, hasToolUsageChanged } from "../../../shared/getApiMetrics"
import { combineApiRequests } from "../../../shared/combineApiRequests"
import { combineCommandSequences } from "../../../shared/combineCommandSequences"
import debounce from "lodash.debounce"

export interface UsageTrackerOptions {
	emitTokenUsage: (tokenUsage: TokenUsage, toolUsage: ToolUsage) => void
	emitIntervalMs?: number
}

export class UsageTracker {
	private debouncedEmitTokenUsage: ReturnType<typeof debounce>

	tokenUsage: TokenUsage = {
		totalTokensIn: 0,
		totalTokensOut: 0,
		totalCacheWrites: undefined,
		totalCacheReads: undefined,
		totalCost: 0,
		contextTokens: 0,
	}
	toolUsage: ToolUsage = {}

	private tokenUsageSnapshot?: TokenUsage
	private toolUsageSnapshot?: ToolUsage
	private tokenUsageSnapshotAt?: number

	constructor(options: UsageTrackerOptions) {
		const emitIntervalMs = options.emitIntervalMs ?? 2000

		this.debouncedEmitTokenUsage = debounce(
			(tokenUsage: TokenUsage, toolUsage: ToolUsage) => {
				const tokenChanged = hasTokenUsageChanged(tokenUsage, this.tokenUsageSnapshot)
				const toolChanged = hasToolUsageChanged(toolUsage, this.toolUsageSnapshot)

				if (tokenChanged || toolChanged) {
					options.emitTokenUsage(tokenUsage, toolUsage)
					this.tokenUsageSnapshot = tokenUsage
					this.toolUsageSnapshot = toolUsage
				}
			},
			emitIntervalMs,
			{
				leading: true,
				trailing: true,
				maxWait: emitIntervalMs,
			},
		)
	}

	recordUsage(chunk: any): void {
		if (chunk.inputTokens !== undefined) {
			this.tokenUsage.totalTokensIn += chunk.inputTokens
		}
		if (chunk.outputTokens !== undefined) {
			this.tokenUsage.totalTokensOut += chunk.outputTokens
		}
		if (chunk.cacheWriteTokens !== undefined) {
			this.tokenUsage.totalCacheWrites = (this.tokenUsage.totalCacheWrites ?? 0) + chunk.cacheWriteTokens
		}
		if (chunk.cacheReadTokens !== undefined) {
			this.tokenUsage.totalCacheReads = (this.tokenUsage.totalCacheReads ?? 0) + chunk.cacheReadTokens
		}
		if (chunk.totalCost !== undefined) {
			this.tokenUsage.totalCost += chunk.totalCost
		}

		this.debouncedEmitTokenUsage(this.tokenUsage, this.toolUsage)
	}

	emitFinalTokenUsageUpdate(): void {
		this.debouncedEmitTokenUsage.flush()
	}

	getTokenUsage(): TokenUsage {
		return this.tokenUsage
	}

	setTokenUsage(tokenUsage: TokenUsage): void {
		this.tokenUsage = tokenUsage
		this.debouncedEmitTokenUsage(this.tokenUsage, this.toolUsage)
	}

	getToolUsage(): ToolUsage {
		return this.toolUsage
	}

	setToolUsage(toolUsage: ToolUsage): void {
		this.toolUsage = toolUsage
		this.debouncedEmitTokenUsage(this.tokenUsage, this.toolUsage)
	}

	recordToolUsage(toolName: ToolName): void {
		if (!this.toolUsage[toolName]) {
			this.toolUsage[toolName] = {
				attempts: 0,
				failures: 0,
			}
		}
		this.toolUsage[toolName].attempts++
		this.debouncedEmitTokenUsage(this.tokenUsage, this.toolUsage)
	}

	recordToolError(toolName: ToolName, error?: string): void {
		if (!this.toolUsage[toolName]) {
			this.toolUsage[toolName] = {
				attempts: 0,
				failures: 0,
			}
		}
		this.toolUsage[toolName].failures++
		this.debouncedEmitTokenUsage(this.tokenUsage, this.toolUsage)
	}

	getSnapshot(): { tokenUsage?: TokenUsage; toolUsage?: ToolUsage; timestamp?: number } {
		return {
			tokenUsage: this.tokenUsageSnapshot,
			toolUsage: this.toolUsageSnapshot,
			timestamp: this.tokenUsageSnapshotAt,
		}
	}

	clearSnapshot(): void {
		this.tokenUsageSnapshot = undefined
		this.toolUsageSnapshot = undefined
		this.tokenUsageSnapshotAt = undefined
	}

	combineMessages(messages: ClineMessage[]): ClineMessage[] {
		return combineApiRequests(combineCommandSequences(messages))
	}
}
