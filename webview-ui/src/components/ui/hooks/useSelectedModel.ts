import {
	type ProviderName,
	type ProviderSettings,
	type ModelInfo,
	anthropicModels,
	geminiModels,
	openAiModelInfoSaneDefaults,
	openAiNativeModels,
	claudeCodeModels,
	normalizeClaudeCodeModelId,
	qwenCodeModels,
	getProviderDefaultModelId,
	NATIVE_TOOL_DEFAULTS,
} from "@roo-code/types"

import type { ModelRecord } from "@roo/api"
import { useMemo } from "react"

/**
 * Helper to get a validated model ID for dynamic providers.
 * Returns the configured model ID if it exists in the available models, otherwise returns the default.
 */
function getValidatedModelId(
	configuredId: string | undefined,
	availableModels: ModelRecord | undefined,
	defaultModelId: string,
): string {
	return configuredId && availableModels?.[configuredId] ? configuredId : defaultModelId
}

function getSelectedModel({
	provider,
	apiConfiguration,
}: {
	provider: ProviderName
	apiConfiguration: ProviderSettings
}): { id: string; info: ModelInfo | undefined } {
	// the `undefined` case are used to show the invalid selection to prevent
	// users from seeing the default model if their selection is invalid
	// this gives a better UX than showing the default model
	const defaultModelId = getProviderDefaultModelId(provider)
	switch (provider) {
		case "gemini": {
			const id = apiConfiguration.apiModelId ?? defaultModelId
			const info = geminiModels[id as keyof typeof geminiModels]
			return { id, info }
		}
		case "openai-native": {
			const id = apiConfiguration.apiModelId ?? defaultModelId
			const info = openAiNativeModels[id as keyof typeof openAiNativeModels]
			return { id, info }
		}
		case "openai": {
			const id = apiConfiguration.openAiModelId ?? ""
			const customInfo = apiConfiguration?.openAiCustomModelInfo
			// Only merge native tool call defaults, not prices or other model-specific info
			const nativeToolDefaults = {
				supportsNativeTools: openAiModelInfoSaneDefaults.supportsNativeTools,
				defaultToolProtocol: openAiModelInfoSaneDefaults.defaultToolProtocol,
			}
			const info = customInfo ? { ...nativeToolDefaults, ...customInfo } : openAiModelInfoSaneDefaults
			return { id, info }
		}
		case "claude-code": {
			// Claude Code models extend anthropic models but with images and prompt caching disabled
			// Normalize legacy model IDs to current canonical model IDs for backward compatibility
			const rawId = apiConfiguration.apiModelId ?? defaultModelId
			const normalizedId = normalizeClaudeCodeModelId(rawId)
			const info = claudeCodeModels[normalizedId]
			return { id: normalizedId, info: { ...openAiModelInfoSaneDefaults, ...info } }
		}
		case "qwen-code": {
			const id = apiConfiguration.apiModelId ?? defaultModelId
			const info = qwenCodeModels[id as keyof typeof qwenCodeModels]
			return { id, info }
		}
		
		default: {
			provider satisfies "anthropic" | "gemini-cli" | "qwen-code" | "human-relay"
			const id = apiConfiguration.apiModelId ?? defaultModelId
			const baseInfo = anthropicModels[id as keyof typeof anthropicModels]

			// Apply 1M context beta tier pricing for Claude Sonnet 4
			if (
				provider === "anthropic" &&
				(id === "claude-sonnet-4-20250514" || id === "claude-sonnet-4-5") &&
				apiConfiguration.anthropicBeta1MContext &&
				baseInfo
			) {
				// Type assertion since we know claude-sonnet-4-20250514 and claude-sonnet-4-5 have tiers
				const modelWithTiers = baseInfo as typeof baseInfo & {
					tiers?: Array<{
						contextWindow: number
						inputPrice?: number
						outputPrice?: number
						cacheWritesPrice?: number
						cacheReadsPrice?: number
					}>
				}
				const tier = modelWithTiers.tiers?.[0]
				if (tier) {
					// Create a new ModelInfo object with updated values
					const info: ModelInfo = {
						...baseInfo,
						contextWindow: tier.contextWindow,
						inputPrice: tier.inputPrice ?? baseInfo.inputPrice,
						outputPrice: tier.outputPrice ?? baseInfo.outputPrice,
						cacheWritesPrice: tier.cacheWritesPrice ?? baseInfo.cacheWritesPrice,
						cacheReadsPrice: tier.cacheReadsPrice ?? baseInfo.cacheReadsPrice,
					}
					return { id, info }
				}
			}

			return { id, info: baseInfo }
		}
	}
}

export function useSelectedModel(apiConfiguration?: ProviderSettings) {
	return useMemo(() => {
		const provider = apiConfiguration?.apiProvider || "anthropic"
		const { id, info } = getSelectedModel({ provider, apiConfiguration: apiConfiguration || {} })
		return { provider, id, info }
	}, [apiConfiguration])
}
