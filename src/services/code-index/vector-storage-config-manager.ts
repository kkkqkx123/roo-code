import { ContextProxy } from "../../core/config/ContextProxy"
import type { VectorStorageConfig, CustomVectorStorageConfig } from "@shared/types"
import { CollectionSizeEstimator } from "./vector-store/collection-size-estimator"
import type { SizeEstimationResult } from "./token-based-size-estimator"
import type { QdrantClient } from "@qdrant/js-client-rest"
import { CollectionConfigUpgradeService } from "./vector-store/collection-config-upgrade-service"
import { VECTOR_STORAGE_PRESETS } from "@shared/config/vector-storage-presets"

const DEFAULT_VECTOR_STORAGE_CONFIG: VectorStorageConfig = {
	mode: "auto",
	thresholds: {
		tiny: 2000,
		small: 10000,
		medium: 100000,
		large: 1000000,
	},
}

export class VectorStorageConfigManager {
	private config: VectorStorageConfig
	private upgradeService?: CollectionConfigUpgradeService
	private collectionName?: string

	constructor(
		private contextProxy: ContextProxy,
		private collectionSizeEstimator: CollectionSizeEstimator,
	) {
		this.config = this.loadConfig()
	}

	setUpgradeService(service: CollectionConfigUpgradeService): void {
		this.upgradeService = service
	}

	setCollectionName(collectionName: string): void {
		this.collectionName = collectionName
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
			tiny: 2000,
			small: 10000,
			medium: 100000,
		}

		if (size < thresholds.tiny) {
			return VECTOR_STORAGE_PRESETS.tiny.customConfig!
		} else if (size < thresholds.small) {
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

	async checkAndUpgradeCollection(collectionName: string): Promise<boolean> {
		if (!this.upgradeService) {
			console.warn("[VectorStorageConfigManager] Upgrade service not initialized")
			return false
		}

		try {
			return await this.upgradeService.checkAndUpgradeCollection()
		} catch (error) {
			console.error(`[VectorStorageConfigManager] Failed to check and upgrade collection ${collectionName}:`, error)
			throw error
		}
	}

	getUpgradeHistory(collectionName: string) {
		if (!this.upgradeService) {
			return []
		}
		return this.upgradeService.getUpgradeHistory(collectionName)
	}

	getCurrentUpgrade(collectionName?: string) {
		if (!this.upgradeService) {
			return undefined
		}
		return this.upgradeService.getCurrentUpgrade(collectionName)
	}
}
