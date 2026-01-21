import { ApiHandlerOptions } from "@api/api-utils"
import { EmbedderProvider } from "./manager"

export interface CustomVectorStorageConfig {
	hnsw?: {
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
}

export interface VectorStorageConfig {
	mode: "auto" | "preset" | "custom"
	preset?: "tiny" | "small" | "medium" | "large"
	customConfig?: CustomVectorStorageConfig
	thresholds?: {
		tiny: number
		small: number
		medium: number
	}
}

export const VECTOR_STORAGE_PRESETS: Record<string, VectorStorageConfig> = {
	tiny: {
		mode: "preset",
		preset: "tiny",
		customConfig: {
			vectors: {
				on_disk: true,
			},
			wal: {
				capacity_mb: 32,
				segments: 2,
			},
		},
	},
	small: {
		mode: "preset",
		preset: "small",
		customConfig: {
			hnsw: {
				m: 16,
				ef_construct: 128,
				on_disk: true,
			},
			vectors: {
				on_disk: true,
			},
			wal: {
				capacity_mb: 32,
				segments: 2,
			},
		},
	},
	medium: {
		mode: "preset",
		preset: "medium",
		customConfig: {
			hnsw: {
				m: 32,
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
		},
	},
	large: {
		mode: "preset",
		preset: "large",
		customConfig: {
			hnsw: {
				m: 64,
				ef_construct: 512,
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
				capacity_mb: 256,
				segments: 8,
			},
		},
	},
}

export const DEFAULT_VECTOR_STORAGE_CONFIG: VectorStorageConfig = {
	mode: "auto",
	thresholds: {
		tiny: 2000,
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
	openAiCompatibleOptions?: { baseUrl: string; apiKey: string }
	geminiOptions?: { apiKey: string }
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
	openAiCompatibleBaseUrl?: string
	openAiCompatibleApiKey?: string
	geminiApiKey?: string
	qdrantUrl?: string
	qdrantApiKey?: string
}
