import type { ClineAsk } from "@shared/types"

export const blockingAsks = [
	"followup",
	"command",
	"tool",
	"browser_action_launch",
	"use_mcp_server",
] as const satisfies readonly ClineAsk[]

export type BlockingAsk = (typeof blockingAsks)[number]

export function isBlockingAsk(ask: ClineAsk): ask is BlockingAsk {
	return (blockingAsks as readonly ClineAsk[]).includes(ask)
}

export const nonBlockingAsks = [
	"command_output",
] as const satisfies readonly ClineAsk[]

export type NonBlockingAsk = (typeof nonBlockingAsks)[number]

export function isNonBlockingAsk(ask: ClineAsk): ask is NonBlockingAsk {
	return (nonBlockingAsks as readonly ClineAsk[]).includes(ask)
}

export const mutableAsks = ["resume_task"] as const satisfies readonly ClineAsk[]

export type MutableAsk = (typeof mutableAsks)[number]

export function isMutableAsk(ask: ClineAsk): ask is MutableAsk {
	return (mutableAsks as readonly ClineAsk[]).includes(ask)
}

export const terminalAsks = [
	"completion_result",
	"api_req_failed",
	"resume_completed_task",
	"mistake_limit_reached",
	"auto_approval_max_req_reached",
] as const satisfies readonly ClineAsk[]

export type TerminalAsk = (typeof terminalAsks)[number]

export function isTerminalAsk(ask: ClineAsk): ask is TerminalAsk {
	return (terminalAsks as readonly ClineAsk[]).includes(ask)
}
