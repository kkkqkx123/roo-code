import { z } from "zod"

import { modelInfoSchema, reasoningEffortSettingSchema, verbosityLevelsSchema, serviceTierSchema } from "./model.js"
import { codebaseIndexProviderSchema } from "./codebase-index.js"
import {
	anthropicModels,
	claudeCodeModels,
	geminiModels,
	openAiNativeModels,
	qwenCodeModels,
} from "./providers/index.js"

/**
 * constants
 */

export const DEFAULT_CONSECUTIVE_MISTAKE_LIMIT = 3

/**
 * CustomProvider
 *
 * Custom providers are completely configurable within Roo Code settings.
 */

export const customProviders = ["openai"] as const

export type CustomProvider = (typeof customProviders)[number]

export const isCustomProvider = (key: string): key is CustomProvider => customProviders.includes(key as CustomProvider)

/**
 * FauxProvider
 *
 * Faux providers do not make external inference calls and therefore do not have
 * model lists.
 */

export const fauxProviders = ["human-relay"] as const

export type FauxProvider = (typeof fauxProviders)[number]

export const isFauxProvider = (key: string): key is FauxProvider => fauxProviders.includes(key as FauxProvider)

/**
 * ProviderName
 */

export const providerNames = [
	...customProviders,
	...fauxProviders,
	"anthropic",
	"claude-code",
	"gemini",
	"gemini-cli",
	"openai-native",
	"qwen-code",
] as const

export const providerNamesSchema = z.enum(providerNames)

export type ProviderName = z.infer<typeof providerNamesSchema>

export const isProviderName = (key: unknown): key is ProviderName =>
	typeof key === "string" && providerNames.includes(key as ProviderName)

/**
 * ProviderSettingsEntry
 */

export const providerSettingsEntrySchema = z.object({
	id: z.string(),
	name: z.string(),
	apiProvider: providerNamesSchema.optional(),
	modelId: z.string().optional(),
})

export type ProviderSettingsEntry = z.infer<typeof providerSettingsEntrySchema>

/**
 * ProviderSettings
 */

const baseProviderSettingsSchema = z.object({
	includeMaxTokens: z.boolean().optional(),
	diffEnabled: z.boolean().optional(),
	todoListEnabled: z.boolean().optional(),
	fuzzyMatchThreshold: z.number().optional(),
	modelTemperature: z.number().nullish(),
	rateLimitSeconds: z.number().optional(),
	consecutiveMistakeLimit: z.number().min(0).optional(),

	// Model reasoning.
	enableReasoningEffort: z.boolean().optional(),
	reasoningEffort: reasoningEffortSettingSchema.optional(),
	modelMaxTokens: z.number().optional(),
	modelMaxThinkingTokens: z.number().optional(),

	// Model verbosity.
	verbosity: verbosityLevelsSchema.optional(),

	// Tool protocol override for this profile.
	toolProtocol: z.enum(["xml", "native"]).optional(),
})

// Several of the providers share common model config properties.
const apiModelIdProviderModelSchema = baseProviderSettingsSchema.extend({
	apiModelId: z.string().optional(),
})

const anthropicSchema = apiModelIdProviderModelSchema.extend({
	apiKey: z.string().optional(),
	anthropicBaseUrl: z.string().optional(),
	anthropicUseAuthToken: z.boolean().optional(),
	anthropicBeta1MContext: z.boolean().optional(), // Enable 'context-1m-2025-08-07' beta for 1M context window.
})

const claudeCodeSchema = apiModelIdProviderModelSchema.extend({})

const openAiSchema = baseProviderSettingsSchema.extend({
	openAiBaseUrl: z.string().optional(),
	openAiApiKey: z.string().optional(),
	openAiLegacyFormat: z.boolean().optional(),
	openAiR1FormatEnabled: z.boolean().optional(),
	openAiModelId: z.string().optional(),
	openAiCustomModelInfo: modelInfoSchema.nullish(),
	openAiUseAzure: z.boolean().optional(),
	azureApiVersion: z.string().optional(),
	openAiStreamingEnabled: z.boolean().optional(),
	openAiHostHeader: z.string().optional(), // Keep temporarily for backward compatibility during migration.
	openAiHeaders: z.record(z.string(), z.string()).optional(),
})

const geminiSchema = apiModelIdProviderModelSchema.extend({
	geminiApiKey: z.string().optional(),
	googleGeminiBaseUrl: z.string().optional(),
	enableUrlContext: z.boolean().optional(),
	enableGrounding: z.boolean().optional(),
})

const geminiCliSchema = apiModelIdProviderModelSchema.extend({
	geminiCliOAuthPath: z.string().optional(),
	geminiCliProjectId: z.string().optional(),
})

const openAiNativeSchema = apiModelIdProviderModelSchema.extend({
	openAiNativeApiKey: z.string().optional(),
	openAiNativeBaseUrl: z.string().optional(),
	// OpenAI Responses API service tier for openai-native provider only.
	// UI should only expose this when the selected model supports flex/priority.
	openAiNativeServiceTier: serviceTierSchema.optional(),
})

const humanRelaySchema = baseProviderSettingsSchema

const qwenCodeSchema = apiModelIdProviderModelSchema.extend({
	qwenCodeOauthPath: z.string().optional(),
})
const defaultSchema = z.object({
	apiProvider: z.undefined(),
})

export const providerSettingsSchemaDiscriminated = z.discriminatedUnion("apiProvider", [
	anthropicSchema.merge(z.object({ apiProvider: z.literal("anthropic") })),
	claudeCodeSchema.merge(z.object({ apiProvider: z.literal("claude-code") })),
	openAiSchema.merge(z.object({ apiProvider: z.literal("openai") })),
	geminiSchema.merge(z.object({ apiProvider: z.literal("gemini") })),
	geminiCliSchema.merge(z.object({ apiProvider: z.literal("gemini-cli") })),
	openAiNativeSchema.merge(z.object({ apiProvider: z.literal("openai-native") })),
	humanRelaySchema.merge(z.object({ apiProvider: z.literal("human-relay") })),
	qwenCodeSchema.merge(z.object({ apiProvider: z.literal("qwen-code") })),
	defaultSchema,
])

export const providerSettingsSchema = z.object({
	apiProvider: providerNamesSchema.optional(),
	...anthropicSchema.shape,
	...claudeCodeSchema.shape,
	...openAiSchema.shape,
	...geminiSchema.shape,
	...geminiCliSchema.shape,
	...openAiNativeSchema.shape,
	...humanRelaySchema.shape,
	...qwenCodeSchema.shape,
	...codebaseIndexProviderSchema.shape,
})

export type ProviderSettings = z.infer<typeof providerSettingsSchema>

export const providerSettingsWithIdSchema = providerSettingsSchema.extend({ id: z.string().optional() })

export const discriminatedProviderSettingsWithIdSchema = providerSettingsSchemaDiscriminated.and(
	z.object({ id: z.string().optional() }),
)

export type ProviderSettingsWithId = z.infer<typeof providerSettingsWithIdSchema>

export const PROVIDER_SETTINGS_KEYS = providerSettingsSchema.keyof().options

/**
 * ModelIdKey
 */

export const modelIdKeys = [
	"apiModelId",
	"openAiModelId",
] as const satisfies readonly (keyof ProviderSettings)[]

export type ModelIdKey = (typeof modelIdKeys)[number]

export const getModelId = (settings: ProviderSettings): string | undefined => {
	const modelIdKey = modelIdKeys.find((key) => settings[key])
	return modelIdKey ? settings[modelIdKey] : undefined
}

/**
 * TypicalProvider
 */

export type TypicalProvider = Exclude<ProviderName, CustomProvider | CustomProvider | FauxProvider>

export const isTypicalProvider = (key: unknown): key is TypicalProvider =>
	isProviderName(key) && !isCustomProvider(key) && !isFauxProvider(key)

export const modelIdKeysByProvider: Record<TypicalProvider, ModelIdKey> = {
	anthropic: "apiModelId",
	"claude-code": "apiModelId",
	"openai-native": "openAiModelId",
	gemini: "apiModelId",
	"gemini-cli": "apiModelId",
	"qwen-code": "apiModelId",
}

/**
 * ANTHROPIC_STYLE_PROVIDERS
 */

// Providers that use Anthropic-style API protocol.
export const ANTHROPIC_STYLE_PROVIDERS: ProviderName[] = ["anthropic", "claude-code"]

export const getApiProtocol = (provider: ProviderName | undefined, modelId?: string): "anthropic" | "openai" => {
	if (provider && ANTHROPIC_STYLE_PROVIDERS.includes(provider)) {
		return "anthropic"
	}

	// Vercel AI Gateway uses anthropic protocol for anthropic models.
	if (
		provider &&
		["vercel-ai-gateway", "roo"].includes(provider) &&
		modelId &&
		modelId.toLowerCase().startsWith("anthropic/")
	) {
		return "anthropic"
	}

	return "openai"
}

/**
 * MODELS_BY_PROVIDER
 */

export const MODELS_BY_PROVIDER: Record<
	Exclude<ProviderName, "human-relay" | "gemini-cli" | "openai">,
	{ id: ProviderName; label: string; models: string[] }
> = {
	anthropic: {
		id: "anthropic",
		label: "Anthropic",
		models: Object.keys(anthropicModels),
	},
	"claude-code": { id: "claude-code", label: "Claude Code", models: Object.keys(claudeCodeModels) },
	gemini: {
		id: "gemini",
		label: "Google Gemini",
		models: Object.keys(geminiModels),
	},
	"openai-native": {
		id: "openai-native",
		label: "OpenAI",
		models: Object.keys(openAiNativeModels),
	},
	"qwen-code": { id: "qwen-code", label: "Qwen Code", models: Object.keys(qwenCodeModels) },
}
