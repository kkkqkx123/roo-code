import { z } from "zod"

/**
 * Codebase Index Constants
 */
export const CODEBASE_INDEX_DEFAULTS = {
	MIN_SEARCH_RESULTS: 10,
	MAX_SEARCH_RESULTS: 200,
	DEFAULT_SEARCH_RESULTS: 50,
	SEARCH_RESULTS_STEP: 10,
	MIN_SEARCH_SCORE: 0,
	MAX_SEARCH_SCORE: 1,
	DEFAULT_SEARCH_MIN_SCORE: 0.4,
	SEARCH_SCORE_STEP: 0.05,
} as const

/**
 * VectorStorageConfig
 */

export const vectorStorageConfigSchema = z.object({
	mode: z.enum(["auto", "preset", "custom"]),
	preset: z.enum(["small", "medium", "large"]).optional(),
	customConfig: z
		.object({
			hnsw: z.object({
				m: z.number().min(2).max(128),
				ef_construct: z.number().min(10).max(1000),
				on_disk: z.boolean(),
			}),
			vectors: z.object({
				on_disk: z.boolean(),
				quantization: z
					.object({
						enabled: z.boolean(),
						type: z.enum(["scalar", "product"]),
						bits: z.number().optional(),
					})
					.optional(),
			}),
			wal: z
				.object({
					capacity_mb: z.number(),
					segments: z.number(),
				})
				.optional(),
			optimizer: z
				.object({
					indexing_threshold: z.number(),
				})
				.optional(),
		})
		.optional(),
	thresholds: z
		.object({
			small: z.number(),
			medium: z.number(),
		})
		.optional(),
})

export type VectorStorageConfig = z.infer<typeof vectorStorageConfigSchema>

export type CustomVectorStorageConfig = NonNullable<z.infer<typeof vectorStorageConfigSchema>["customConfig"]>

export const VECTOR_STORAGE_PRESETS: Record<string, VectorStorageConfig> = {
	small: {
		mode: "preset",
		preset: "small",
		customConfig: {
			hnsw: {
				m: 16,
				ef_construct: 128,
				on_disk: false,
			},
			vectors: {
				on_disk: false,
			},
			wal: {
				capacity_mb: 32,
				segments: 2,
			},
			optimizer: {
				indexing_threshold: 10000,
			},
		},
	},
	medium: {
		mode: "preset",
		preset: "medium",
		customConfig: {
			hnsw: {
				m: 24,
				ef_construct: 256,
				on_disk: true,
			},
			vectors: {
				on_disk: true,
			},
			wal: {
				capacity_mb: 64,
				segments: 4,
			},
			optimizer: {
				indexing_threshold: 20000,
			},
		},
	},
	large: {
		mode: "preset",
		preset: "large",
		customConfig: {
			hnsw: {
				m: 32,
				ef_construct: 256,
				on_disk: true,
			},
			vectors: {
				on_disk: true,
				quantization: {
					enabled: true,
					type: "scalar",
					bits: 8,
				},
			},
			wal: {
				capacity_mb: 128,
				segments: 8,
			},
			optimizer: {
				indexing_threshold: 50000,
			},
		},
	},
}

export const DEFAULT_VECTOR_STORAGE_CONFIG: VectorStorageConfig = {
	mode: "auto",
	thresholds: {
		small: 10000,
		medium: 100000,
	},
}

/**
 * CodebaseIndexConfig
 */

export const codebaseIndexConfigSchema = z.object({
	codebaseIndexEnabled: z.boolean().optional(),
	codebaseIndexQdrantUrl: z.string().optional(),
	codebaseIndexEmbedderProvider: z
		.enum([
			"openai",
			"ollama",
			"openai-compatible",
			"gemini",
			"mistral",
			"vercel-ai-gateway",
			"bedrock",
			"openrouter",
		])
		.optional(),
	codebaseIndexEmbedderBaseUrl: z.string().optional(),
	codebaseIndexEmbedderModelId: z.string().optional(),
	codebaseIndexEmbedderModelDimension: z.number().optional(),
	codebaseIndexSearchMinScore: z.number().min(0).max(1).optional(),
	codebaseIndexSearchMaxResults: z
		.number()
		.min(CODEBASE_INDEX_DEFAULTS.MIN_SEARCH_RESULTS)
		.max(CODEBASE_INDEX_DEFAULTS.MAX_SEARCH_RESULTS)
		.optional(),
	// Vector storage configuration
	codebaseIndexVectorStorageConfig: vectorStorageConfigSchema.optional(),
	// OpenAI Compatible specific fields
	codebaseIndexOpenAiCompatibleBaseUrl: z.string().optional(),
	codebaseIndexOpenAiCompatibleModelDimension: z.number().optional(),
	// Bedrock specific fields
	codebaseIndexBedrockRegion: z.string().optional(),
	codebaseIndexBedrockProfile: z.string().optional(),
	// OpenRouter specific fields
	codebaseIndexOpenRouterSpecificProvider: z.string().optional(),
	// Indexing confirmation requirement
	codebaseIndexRequireIndexingConfirmation: z.boolean().optional(),
})

export type CodebaseIndexConfig = z.infer<typeof codebaseIndexConfigSchema>

/**
 * CodebaseIndexModels
 */

export const codebaseIndexModelsSchema = z.object({
	openai: z.record(z.string(), z.object({ dimension: z.number() })).optional(),
	ollama: z.record(z.string(), z.object({ dimension: z.number() })).optional(),
	"openai-compatible": z.record(z.string(), z.object({ dimension: z.number() })).optional(),
	gemini: z.record(z.string(), z.object({ dimension: z.number() })).optional(),
	mistral: z.record(z.string(), z.object({ dimension: z.number() })).optional(),
	"vercel-ai-gateway": z.record(z.string(), z.object({ dimension: z.number() })).optional(),
	openrouter: z.record(z.string(), z.object({ dimension: z.number() })).optional(),
	bedrock: z.record(z.string(), z.object({ dimension: z.number() })).optional(),
})

export type CodebaseIndexModels = z.infer<typeof codebaseIndexModelsSchema>

/**
 * CdebaseIndexProvider
 */

export const codebaseIndexProviderSchema = z.object({
	codeIndexOpenAiKey: z.string().optional(),
	codeIndexQdrantApiKey: z.string().optional(),
	codebaseIndexOpenAiCompatibleBaseUrl: z.string().optional(),
	codebaseIndexOpenAiCompatibleApiKey: z.string().optional(),
	codebaseIndexOpenAiCompatibleModelDimension: z.number().optional(),
	codebaseIndexGeminiApiKey: z.string().optional(),
	codebaseIndexMistralApiKey: z.string().optional(),
	codebaseIndexVercelAiGatewayApiKey: z.string().optional(),
	codebaseIndexOpenRouterApiKey: z.string().optional(),
})

export type CodebaseIndexProvider = z.infer<typeof codebaseIndexProviderSchema>
