// npx vitest src/core/context/__tests__/rewind-after-condense.spec.ts

/**
 * Regression tests for issue: "Rewind after Condense is broken"
 * https://github.com/RooCodeInc/Roo-Code/issues/8295
 *
 * These tests verify that when a user rewinds (deletes/truncates) their conversation
 * after a condense operation, orphaned condensed messages are properly reactivated
 * so they can be sent to the API again.
 */

import { getEffectiveApiHistory, cleanupAfterTruncation } from "../"
import { ApiMessage } from "../../task-persistence"

describe("Rewind After Condense - Issue #8295", () => {

	describe("getEffectiveApiHistory", () => {
		it("should filter out messages tagged with condenseParent", () => {
			const condenseId = "summary-123"
			const messages: ApiMessage[] = [
				{ role: "user", content: "First message", ts: 1 },
				{ role: "assistant", content: "First response", ts: 2, condenseParent: condenseId },
				{ role: "user", content: "Second message", ts: 3, condenseParent: condenseId },
				{ role: "assistant", content: "Summary", ts: 4, isSummary: true, condenseId },
				{ role: "user", content: "Third message", ts: 5 },
				{ role: "assistant", content: "Third response", ts: 6 },
			]

			const effective = getEffectiveApiHistory(messages)

			// Effective history should be: first message, summary, third message, third response
			expect(effective.length).toBe(4)
			expect(effective[0].content).toBe("First message")
			expect(effective[1].isSummary).toBe(true)
			expect(effective[2].content).toBe("Third message")
			expect(effective[3].content).toBe("Third response")
		})

		it("should include messages without condenseParent", () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Hello", ts: 1 },
				{ role: "assistant", content: "Hi", ts: 2 },
			]

			const effective = getEffectiveApiHistory(messages)

			expect(effective.length).toBe(2)
			expect(effective).toEqual(messages)
		})

		it("should handle empty messages array", () => {
			const effective = getEffectiveApiHistory([])
			expect(effective).toEqual([])
		})
	})

	describe("cleanupAfterTruncation", () => {
		it("should clear condenseParent when summary message is deleted", () => {
			const condenseId = "summary-123"
			const messages: ApiMessage[] = [
				{ role: "user", content: "First message", ts: 1 },
				{ role: "assistant", content: "First response", ts: 2, condenseParent: condenseId },
				{ role: "user", content: "Second message", ts: 3, condenseParent: condenseId },
				// Summary is NOT in the array (was truncated/deleted)
			]

			const cleaned = cleanupAfterTruncation(messages)

			// All condenseParent tags should be cleared since summary is gone
			expect(cleaned[1].condenseParent).toBeUndefined()
			expect(cleaned[2].condenseParent).toBeUndefined()
		})

		it("should preserve condenseParent when summary message still exists", () => {
			const condenseId = "summary-123"
			const messages: ApiMessage[] = [
				{ role: "user", content: "First message", ts: 1 },
				{ role: "assistant", content: "First response", ts: 2, condenseParent: condenseId },
				{ role: "assistant", content: "Summary", ts: 3, isSummary: true, condenseId },
			]

			const cleaned = cleanupAfterTruncation(messages)

			// condenseParent should remain since summary exists
			expect(cleaned[1].condenseParent).toBe(condenseId)
		})

		it("should handle multiple condense operations with different IDs", () => {
			const condenseId1 = "summary-1"
			const condenseId2 = "summary-2"
			const messages: ApiMessage[] = [
				{ role: "user", content: "Message 1", ts: 1, condenseParent: condenseId1 },
				{ role: "assistant", content: "Summary 1", ts: 2, isSummary: true, condenseId: condenseId1 },
				{ role: "user", content: "Message 2", ts: 3, condenseParent: condenseId2 },
				// Summary 2 is NOT present (was truncated)
			]

			const cleaned = cleanupAfterTruncation(messages)

			// condenseId1 should remain (summary exists)
			expect(cleaned[0].condenseParent).toBe(condenseId1)
			// condenseId2 should be cleared (summary deleted)
			expect(cleaned[2].condenseParent).toBeUndefined()
		})

		it("should not modify messages without condenseParent", () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Hello", ts: 1 },
				{ role: "assistant", content: "Hi", ts: 2 },
			]

			const cleaned = cleanupAfterTruncation(messages)

			expect(cleaned).toEqual(messages)
		})

		it("should handle empty messages array", () => {
			const cleaned = cleanupAfterTruncation([])
			expect(cleaned).toEqual([])
		})
	})
})
