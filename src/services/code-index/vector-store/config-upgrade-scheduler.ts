import { EventEmitter } from "events"
import type { UpgradeProgress } from "../vector-storage-presets"
import { VectorStorageConfigManager } from "../vector-storage-config-manager"

export interface SchedulerConfig {
	enabled: boolean
	checkInterval: number
	maxConcurrentUpgrades: number
	upgradeWindow: {
		startHour: number
		endHour: number
	}
}

export interface SchedulerStatus {
	isRunning: boolean
	lastCheckTime: number
	nextCheckTime: number
	pendingUpgrades: number
	runningUpgrades: number
	totalUpgradesCompleted: number
	totalUpgradesFailed: number
}

const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
	enabled: true,
	checkInterval: 60 * 60 * 1000,
	maxConcurrentUpgrades: 1,
	upgradeWindow: {
		startHour: 0,
		endHour: 24,
	},
}

export class ConfigUpgradeScheduler extends EventEmitter {
	private config: SchedulerConfig
	private isRunning: boolean = false
	private checkTimer?: NodeJS.Timeout
	private lastCheckTime: number = 0
	private totalUpgradesCompleted: number = 0
	private totalUpgradesFailed: number = 0

	constructor(
		private configManagers: Map<string, VectorStorageConfigManager>,
		config: Partial<SchedulerConfig> = {},
	) {
		super()
		this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...config }
	}

	public start(): void {
		if (this.isRunning) {
			console.warn("[ConfigUpgradeScheduler] Scheduler is already running")
			return
		}

		if (!this.config.enabled) {
			console.log("[ConfigUpgradeScheduler] Scheduler is disabled")
			return
		}

		this.isRunning = true
		console.log("[ConfigUpgradeScheduler] Starting scheduler with check interval:", this.config.checkInterval)

		this.scheduleNextCheck()
	}

	public stop(): void {
		if (!this.isRunning) {
			return
		}

		this.isRunning = false

		if (this.checkTimer) {
			clearTimeout(this.checkTimer)
			this.checkTimer = undefined
		}

		console.log("[ConfigUpgradeScheduler] Scheduler stopped")
	}

	private scheduleNextCheck(): void {
		if (!this.isRunning) {
			return
		}

		const now = Date.now()
		const nextCheckTime = now + this.config.checkInterval

		this.checkTimer = setTimeout(() => {
			this.performCheck().catch((error) => {
				console.error("[ConfigUpgradeScheduler] Error during check:", error)
			})
		}, this.config.checkInterval)

		this.emit("scheduled", { nextCheckTime })
	}

	private async performCheck(): Promise<void> {
		if (!this.isRunning) {
			return
		}

		this.lastCheckTime = Date.now()
		this.emit("checkStarted", { checkTime: this.lastCheckTime })

		try {
			const currentHour = new Date().getHours()
			const { startHour, endHour } = this.config.upgradeWindow

			if (!this.isWithinUpgradeWindow(currentHour, startHour, endHour)) {
				console.log(
					`[ConfigUpgradeScheduler] Current hour ${currentHour} is outside upgrade window (${startHour}-${endHour}), skipping check`,
				)
				this.scheduleNextCheck()
				return
			}

			const runningUpgrades = this.countRunningUpgrades()

			if (runningUpgrades >= this.config.maxConcurrentUpgrades) {
				console.log(
					`[ConfigUpgradeScheduler] Maximum concurrent upgrades (${this.config.maxConcurrentUpgrades}) reached, skipping check`,
				)
				this.scheduleNextCheck()
				return
			}

			const upgradeResults = await this.checkAllCollections()

			for (const result of upgradeResults) {
				if (result.success) {
					this.totalUpgradesCompleted++
					this.emit("upgradeCompleted", {
						collectionName: result.collectionName,
						duration: result.duration,
					})
				} else {
					this.totalUpgradesFailed++
					this.emit("upgradeFailed", {
						collectionName: result.collectionName,
						error: result.error,
					})
					this.emit("checkError", { error: result.error })
				}
			}
		} catch (error) {
			console.error("[ConfigUpgradeScheduler] Error during check:", error)
			this.emit("checkError", { error })
		} finally {
			this.emit("checkCompleted", {
				checkTime: this.lastCheckTime,
				duration: Date.now() - this.lastCheckTime,
			})
			this.scheduleNextCheck()
		}
	}

	private async checkAllCollections(): Promise<
		Array<{
			collectionName: string
			success: boolean
			duration: number
			error?: Error
		}>
	> {
		const results: Array<{
			collectionName: string
			success: boolean
			duration: number
			error?: Error
		}> = []

		for (const [collectionName, configManager] of this.configManagers) {
			try {
				const startTime = Date.now()
				const upgraded = await configManager.checkAndUpgradeCollection(collectionName)
				const duration = Date.now() - startTime

				if (upgraded) {
					console.log(
						`[ConfigUpgradeScheduler] Collection ${collectionName} was upgraded successfully in ${duration}ms`,
					)
					results.push({
						collectionName,
						success: true,
						duration,
					})
				} else {
					console.log(`[ConfigUpgradeScheduler] Collection ${collectionName} does not require upgrade`)
				}
			} catch (error) {
				console.error(`[ConfigUpgradeScheduler] Failed to check/upgrade collection ${collectionName}:`, error)
				results.push({
					collectionName,
					success: false,
					duration: 0,
					error: error as Error,
				})
			}
		}

		return results
	}

	private isWithinUpgradeWindow(currentHour: number, startHour: number, endHour: number): boolean {
		if (startHour === 0 && endHour === 24) {
			return true
		}

		if (startHour < endHour) {
			return currentHour >= startHour && currentHour < endHour
		} else {
			return currentHour >= startHour || currentHour < endHour
		}
	}

	private countRunningUpgrades(): number {
		let count = 0

		for (const configManager of this.configManagers.values()) {
			const currentUpgrade = configManager.getCurrentUpgrade(
				configManager.getConfig().mode === "preset" ? configManager.getConfig().preset! : "medium",
			)

			if (currentUpgrade && currentUpgrade.status === "in_progress") {
				count++
			}
		}

		return count
	}

	public addConfigManager(collectionName: string, configManager: VectorStorageConfigManager): void {
		this.configManagers.set(collectionName, configManager)
		console.log(`[ConfigUpgradeScheduler] Added config manager for collection ${collectionName}`)
	}

	public removeConfigManager(collectionName: string): void {
		this.configManagers.delete(collectionName)
		console.log(`[ConfigUpgradeScheduler] Removed config manager for collection ${collectionName}`)
	}

	public updateConfig(newConfig: Partial<SchedulerConfig>): void {
		this.config = { ...this.config, ...newConfig }

		if (newConfig.checkInterval !== undefined && this.isRunning) {
			console.log(
				`[ConfigUpgradeScheduler] Updated check interval to ${newConfig.checkInterval}ms, rescheduling`,
			)

			if (this.checkTimer) {
				clearTimeout(this.checkTimer)
				this.checkTimer = undefined
			}

			this.scheduleNextCheck()
		}
	}

	public getConfig(): SchedulerConfig {
		return { ...this.config }
	}

	public getStatus(): SchedulerStatus {
		const runningUpgrades = this.countRunningUpgrades()
		const nextCheckTime = this.lastCheckTime + this.config.checkInterval

		return {
			isRunning: this.isRunning,
			lastCheckTime: this.lastCheckTime,
			nextCheckTime,
			pendingUpgrades: 0,
			runningUpgrades,
			totalUpgradesCompleted: this.totalUpgradesCompleted,
			totalUpgradesFailed: this.totalUpgradesFailed,
		}
	}

	public getAllCurrentUpgrades(): Map<string, UpgradeProgress> {
		const allUpgrades = new Map<string, UpgradeProgress>()

		for (const [collectionName, configManager] of this.configManagers) {
			const currentUpgrade = configManager.getCurrentUpgrade(
				configManager.getConfig().mode === "preset" ? configManager.getConfig().preset! : "medium",
			)

			if (currentUpgrade) {
				allUpgrades.set(collectionName, currentUpgrade)
			}
		}

		return allUpgrades
	}

	public async triggerManualCheck(): Promise<void> {
		if (!this.isRunning) {
			throw new Error("Scheduler is not running")
		}

		console.log("[ConfigUpgradeScheduler] Triggering manual check")

		if (this.checkTimer) {
			clearTimeout(this.checkTimer)
			this.checkTimer = undefined
		}

		await this.performCheck()
	}

	public async triggerManualUpgrade(collectionName: string): Promise<boolean> {
		if (!this.isRunning) {
			throw new Error("Scheduler is not running")
		}

		const configManager = this.configManagers.get(collectionName)

		if (!configManager) {
			throw new Error(`Config manager not found for collection ${collectionName}`)
		}

		console.log(`[ConfigUpgradeScheduler] Triggering manual upgrade for collection ${collectionName}`)

		try {
			const startTime = Date.now()
			const upgraded = await configManager.checkAndUpgradeCollection(collectionName)
			const duration = Date.now() - startTime

			if (upgraded) {
				this.totalUpgradesCompleted++
				this.emit("upgradeCompleted", {
					collectionName,
					duration,
				})
			}

			return upgraded
		} catch (error) {
			this.totalUpgradesFailed++
			this.emit("upgradeFailed", {
				collectionName,
				error: error as Error,
			})
			throw error
		}
	}
}
