import { Task } from "../task/Task"
import { ClineMessage } from "@roo-code/types"
import { ApiMessage } from "../task-persistence/apiMessages"
import { cleanupAfterTruncation } from "../condense"

export interface RewindOptions {
	includeTargetMessage?: boolean
	skipCleanup?: boolean
}

interface ContextEventIds {
	condenseIds: Set<string>
	truncationIds: Set<string>
}

export class ConversationRewindManager {
	constructor(private task: Task) {}

	async rewindToTimestamp(ts: number, options: RewindOptions = {}): Promise<void> {
		const { includeTargetMessage = false, skipCleanup = false } = options

		const clineIndex = this.task.clineMessages.findIndex((m) => m.ts === ts)
		if (clineIndex === -1) {
			throw new Error(`Message with timestamp ${ts} not found in clineMessages`)
		}

		const cutoffIndex = includeTargetMessage ? clineIndex + 1 : clineIndex

		await this.performRewind(cutoffIndex, ts, { skipCleanup })
	}

	async rewindToIndex(toIndex: number, options: RewindOptions = {}): Promise<void> {
		const cutoffTs = this.task.clineMessages[toIndex]?.ts ?? Date.now()
		await this.performRewind(toIndex, cutoffTs, options)
	}

	private async performRewind(toIndex: number, cutoffTs: number, options: RewindOptions): Promise<void> {
		const { skipCleanup = false } = options

		const removedIds = this.collectRemovedContextEventIds(toIndex)

		await this.truncateClineMessages(toIndex)

		await this.truncateApiHistoryWithCleanup(cutoffTs, removedIds, skipCleanup)
	}

	private collectRemovedContextEventIds(fromIndex: number): ContextEventIds {
		const condenseIds = new Set<string>()
		const truncationIds = new Set<string>()

		for (let i = fromIndex; i < this.task.clineMessages.length; i++) {
			const msg = this.task.clineMessages[i]

			if (msg.say === "condense_context" && msg.contextCondense?.condenseId) {
				condenseIds.add(msg.contextCondense.condenseId)
				console.log(`[ConversationRewindManager] Found condense_context to remove: ${msg.contextCondense.condenseId}`)
			}

			if (msg.say === "sliding_window_truncation" && msg.contextTruncation?.truncationId) {
				truncationIds.add(msg.contextTruncation.truncationId)
				console.log(
					`[ConversationRewindManager] Found sliding_window_truncation to remove: ${msg.contextTruncation.truncationId}`,
				)
			}
		}

		return { condenseIds, truncationIds }
	}

	private async truncateClineMessages(toIndex: number): Promise<void> {
		await this.task.overwriteClineMessages(this.task.clineMessages.slice(0, toIndex))
	}

	private async truncateApiHistoryWithCleanup(
		cutoffTs: number,
		removedIds: ContextEventIds,
		skipCleanup: boolean,
	): Promise<void> {
		const originalHistory = this.task.apiConversationHistory
		let apiHistory = [...originalHistory]

		const hasExactMatch = apiHistory.some((m) => m.ts === cutoffTs)
		const hasMessageBeforeCutoff = apiHistory.some((m) => m.ts !== undefined && m.ts < cutoffTs)

		let actualCutoff: number = cutoffTs

		if (!hasExactMatch && hasMessageBeforeCutoff) {
			const firstUserMsgIndexToRemove = apiHistory.findIndex(
				(m) => m.ts !== undefined && m.ts >= cutoffTs && m.role === "user",
			)

			if (firstUserMsgIndexToRemove !== -1) {
				actualCutoff = apiHistory[firstUserMsgIndexToRemove].ts!
			}
		}

		apiHistory = apiHistory.filter((m) => !m.ts || m.ts < actualCutoff)

		if (removedIds.condenseIds.size > 0) {
			apiHistory = apiHistory.filter((msg) => {
				if (msg.isSummary && msg.condenseId && removedIds.condenseIds.has(msg.condenseId)) {
					console.log(`[ConversationRewindManager] Removing orphaned Summary with condenseId: ${msg.condenseId}`)
					return false
				}
				return true
			})
		}

		if (removedIds.truncationIds.size > 0) {
			apiHistory = apiHistory.filter((msg) => {
				if (msg.isTruncationMarker && msg.truncationId && removedIds.truncationIds.has(msg.truncationId)) {
					console.log(
						`[ConversationRewindManager] Removing orphaned truncation marker with truncationId: ${msg.truncationId}`,
					)
					return false
				}
				return true
			})
		}

		if (!skipCleanup) {
			apiHistory = cleanupAfterTruncation(apiHistory)
		}

		const historyChanged =
			apiHistory.length !== originalHistory.length || apiHistory.some((msg, i) => msg !== originalHistory[i])

		if (historyChanged) {
			await this.task.overwriteApiConversationHistory(apiHistory)
		}
	}
}
