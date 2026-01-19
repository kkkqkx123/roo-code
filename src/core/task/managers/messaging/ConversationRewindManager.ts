import { Task } from "../../Task"
import { ClineMessage } from "@shared/types"
import { ApiMessage } from "../../../task-persistence"
import { cleanupAfterTruncation } from "../../../context"

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

		const clineIndex = this.task.clineMessages.findIndex((m: ClineMessage) => m.ts === ts)
		if (clineIndex === -1) {
			// 尝试找到最接近的消息
			const closestIndex = this.findClosestMessageIndex(ts)
			if (closestIndex === -1) {
				throw new Error(`Message with timestamp ${ts} not found in clineMessages`)
			}
			
			console.warn(`[ConversationRewindManager] Message with timestamp ${ts} not found, using closest message at ${this.task.clineMessages[closestIndex].ts}`)
			const cutoffIndex = includeTargetMessage ? closestIndex + 1 : closestIndex
			await this.performRewind(cutoffIndex, this.task.clineMessages[closestIndex].ts, { skipCleanup })
			return
		}

		const cutoffIndex = includeTargetMessage ? clineIndex + 1 : clineIndex

		await this.performRewind(cutoffIndex, ts, { skipCleanup })
	}

	private findClosestMessageIndex(ts: number): number {
		if (this.task.clineMessages.length === 0) {
			return -1
		}

		// 使用二分查找优化性能（假设消息按时间戳排序）
		let left = 0
		let right = this.task.clineMessages.length - 1
		let closestIndex = -1
		let minDiff = Infinity

		while (left <= right) {
			const mid = Math.floor((left + right) / 2)
			const diff = Math.abs(this.task.clineMessages[mid].ts - ts)

			if (diff < minDiff) {
				minDiff = diff
				closestIndex = mid
			}

			if (this.task.clineMessages[mid].ts < ts) {
				left = mid + 1
			} else {
				right = mid - 1
			}
		}

		return closestIndex
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

	private collectRemovedContextEventIds(toIndex: number): ContextEventIds {
		const condenseIds = new Set<string>()
		const truncationIds = new Set<string>()

		for (let i = toIndex; i < this.task.clineMessages.length; i++) {
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
		
		// 1. 计算实际的截止时间戳
		const actualCutoff = this.calculateActualCutoff(cutoffTs)

		// 2. 按时间戳过滤
		let apiHistory = this.filterByTimestamp(originalHistory, actualCutoff)

		// 3. 移除孤立的摘要
		apiHistory = this.removeOrphanedSummaries(apiHistory, removedIds.condenseIds)

		// 4. 移除孤立的截断标记
		apiHistory = this.removeOrphanedTruncationMarkers(apiHistory, removedIds.truncationIds)

		// 5. 清理（如果需要）
		if (!skipCleanup) {
			apiHistory = cleanupAfterTruncation(apiHistory)
		}

		// 6. 保存（仅当有变化时）
		await this.saveIfChanged(apiHistory, originalHistory)
	}

	private calculateActualCutoff(cutoffTs: number): number {
		const apiHistory = this.task.apiConversationHistory
		const hasExactMatch = apiHistory.some((m) => m.ts === cutoffTs)
		const hasMessageBeforeCutoff = apiHistory.some((m) => m.ts !== undefined && m.ts < cutoffTs)

		if (!hasExactMatch && hasMessageBeforeCutoff) {
			const firstUserMsgIndexToRemove = apiHistory.findIndex(
				(m) => m.ts !== undefined && m.ts >= cutoffTs && m.role === "user",
			)

			if (firstUserMsgIndexToRemove !== -1) {
				return apiHistory[firstUserMsgIndexToRemove].ts!
			}
		}

		return cutoffTs
	}

	private filterByTimestamp(history: ApiMessage[], cutoffTs: number): ApiMessage[] {
		return history.filter((m) => !m.ts || m.ts < cutoffTs)
	}

	private removeOrphanedSummaries(history: ApiMessage[], condenseIds: Set<string>): ApiMessage[] {
		if (condenseIds.size === 0) {
			return history
		}

		return history.filter((msg) => {
			if (msg.isSummary && msg.condenseId && condenseIds.has(msg.condenseId)) {
				console.log(`[ConversationRewindManager] Removing orphaned Summary with condenseId: ${msg.condenseId}`)
				return false
			}
			return true
		})
	}

	private removeOrphanedTruncationMarkers(history: ApiMessage[], truncationIds: Set<string>): ApiMessage[] {
		if (truncationIds.size === 0) {
			return history
		}

		return history.filter((msg) => {
			if (msg.isTruncationMarker && msg.truncationId && truncationIds.has(msg.truncationId)) {
				console.log(
					`[ConversationRewindManager] Removing orphaned truncation marker with truncationId: ${msg.truncationId}`,
				)
				return false
			}
			return true
		})
	}

	private async saveIfChanged(newHistory: ApiMessage[], originalHistory: ApiMessage[]): Promise<void> {
		const historyChanged =
			newHistory.length !== originalHistory.length ||
			newHistory.some((msg, i) => JSON.stringify(msg) !== JSON.stringify(originalHistory[i]))

		if (historyChanged) {
			await this.task.overwriteApiConversationHistory(newHistory)
		}
	}
}
