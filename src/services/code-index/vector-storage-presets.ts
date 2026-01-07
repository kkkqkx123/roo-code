import type { CustomVectorStorageConfig } from "@roo-code/types"

export type PresetType = "tiny" | "small" | "medium" | "large"

export interface VectorStoragePreset {
	mode: "preset"
	preset: PresetType
	customConfig: CustomVectorStorageConfig
}

export const VECTOR_STORAGE_PRESETS: Record<PresetType, VectorStoragePreset> = {
	tiny: {
		mode: "preset",
		preset: "tiny",
		customConfig: {
			vectors: { on_disk: true },
			wal: { capacity_mb: 32, segments: 2 },
		},
	},
	small: {
		mode: "preset",
		preset: "small",
		customConfig: {
			hnsw: { m: 16, ef_construct: 128, on_disk: true },
			vectors: { on_disk: true },
			wal: { capacity_mb: 32, segments: 2 },
		},
	},
	medium: {
		mode: "preset",
		preset: "medium",
		customConfig: {
			hnsw: { m: 32, ef_construct: 256, on_disk: true },
			vectors: { on_disk: true },
			wal: { capacity_mb: 64, segments: 4 },
		},
	},
	large: {
		mode: "preset",
		preset: "large",
		customConfig: {
			hnsw: { m: 64, ef_construct: 512, on_disk: true },
			vectors: { on_disk: true, quantization: { enabled: true, type: "scalar", bits: 8 } },
			wal: { capacity_mb: 256, segments: 8 },
		},
	},
} as const

export type UpgradeStatus = "pending" | "in_progress" | "paused" | "completed" | "failed" | "rolling_back" | "cancelled"

export interface QdrantCollectionConfig {
	hnsw_config?: {
		m: number
		ef_construct: number
		on_disk: boolean
	}
	vectors_config?: {
		on_disk: boolean
	}
	quantization_config?: {
		enabled: boolean
		type: string
		bits?: number
	}
	wal_config?: {
		capacity_mb: number
		segments: number
	}
}

export interface UpgradeProgress {
	collectionName: string
	workspacePath?: string
	currentPreset: PresetType | null
	targetPreset: PresetType
	status: UpgradeStatus
	progress: number
	message: string
	startTime: number
	endTime?: number
	error?: string
	steps: UpgradeStep[]
	previousConfig?: QdrantCollectionConfig
}

export interface UpgradeStep {
	preset?: PresetType
	name?: string
	status: "pending" | "in_progress" | "completed" | "failed"
	startTime?: number
	endTime?: number
	error?: string
}

export interface UpgradeThresholds {
	tiny: number
	small: number
	medium: number
}
