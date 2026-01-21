import { z } from "zod"
import { CODEBASE_INDEX_DEFAULTS } from "@services/code-index/config"

export const vectorStorageConfigSchema = z.object({
	mode: z.enum(["auto", "preset", "custom"]),
	preset: z.enum(["tiny", "small", "medium", "large"]).optional(),
	customConfig: z
		.object({
			hnsw: z
				.object({
					m: z.number().min(2).max(128),
					ef_construct: z.number().min(10).max(1000),
					on_disk: z.boolean(),
				})
				.optional(),
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
		})
		.optional(),
	thresholds: z
		.object({
			tiny: z.number(),
			small: z.number(),
			medium: z.number(),
			large: z.number(),
		})
		.optional(),
})

export type VectorStorageConfig = z.infer<typeof vectorStorageConfigSchema>

export type CustomVectorStorageConfig = NonNullable<z.infer<typeof vectorStorageConfigSchema>["customConfig"]>

/**
 * CodebaseIndexConfig
 */

export const codebaseIndexConfigSchema = z.object({
	codebaseIndexEnabled: z.boolean().optional(),
	codebaseIndexQdrantUrl: z.string().optional(),
	codebaseIndexEmbedderProvider: z
		.enum([
			"openai",
			"openai-compatible",
			"gemini",
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
	// Indexing confirmation requirement
	codebaseIndexRequireIndexingConfirmation: z.boolean().optional(),
})

export type CodebaseIndexConfig = z.infer<typeof codebaseIndexConfigSchema>

/**
 * CodebaseIndexModels
 */

export const codebaseIndexModelsSchema = z.object({
	openai: z.record(z.string(), z.object({ dimension: z.number() })).optional(),
	"openai-compatible": z.record(z.string(), z.object({ dimension: z.number() })).optional(),
	gemini: z.record(z.string(), z.object({ dimension: z.number() })).optional(),
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
})

export type CodebaseIndexProvider = z.infer<typeof codebaseIndexProviderSchema>
