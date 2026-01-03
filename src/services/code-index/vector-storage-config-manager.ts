import { ContextProxy } from "../../core/config/ContextProxy"
import type { VectorStorageConfig, CustomVectorStorageConfig } from "@roo-code/types"
import { CollectionSizeEstimator } from "./vector-store/collection-size-estimator"
import type { SizeEstimationResult } from "./token-based-size-estimator"

const VECTOR_STORAGE_PRESETS = {
	small: {
		mode: "preset" as const,
		preset: "small" as const,
		customConfig: {
			hnsw: { m: 16, ef_construct: 128, on_disk: false },
			vectors: { on_disk: false },
			wal: { capacity_mb: 32, segments: 2 },
			optimizer: { indexing_threshold: 20000 },
		},
	},
	medium: {
		mode: "preset" as const,
		preset: "medium" as const,
		customConfig: {
			hnsw: { m: 32, ef_construct: 256, on_disk: false },
			vectors: { on_disk: false },
			wal: { capacity_mb: 64, segments: 4 },
			optimizer: { indexing_threshold: 100000 },
		},
	},
	large: {
		mode: "preset" as const,
		preset: "large" as const,
		customConfig: {
			hnsw: { m: 64, ef_construct: 512, on_disk: true },
			vectors: { on_disk: true, quantization: { enabled: true, type: "scalar", bits: 8 } },
			wal: { capacity_mb: 256, segments: 8 },
			optimizer: { indexing_threshold: 200000 },
		},
	},
} as const

const DEFAULT_VECTOR_STORAGE_CONFIG: VectorStorageConfig = {
	mode: "auto",
	thresholds: {
		small: 10000,
		medium: 100000,
	},
}

export class VectorStorageConfigManager {
	private config: VectorStorageConfig

	constructor(
		private contextProxy: ContextProxy,
		private collectionSizeEstimator: CollectionSizeEstimator,
	) {
		this.config = this.loadConfig()
	}

	async getCollectionConfig(collectionName: string): Promise<CustomVectorStorageConfig> {
		const size = await this.collectionSizeEstimator.estimateSize(collectionName)
		return this.resolveConfig(size)
	}

	async getCollectionConfigFromSize(size: number): Promise<CustomVectorStorageConfig> {
		return this.resolveConfig(size)
	}

	async getCollectionConfigFromEstimation(estimation: SizeEstimationResult): Promise<CustomVectorStorageConfig> {
		return this.resolveConfig(estimation.estimatedVectorCount)
	}

	private resolveConfig(collectionSize: number): CustomVectorStorageConfig {
		switch (this.config.mode) {
			case "auto":
				return this.getAutoConfig(collectionSize)
			case "preset":
				return VECTOR_STORAGE_PRESETS[this.config.preset!].customConfig!
			case "custom":
				return this.config.customConfig!
			default:
				return VECTOR_STORAGE_PRESETS.medium.customConfig!
		}
	}

	private getAutoConfig(size: number): CustomVectorStorageConfig {
		const thresholds = this.config.thresholds || {
			small: 10000,
			medium: 100000,
		}

		if (size < thresholds.small) {
			return VECTOR_STORAGE_PRESETS.small.customConfig!
		} else if (size < thresholds.medium) {
			return VECTOR_STORAGE_PRESETS.medium.customConfig!
		} else {
			return VECTOR_STORAGE_PRESETS.large.customConfig!
		}
	}

	updateConfig(newConfig: Partial<VectorStorageConfig>): void {
		this.config = { ...this.config, ...newConfig }
		this.saveConfig()
	}

	getConfig(): VectorStorageConfig {
		return this.config
	}

	private loadConfig(): VectorStorageConfig {
		const codebaseIndexConfig = this.contextProxy?.getGlobalState("codebaseIndexConfig") as { codebaseIndexVectorStorageConfig?: VectorStorageConfig } | undefined
		const storedConfig = codebaseIndexConfig?.codebaseIndexVectorStorageConfig
		if (storedConfig) {
			return { ...DEFAULT_VECTOR_STORAGE_CONFIG, ...storedConfig }
		}
		return DEFAULT_VECTOR_STORAGE_CONFIG
	}

	private saveConfig(): void {
		const codebaseIndexConfig = this.contextProxy?.getGlobalState("codebaseIndexConfig") as { codebaseIndexVectorStorageConfig?: VectorStorageConfig } | undefined
		this.contextProxy?.updateGlobalState("codebaseIndexConfig", {
			...codebaseIndexConfig,
			codebaseIndexVectorStorageConfig: this.config,
		})
	}

	resetToDefault(): void {
		this.config = DEFAULT_VECTOR_STORAGE_CONFIG
		this.saveConfig()
	}
}
