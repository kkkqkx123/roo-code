import {
	type ModelInfo,
	type ProviderSettings,
	ANTHROPIC_DEFAULT_MAX_TOKENS,
} from "@shared/types"

export type ModelRecord = Record<string, ModelInfo>

export type ApiHandlerOptions = Omit<ProviderSettings, "apiProvider"> & {
	enableResponsesReasoningSummary?: boolean
}

export const shouldUseReasoningBudget = ({
	model,
	settings,
}: {
	model: ModelInfo
	settings?: ProviderSettings
}): boolean => !!model.requiredReasoningBudget || (!!model.supportsReasoningBudget && !!settings?.enableReasoningEffort)

export const shouldUseReasoningEffort = ({
	model,
	settings,
}: {
	model: ModelInfo
	settings?: ProviderSettings
}): boolean => {
	if (settings?.enableReasoningEffort === false) return false

	const selectedEffort = (settings?.reasoningEffort ?? (model as any).reasoningEffort) as
		| "disable"
		| "none"
		| "minimal"
		| "low"
		| "medium"
		| "high"
		| undefined

	if (selectedEffort === "disable") return false

	const cap = model.supportsReasoningEffort as unknown

	if (Array.isArray(cap)) {
		return !!selectedEffort && (cap as ReadonlyArray<string>).includes(selectedEffort as string)
	}

	if (model.supportsReasoningEffort === true) {
		return !!selectedEffort
	}

	const modelDefaultEffort = (model as any).reasoningEffort as
		| "none"
		| "minimal"
		| "low"
		| "medium"
		| "high"
		| undefined
	return !!modelDefaultEffort
}

export const DEFAULT_HYBRID_REASONING_MODEL_MAX_TOKENS = 16_384
export const DEFAULT_HYBRID_REASONING_MODEL_THINKING_TOKENS = 8_192
export const GEMINI_25_PRO_MIN_THINKING_TOKENS = 128

export const getModelMaxOutputTokens = ({
	modelId,
	model,
	settings,
	format,
}: {
	modelId: string
	model: ModelInfo
	settings?: ProviderSettings
	format?: "anthropic" | "openai" | "gemini"
}): number | undefined => {
	if (shouldUseReasoningBudget({ model, settings })) {
		return settings?.modelMaxTokens || DEFAULT_HYBRID_REASONING_MODEL_MAX_TOKENS
	}

	const isAnthropicContext = modelId.includes("claude") || format === "anthropic"

	if (model.supportsReasoningBudget && isAnthropicContext) {
		return ANTHROPIC_DEFAULT_MAX_TOKENS
	}

	if (isAnthropicContext && (!model.maxTokens || model.maxTokens === 0)) {
		return ANTHROPIC_DEFAULT_MAX_TOKENS
	}

	if (model.maxTokens) {
		const isGpt5Model = modelId.toLowerCase().includes("gpt-5")

		if (isGpt5Model) {
			return model.maxTokens
		}

		return Math.min(model.maxTokens, Math.ceil(model.contextWindow * 0.2))
	}

	if (format) {
		return undefined
	}

	return ANTHROPIC_DEFAULT_MAX_TOKENS
}
