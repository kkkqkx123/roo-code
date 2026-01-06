export * from "./anthropic.js"
export * from "./claude-code.js"
export * from "./gemini.js"
export * from "./openai.js"
export * from "./qwen-code.js"

import { anthropicDefaultModelId } from "./anthropic.js"
import { claudeCodeDefaultModelId } from "./claude-code.js"
import { geminiDefaultModelId } from "./gemini.js"
import { qwenCodeDefaultModelId } from "./qwen-code.js"

// Import the ProviderName type from provider-settings to avoid duplication
import type { ProviderName } from "../provider-settings.js"

/**
 * Get the default model ID for a given provider.
 * This function returns only the provider's default model ID, without considering user configuration.
 * Used as a fallback when provider models are still loading.
 */
export function getProviderDefaultModelId(
	provider: ProviderName,
	options: { isChina?: boolean } = { isChina: false },
): string {
	switch (provider) {
		case "gemini":
			return geminiDefaultModelId
		case "openai-native":
			return "gpt-4o" // Based on openai-native patterns
		case "openai":
			return "" // OpenAI provider uses custom model configuration
		case "claude-code":
			return claudeCodeDefaultModelId
		case "qwen-code":
			return qwenCodeDefaultModelId
		case "anthropic":
		case "gemini-cli":
		case "human-relay":
		default:
			return anthropicDefaultModelId
	}
}
