/**
 * Context Management Module
 *
 * This module provides unified context management for conversations, combining:
 * - Intelligent condensation of prior messages when approaching configured thresholds
 * - Sliding window truncation as a fallback when necessary
 * - Token estimation utilities
 * - Context error handling
 */

// Re-export all types
export * from "./types"

// Re-export token utilities
export { estimateTokenCount } from "./token-utils"

// Re-export truncation functions
export { truncateConversation } from "./truncation"

// Re-export summarization functions
export {
	summarizeConversation,
	getKeepMessagesWithToolBlocks,
	getMessagesSinceLastSummary,
	getEffectiveApiHistory,
	cleanupAfterTruncation,
} from "./summarization"

// Re-export context management functions
export { manageContext, willManageContext } from "./context-manager"

// Re-export error handling functions
export { checkContextWindowExceededError } from "./context-error-handling"

// Re-export constants for backward compatibility
export {
	TOKEN_BUFFER_PERCENTAGE,
	DEFAULT_CONTEXT_CONDENSE_PERCENT,
	N_MESSAGES_TO_KEEP,
	MIN_CONDENSE_THRESHOLD,
	MAX_CONDENSE_THRESHOLD,
} from "./types"