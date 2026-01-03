import { ApiHandlerOptions } from "../../../shared/api" // Adjust path if needed
import { EmbedderProvider } from "./manager"

export interface CustomVectorStorageConfig {
	hnsw: {
		m: number
		ef_construct: number
		on_disk: boolean
	}
	vectors: {
		on_disk: boolean
		quantization?: {
			enabled: boolean
			type: "scalar" | "product"
			bits?: number
		}
	}
	wal?: {
		capacity_mb: number
		segments: number
	}
	optimizer?: {
		indexing_threshold: number
	}
}

export interface VectorStorageConfig {
	mode: "auto" | "preset" | "custom"
	preset?: "small" | "medium" | "large"
	customConfig?: CustomVectorStorageConfig
	thresholds?: {
		small: number
		medium: number
	}
}

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

export interface CodeIndexConfig {
	isConfigured: boolean
	embedderProvider: EmbedderProvider
	modelId?: string
	modelDimension?: number
	openAiOptions?: ApiHandlerOptions
	ollamaOptions?: ApiHandlerOptions
	openAiCompatibleOptions?: { baseUrl: string; apiKey: string }
	geminiOptions?: { apiKey: string }
	mistralOptions?: { apiKey: string }
	vercelAiGatewayOptions?: { apiKey: string }
	bedrockOptions?: { region: string; profile?: string }
	openRouterOptions?: { apiKey: string; specificProvider?: string }
	qdrantUrl?: string
	qdrantApiKey?: string
	searchMinScore?: number
	searchMaxResults?: number
	vectorStorageConfig?: VectorStorageConfig
	requireIndexingConfirmation?: boolean
}

/**
 * Snapshot of previous configuration used to determine if a restart is required
 */
export type PreviousConfigSnapshot = {
	enabled: boolean
	configured: boolean
	embedderProvider: EmbedderProvider
	modelId?: string
	modelDimension?: number // Generic dimension property
	openAiKey?: string
	ollamaBaseUrl?: string
	openAiCompatibleBaseUrl?: string
	openAiCompatibleApiKey?: string
	geminiApiKey?: string
	mistralApiKey?: string
	vercelAiGatewayApiKey?: string
	bedrockRegion?: string
	bedrockProfile?: string
	openRouterApiKey?: string
	openRouterSpecificProvider?: string
	qdrantUrl?: string
	qdrantApiKey?: string
}
