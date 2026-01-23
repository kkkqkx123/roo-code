import type { QdrantClient } from "@qdrant/js-client-rest"
import type {
	CustomVectorStorageConfig,
	VectorStorageConfig,
} from "@shared/types"
import type {
	PresetType,
	UpgradeProgress,
	UpgradeStep,
	UpgradeThresholds,
} from "@shared/config/vector-storage-presets"
import { VectorStorageConfigManager } from "../vector-storage-config-manager"
import { VECTOR_STORAGE_PRESETS } from "@shared/config/vector-storage-presets"
import * as vscode from "vscode"

export class CollectionConfigUpgradeService {
	private qdrantClient: QdrantClient
	private configManager: VectorStorageConfigManager
	private collectionName: string
	private currentUpgrades: Map<string, UpgradeProgress>
	private upgradeHistory: Map<string, UpgradeProgress[]>
	private thresholds: UpgradeThresholds
	private _statusEmitter = new vscode.EventEmitter<UpgradeProgress>()
	private _cancellationRequested = false
	private _pauseRequested = false
	private _pausedStepIndex = -1

	constructor(
		qdrantClient: QdrantClient,
		configManager: VectorStorageConfigManager,
		collectionName: string,
	) {
		this.qdrantClient = qdrantClient
		this.configManager = configManager
		this.collectionName = collectionName
		this.currentUpgrades = new Map()
		this.upgradeHistory = new Map()
		this.thresholds = configManager.getConfig().thresholds || {
			tiny: 2000,
			small: 50000,
			medium: 500000,
			large: Infinity,
		}
	}

	public readonly onStatusUpdate = this._statusEmitter.event

	public getCurrentUpgrade(collectionName?: string): UpgradeProgress | undefined {
		if (collectionName) {
			return this.currentUpgrades.get(collectionName)
		}
		return this.currentUpgrades.get(this.collectionName)
	}

	public getCurrentUpgrades(): Map<string, UpgradeProgress> {
		return new Map(this.currentUpgrades)
	}

	public getUpgradeHistory(collectionName: string): UpgradeProgress[] {
		return this.upgradeHistory.get(collectionName) || []
	}

	public getUpgradeStatistics(): {
		totalUpgrades: number
		successfulUpgrades: number
		failedUpgrades: number
		cancelledUpgrades: number
		averageDuration: number
	} {
		const allHistory = Array.from(this.upgradeHistory.values()).flat()
		const successfulUpgrades = allHistory.filter((u) => u.status === "completed").length
		const failedUpgrades = allHistory.filter((u) => u.status === "failed").length
		const cancelledUpgrades = allHistory.filter((u) => u.status === "cancelled").length

		const completedUpgrades = allHistory.filter((u) => u.status === "completed" && u.endTime)
		const averageDuration =
			completedUpgrades.length > 0
				? completedUpgrades.reduce((sum, u) => sum + (u.endTime! - u.startTime), 0) / completedUpgrades.length
				: 0

		return {
			totalUpgrades: allHistory.length,
			successfulUpgrades,
			failedUpgrades,
			cancelledUpgrades,
			averageDuration,
		}
	}

	public getRecentUpgrades(limit: number = 10): UpgradeProgress[] {
		const allHistory = Array.from(this.upgradeHistory.values()).flat()
		return allHistory
			.sort((a, b) => b.startTime - a.startTime)
			.slice(0, limit)
	}

	public isUpgradeInProgress(): boolean {
		const currentUpgrade = this.currentUpgrades.get(this.collectionName)
		return currentUpgrade?.status === "in_progress" || false
	}

	public isUpgradePaused(): boolean {
		const currentUpgrade = this.currentUpgrades.get(this.collectionName)
		return currentUpgrade?.status === "paused" || false
	}

	public async rollbackUpgrade(): Promise<boolean> {
		const history = this.upgradeHistory.get(this.collectionName) || []
		const lastUpgrade = history[history.length - 1]

		if (!lastUpgrade || lastUpgrade.status !== "completed") {
			return false
		}

		if (!lastUpgrade.previousConfig) {
			console.error(`[CollectionConfigUpgradeService] Cannot rollback: No previous config saved for collection ${this.collectionName}`)
			return false
		}

		if (!lastUpgrade.currentPreset) {
			console.error(`[CollectionConfigUpgradeService] Cannot rollback: No current preset saved for collection ${this.collectionName}`)
			return false
		}

		try {
			console.info(`[CollectionConfigUpgradeService] Starting rollback for collection ${this.collectionName} from ${lastUpgrade.targetPreset} to ${lastUpgrade.currentPreset}`)

			const rollbackProgress: UpgradeProgress = {
				collectionName: this.collectionName,
				currentPreset: lastUpgrade.targetPreset,
				targetPreset: lastUpgrade.currentPreset,
				status: "rolling_back",
				progress: 0,
				message: `Rolling back from ${lastUpgrade.targetPreset} to ${lastUpgrade.currentPreset}`,
				startTime: Date.now(),
				steps: [],
			}

			this.currentUpgrades.set(this.collectionName, rollbackProgress)
			this._statusEmitter.fire({ ...rollbackProgress })

			const previousConfig = lastUpgrade.previousConfig

			if (previousConfig.hnsw_config) {
				await this.qdrantClient.updateCollection(this.collectionName, {
					hnsw_config: previousConfig.hnsw_config,
				})
				rollbackProgress.progress = 50
				rollbackProgress.message = "Restored HNSW configuration"
				this.currentUpgrades.set(this.collectionName, { ...rollbackProgress })
				this._statusEmitter.fire({ ...rollbackProgress })
			}

			if (previousConfig.quantization_config) {
				await this.qdrantClient.updateCollection(this.collectionName, {
					quantization_config: previousConfig.quantization_config,
				})
				rollbackProgress.progress = 75
				rollbackProgress.message = "Restored quantization configuration"
				this.currentUpgrades.set(this.collectionName, { ...rollbackProgress })
				this._statusEmitter.fire({ ...rollbackProgress })
			}

			rollbackProgress.status = "completed"
			rollbackProgress.progress = 100
			rollbackProgress.message = `Successfully rolled back from ${lastUpgrade.targetPreset} to ${lastUpgrade.currentPreset}`
			rollbackProgress.endTime = Date.now()
			this.currentUpgrades.delete(this.collectionName)
			this._statusEmitter.fire({ ...rollbackProgress })

			const rollbackHistory = this.upgradeHistory.get(this.collectionName) || []
			rollbackHistory.push(rollbackProgress)
			this.upgradeHistory.set(this.collectionName, rollbackHistory)

			console.info(`[CollectionConfigUpgradeService] Successfully completed rollback for collection ${this.collectionName} (Duration: ${rollbackProgress.endTime - rollbackProgress.startTime}ms)`)
			return true
		} catch (error: any) {
			const rollbackProgress = this.currentUpgrades.get(this.collectionName)
			if (rollbackProgress) {
				rollbackProgress.status = "failed"
				rollbackProgress.error = error.message
				rollbackProgress.message = `Rollback failed: ${error.message}`
				rollbackProgress.endTime = Date.now()
				this.currentUpgrades.delete(this.collectionName)
				this._statusEmitter.fire({ ...rollbackProgress })

				const rollbackHistory = this.upgradeHistory.get(this.collectionName) || []
				rollbackHistory.push(rollbackProgress)
				this.upgradeHistory.set(this.collectionName, rollbackHistory)
			}

			console.error(`[CollectionConfigUpgradeService] Rollback failed for collection ${this.collectionName}: ${error.message}`)
			return false
		}
	}

	public cancelUpgrade(): boolean {
		const currentUpgrade = this.currentUpgrades.get(this.collectionName)
		if (!currentUpgrade || currentUpgrade.status !== "in_progress") {
			return false
		}

		this._cancellationRequested = true
		currentUpgrade.status = "cancelled"
		currentUpgrade.message = "Upgrade cancelled by user"
		currentUpgrade.endTime = Date.now()
		this.currentUpgrades.delete(this.collectionName)
		this._statusEmitter.fire({ ...currentUpgrade })

		const history = this.upgradeHistory.get(this.collectionName) || []
		history.push(currentUpgrade)
		this.upgradeHistory.set(this.collectionName, history)

		console.info(`[CollectionConfigUpgradeService] Upgrade cancelled for collection ${this.collectionName}`)
		return true
	}

	public pauseUpgrade(): boolean {
		const currentUpgrade = this.currentUpgrades.get(this.collectionName)
		if (!currentUpgrade || currentUpgrade.status !== "in_progress") {
			return false
		}

		this._pauseRequested = true
		this._pausedStepIndex = currentUpgrade.steps.length
		currentUpgrade.status = "paused"
		currentUpgrade.message = "Upgrade paused by user"
		this.currentUpgrades.set(this.collectionName, { ...currentUpgrade })
		this._statusEmitter.fire({ ...currentUpgrade })

		console.info(`[CollectionConfigUpgradeService] Upgrade paused for collection ${this.collectionName} at step ${this._pausedStepIndex}`)
		return true
	}

	public async resumeUpgrade(): Promise<boolean> {
		const currentUpgrade = this.currentUpgrades.get(this.collectionName)
		if (!currentUpgrade || currentUpgrade.status !== "paused") {
			return false
		}

		try {
			this._pauseRequested = false
			const pausedStepIndex = this._pausedStepIndex

			currentUpgrade.status = "in_progress"
			currentUpgrade.message = "Resuming upgrade..."
			this.currentUpgrades.set(this.collectionName, { ...currentUpgrade })
			this._statusEmitter.fire({ ...currentUpgrade })

			console.info(`[CollectionConfigUpgradeService] Resuming upgrade for collection ${this.collectionName} from step ${pausedStepIndex}`)

			const collectionInfo = await this.qdrantClient.getCollection(this.collectionName)
			const currentPreset = this.detectCurrentPreset(collectionInfo.config)
			const targetPreset = currentUpgrade.targetPreset
			const upgradePath = this.calculateUpgradePath(currentPreset, targetPreset)

			if (upgradePath.length === 0) {
				return false
			}

			await this.executeUpgrade(collectionInfo, upgradePath, pausedStepIndex)
			return true
		} catch (error: any) {
			console.error(`[CollectionConfigUpgradeService] Failed to resume upgrade for collection ${this.collectionName}:`, error)
			return false
		}
	}

	public async retryUpgrade(): Promise<boolean> {
		const history = this.upgradeHistory.get(this.collectionName) || []
		const lastUpgrade = history[history.length - 1]

		if (!lastUpgrade || lastUpgrade.status !== "failed") {
			return false
		}

		try {
			console.info(`[CollectionConfigUpgradeService] Retrying failed upgrade for collection ${this.collectionName}`)

			const collectionInfo = await this.qdrantClient.getCollection(this.collectionName)
			const currentPreset = this.detectCurrentPreset(collectionInfo.config)
			const targetPreset = lastUpgrade.targetPreset
			const upgradePath = this.calculateUpgradePath(currentPreset, targetPreset)

			if (upgradePath.length === 0) {
				return false
			}

			await this.executeUpgrade(collectionInfo, upgradePath)
			return true
		} catch (error: any) {
			console.error(`[CollectionConfigUpgradeService] Failed to retry upgrade for collection ${this.collectionName}:`, error)
			return false
		}
	}

	public async checkAndUpgradeCollection(): Promise<boolean> {
		try {
			const collectionInfo = await this.qdrantClient.getCollection(this.collectionName)
			const currentSize = collectionInfo.points_count || 0

			const targetPreset = this.determineTargetPreset(currentSize)
			const currentPreset = this.detectCurrentPreset(collectionInfo.config)

			if (currentPreset === targetPreset) {
				return false
			}

			const upgradePath = this.calculateUpgradePath(currentPreset, targetPreset)
			if (upgradePath.length === 0) {
				return false
			}

			await this.executeUpgrade(collectionInfo, upgradePath)
			return true
		} catch (error) {
			console.error(`[CollectionConfigUpgradeService] Failed to check and upgrade collection ${this.collectionName}:`, error)
			throw error
		}
	}

	private determineTargetPreset(currentSize: number): PresetType {
		if (currentSize < this.thresholds.tiny) {
			return "tiny"
		} else if (currentSize < this.thresholds.small) {
			return "small"
		} else if (currentSize < this.thresholds.medium) {
			return "medium"
		} else {
			return "large"
		}
	}

	private detectCurrentPreset(config: any): PresetType | null {
		const hnswConfig = config.hnsw_config
		const vectorsConfig = config.vectors_config
		const quantizationConfig = config.quantization_config

		if (!hnswConfig) {
			return "tiny"
		}

		const m = hnswConfig.m
		const efConstruct = hnswConfig.ef_construct

		if (m === 16 && efConstruct === 128) {
			return "small"
		} else if (m === 32 && efConstruct === 256) {
			return "medium"
		} else if (m === 64 && efConstruct === 512) {
			return "large"
		}

		return null
	}

	private calculateUpgradePath(currentPreset: PresetType | null, targetPreset: PresetType): PresetType[] {
		const presetOrder: PresetType[] = ["tiny", "small", "medium", "large"]

		if (!currentPreset) {
			return [targetPreset]
		}

		const currentIndex = presetOrder.indexOf(currentPreset)
		const targetIndex = presetOrder.indexOf(targetPreset)

		if (currentIndex === -1 || targetIndex === -1) {
			return []
		}

		if (targetIndex > currentIndex) {
			return presetOrder.slice(currentIndex + 1, targetIndex + 1)
		}

		return []
	}

	private async executeUpgrade(
		collectionInfo: any,
		upgradePath: PresetType[],
		startStepIndex: number = 0,
	): Promise<void> {
		const currentPreset = this.detectCurrentPreset(collectionInfo.config)
		const targetPreset = upgradePath[upgradePath.length - 1]
		const currentSize = collectionInfo.points_count || 0

		const progress: UpgradeProgress = {
			collectionName: this.collectionName,
			currentPreset,
			targetPreset,
			status: "in_progress",
			progress: 0,
			message: `Starting upgrade from ${currentPreset} to ${targetPreset}`,
			startTime: Date.now(),
			steps: [],
		}

		this.currentUpgrades.set(this.collectionName, progress)
		this._statusEmitter.fire({ ...progress })

		try {
			console.info(`[CollectionConfigUpgradeService] Starting collection upgrade from ${currentPreset} to ${targetPreset} (Current size: ${currentSize}, Target size: ${this.configManager.getConfig().thresholds?.[targetPreset] || 0})`)

			for (let i = startStepIndex; i < upgradePath.length; i++) {
				if (this._cancellationRequested) {
					throw new Error("Upgrade was cancelled by user")
				}

				if (this._pauseRequested) {
					this._pauseRequested = false
					progress.message = `Upgrade paused at step ${i + 1}/${upgradePath.length}`
					this.currentUpgrades.set(this.collectionName, { ...progress })
					this._statusEmitter.fire({ ...progress })
					return
				}

				const preset = upgradePath[i]
				const step: UpgradeStep = {
					preset,
					status: "in_progress",
					startTime: Date.now(),
				}

				progress.steps.push(step)
				progress.progress = (i / upgradePath.length) * 100
				progress.message = `Applying ${preset} configuration (${i + 1}/${upgradePath.length})`
				this.currentUpgrades.set(this.collectionName, { ...progress })
				this._statusEmitter.fire({ ...progress })

				console.info(`[CollectionConfigUpgradeService] Starting upgrade step ${progress.steps.length}/${upgradePath.length}: ${preset}`)

				await this.applyPresetConfig(preset)

				step.status = "completed"
				step.endTime = Date.now()
				progress.progress = ((i + 1) / upgradePath.length) * 100
				progress.message = `Completed ${preset} configuration (${i + 1}/${upgradePath.length})`
				this.currentUpgrades.set(this.collectionName, { ...progress })
				this._statusEmitter.fire({ ...progress })

				console.info(`[CollectionConfigUpgradeService] Completed upgrade step ${progress.steps.length}/${upgradePath.length}: ${preset} (Duration: ${(step.endTime || 0) - (step.startTime || 0)}ms)`)
			}

			progress.status = "completed"
			progress.progress = 100
			progress.message = `Successfully upgraded from ${currentPreset} to ${targetPreset}`
			progress.endTime = Date.now()
			this.currentUpgrades.delete(this.collectionName)
			this._statusEmitter.fire({ ...progress })

			const history = this.upgradeHistory.get(this.collectionName) || []
			history.push(progress)
			this.upgradeHistory.set(this.collectionName, history)

			console.info(`[CollectionConfigUpgradeService] Successfully completed collection upgrade from ${currentPreset} to ${targetPreset} (Total duration: ${progress.endTime - progress.startTime}ms)`)
		} catch (error: any) {
			progress.status = "failed"
			progress.error = error.message
			progress.message = `Upgrade failed: ${error.message}`
			progress.endTime = Date.now()
			this.currentUpgrades.delete(this.collectionName)
			this._statusEmitter.fire({ ...progress })

			const history = this.upgradeHistory.get(this.collectionName) || []
			history.push(progress)
			this.upgradeHistory.set(this.collectionName, history)

			console.error(`[CollectionConfigUpgradeService] Collection upgrade failed from ${currentPreset} to ${targetPreset}: ${error.message}`)

			throw error
		}
	}

	private async applyPresetConfig(preset: PresetType): Promise<void> {
		const presetConfig = VECTOR_STORAGE_PRESETS[preset]

		if ("hnsw" in presetConfig.customConfig && presetConfig.customConfig.hnsw) {
			await this.qdrantClient.updateCollection(this.collectionName, {
				hnsw_config: presetConfig.customConfig.hnsw,
				optimizers_config: {
					indexing_threshold: 0,
				},
			})
		}

		if (presetConfig.customConfig.vectors && "quantization" in presetConfig.customConfig.vectors && presetConfig.customConfig.vectors.quantization) {
			await this.qdrantClient.updateCollection(this.collectionName, {
				quantization_config: presetConfig.customConfig.vectors.quantization,
			})
		}
	}
}
