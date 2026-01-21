import type { VectorStorageConfig } from "@shared/types"

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

export const VECTOR_STORAGE_PRESETS: Record<string, VectorStorageConfig> = {
	tiny: {
		mode: "preset",
		preset: "tiny",
		customConfig: {
			vectors: {
				on_disk: true,
			},
			wal: {
				capacity_mb: 16,
				segments: 1,
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
		},
	},
}

export const DEFAULT_VECTOR_STORAGE_CONFIG: VectorStorageConfig = {
	mode: "auto",
	thresholds: {
		tiny: 2000,
		small: 10000,
		medium: 100000,
		large: 1000000,
	},
}
