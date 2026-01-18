import {
	type ProviderName,
	type ModelInfo,
	anthropicModels,
	claudeCodeModels,
	geminiModels,
	openAiNativeModels,
	qwenCodeModels,
} from "@shared/types"

export const MODELS_BY_PROVIDER: Partial<Record<ProviderName, Record<string, ModelInfo>>> = {
	anthropic: anthropicModels,
	"claude-code": claudeCodeModels,
	gemini: geminiModels,
	"openai-native": openAiNativeModels,
	"qwen-code": qwenCodeModels,
}

export const PROVIDERS = [
	{ value: "anthropic", label: "Anthropic" },
	{ value: "claude-code", label: "Claude Code" },
	{ value: "gemini", label: "Google Gemini" },
	{ value: "openai-native", label: "OpenAI" },
	{ value: "openai", label: "OpenAI Compatible" },
	{ value: "qwen-code", label: "Qwen Code" },
	{ value: "human-relay", label: "Human Relay" },
].sort((a, b) => a.label.localeCompare(b.label))
