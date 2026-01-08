import { BetaThinkingConfigParam } from "@anthropic-ai/sdk/resources/beta"
import OpenAI from "openai"
import type { GenerateContentConfig } from "@google/genai"

import type { ModelInfo, ProviderSettings, ReasoningEffortExtended } from "@roo-code/types"

import { shouldUseReasoningBudget, shouldUseReasoningEffort } from "../../shared/api"

export type AnthropicReasoningParams = BetaThinkingConfigParam

export type OpenAiReasoningParams = { reasoning_effort: OpenAI.Chat.ChatCompletionCreateParams["reasoning_effort"] }

// Valid Gemini thinking levels for effort-based reasoning
const GEMINI_THINKING_LEVELS = ["minimal", "low", "medium", "high"] as const

export type GeminiThinkingLevel = (typeof GEMINI_THINKING_LEVELS)[number]

export function isGeminiThinkingLevel(value: unknown): value is GeminiThinkingLevel {
	return typeof value === "string" && GEMINI_THINKING_LEVELS.includes(value as GeminiThinkingLevel)
}

export type GeminiReasoningParams = GenerateContentConfig["thinkingConfig"] & {
	thinkingLevel?: GeminiThinkingLevel
}

export type GetModelReasoningOptions = {
	model: ModelInfo
	reasoningBudget: number | undefined
	reasoningEffort: ReasoningEffortExtended | "disable" | undefined
	settings: ProviderSettings
}

export const getAnthropicReasoning = ({
	model,
	reasoningBudget,
	settings,
}: GetModelReasoningOptions): AnthropicReasoningParams | undefined =>
	shouldUseReasoningBudget({ model, settings }) ? { type: "enabled", budget_tokens: reasoningBudget! } : undefined

export const getOpenAiReasoning = ({
	model,
	reasoningEffort,
	settings,
}: GetModelReasoningOptions): OpenAiReasoningParams | undefined => {
	if (!shouldUseReasoningEffort({ model, settings })) return undefined
	if (reasoningEffort === "disable" || !reasoningEffort) return undefined

	// Include "none" | "minimal" | "low" | "medium" | "high" literally
	return {
		reasoning_effort: reasoningEffort as OpenAI.Chat.ChatCompletionCreateParams["reasoning_effort"],
	}
}

export const getGeminiReasoning = ({
	model,
	reasoningBudget,
	reasoningEffort,
	settings,
}: GetModelReasoningOptions): GeminiReasoningParams | undefined => {
	// Budget-based (2.5) models: use thinkingBudget, not thinkingLevel.
	if (shouldUseReasoningBudget({ model, settings })) {
		return { thinkingBudget: reasoningBudget!, includeThoughts: true }
	}

	// For effort-based Gemini models, rely directly on the selected effort value.
	// We intentionally ignore enableReasoningEffort here so that explicitly chosen
	// efforts in the UI (e.g. "High" for gemini-3-pro-preview) always translate
	// into a thinkingConfig, regardless of legacy boolean flags.
	const selectedEffort = (settings.reasoningEffort ?? model.reasoningEffort) as
		| ReasoningEffortExtended
		| "disable"
		| undefined

	// Respect "off" / unset semantics from the effort selector itself.
	if (!selectedEffort || selectedEffort === "disable") {
		return undefined
	}

	// Effort-based models on Google GenAI support minimal/low/medium/high levels.
	if (!isGeminiThinkingLevel(selectedEffort)) {
		return undefined
	}

	return { thinkingLevel: selectedEffort, includeThoughts: true }
}
