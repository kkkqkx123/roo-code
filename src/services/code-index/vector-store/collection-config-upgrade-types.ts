import type { CustomVectorStorageConfig } from "@roo-code/types"

export type PresetType = "tiny" | "small" | "medium" | "large"

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

export interface UpgradeResult {
	collectionName: string
	upgraded: boolean
	error?: string
	progress?: UpgradeProgress
}

export interface CollectionConfigInfo {
	preset: PresetType
	config: CustomVectorStorageConfig
	vectorCount: number
}

export interface UpgradeThresholds {
	tiny: number
	small: number
	medium: number
}
