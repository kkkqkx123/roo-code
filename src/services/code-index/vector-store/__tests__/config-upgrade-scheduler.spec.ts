import { EventEmitter } from "events"
import { ConfigUpgradeScheduler } from "../config-upgrade-scheduler"
import { VectorStorageConfigManager } from "../../vector-storage-config-manager"

vitest.mock("../../vector-storage-config-manager")

describe("ConfigUpgradeScheduler", () => {
	let scheduler: ConfigUpgradeScheduler
	let mockConfigManagers: Map<string, VectorStorageConfigManager>
	let mockConfigManager1: any
	let mockConfigManager2: any

	const defaultConfig = {
		enabled: true,
		checkInterval: 60000,
		maxConcurrentUpgrades: 1,
		upgradeWindow: {
			startHour: 0,
			endHour: 24,
		},
	}

	beforeEach(() => {
		vitest.clearAllMocks()
		vitest.useFakeTimers()

		mockConfigManager1 = {
			getConfig: vitest.fn().mockReturnValue({
				mode: "preset",
				preset: "small",
			}),
			checkAndUpgradeCollection: vitest.fn(),
			getCurrentUpgrade: vitest.fn().mockReturnValue(null),
		}

		mockConfigManager2 = {
			getConfig: vitest.fn().mockReturnValue({
				mode: "preset",
				preset: "medium",
			}),
			checkAndUpgradeCollection: vitest.fn(),
			getCurrentUpgrade: vitest.fn().mockReturnValue(null),
		}

		;(VectorStorageConfigManager as any).mockImplementation(() => mockConfigManager1)

		mockConfigManagers = new Map([
			["collection1", mockConfigManager1],
			["collection2", mockConfigManager2],
		])

		scheduler = new ConfigUpgradeScheduler(mockConfigManagers, defaultConfig)
	})

	afterEach(() => {
		vitest.useRealTimers()
	})

	describe("constructor", () => {
		it("should initialize with default config", () => {
			const emptyScheduler = new ConfigUpgradeScheduler(new Map())

			const config = emptyScheduler.getConfig()
			expect(config.enabled).toBe(true)
			expect(config.checkInterval).toBe(60 * 60 * 1000)
			expect(config.maxConcurrentUpgrades).toBe(1)
			expect(config.upgradeWindow.startHour).toBe(0)
			expect(config.upgradeWindow.endHour).toBe(24)
		})

		it("should initialize with custom config", () => {
			const customConfig = {
				enabled: false,
				checkInterval: 30000,
				maxConcurrentUpgrades: 2,
				upgradeWindow: {
					startHour: 8,
					endHour: 20,
				},
			}

			const customScheduler = new ConfigUpgradeScheduler(new Map(), customConfig)

			const config = customScheduler.getConfig()
			expect(config.enabled).toBe(false)
			expect(config.checkInterval).toBe(30000)
			expect(config.maxConcurrentUpgrades).toBe(2)
			expect(config.upgradeWindow.startHour).toBe(8)
			expect(config.upgradeWindow.endHour).toBe(20)
		})

		it("should extend EventEmitter", () => {
			expect(scheduler).toBeInstanceOf(EventEmitter)
		})
	})

	describe("start", () => {
		it("should start the scheduler successfully", () => {
			scheduler.start()

			expect(scheduler.getStatus().isRunning).toBe(true)
		})

		it("should not start if already running", () => {
			scheduler.start()

			scheduler.start()

			expect(scheduler.getStatus().isRunning).toBe(true)
		})

		it("should not start if disabled", () => {
			const disabledScheduler = new ConfigUpgradeScheduler(new Map(), {
				enabled: false,
			})

			disabledScheduler.start()

			expect(disabledScheduler.getStatus().isRunning).toBe(false)
		})

		it("should schedule first check", () => {
			scheduler.start()

			const status = scheduler.getStatus()
			expect(status.nextCheckTime).toBeGreaterThan(0)
		})
	})

	describe("stop", () => {
		it("should stop the scheduler successfully", () => {
			scheduler.start()
			scheduler.stop()

			expect(scheduler.getStatus().isRunning).toBe(false)
		})

		it("should handle stop when not running", () => {
			scheduler.stop()

			expect(scheduler.getStatus().isRunning).toBe(false)
		})
	})

	describe("addConfigManager", () => {
		it("should add a config manager", () => {
			const newManager = {
				getConfig: vitest.fn(),
				checkAndUpgradeCollection: vitest.fn(),
				getCurrentUpgrade: vitest.fn(),
			}

			scheduler.addConfigManager("collection3", newManager as any)

			expect(scheduler["configManagers"].has("collection3")).toBe(true)
		})
	})

	describe("removeConfigManager", () => {
		it("should remove a config manager", () => {
			scheduler.removeConfigManager("collection1")

			expect(scheduler["configManagers"].has("collection1")).toBe(false)
		})
	})

	describe("updateConfig", () => {
		it("should update scheduler config", () => {
			scheduler.updateConfig({
				checkInterval: 120000,
			})

			const config = scheduler.getConfig()
			expect(config.checkInterval).toBe(120000)
		})

		it("should reschedule when checkInterval changes while running", () => {
			scheduler.start()

			scheduler.updateConfig({
				checkInterval: 120000,
			})

			const status = scheduler.getStatus()
			expect(status.nextCheckTime).toBeGreaterThan(0)
		})
	})

	describe("getStatus", () => {
		it("should return correct status when not running", () => {
			const status = scheduler.getStatus()

			expect(status.isRunning).toBe(false)
			expect(status.lastCheckTime).toBe(0)
			expect(status.runningUpgrades).toBe(0)
		})

		it("should return correct status when running", () => {
			scheduler.start()

			const status = scheduler.getStatus()

			expect(status.isRunning).toBe(true)
			expect(status.nextCheckTime).toBeGreaterThan(0)
		})

		it("should count running upgrades correctly", () => {
			mockConfigManager1.getCurrentUpgrade.mockReturnValue({
				status: "in_progress",
			})

			const status = scheduler.getStatus()

			expect(status.runningUpgrades).toBe(1)
		})
	})

	describe("getAllCurrentUpgrades", () => {
		it("should return all current upgrades", () => {
			mockConfigManager1.getCurrentUpgrade.mockReturnValue({
				status: "in_progress",
				progress: 50,
			})

			mockConfigManager2.getCurrentUpgrade.mockReturnValue({
				status: "in_progress",
				progress: 75,
			})

			const upgrades = scheduler.getAllCurrentUpgrades()

			expect(upgrades.size).toBe(2)
			expect(upgrades.has("collection1")).toBe(true)
			expect(upgrades.has("collection2")).toBe(true)
		})

		it("should skip managers without upgrades", () => {
			mockConfigManager1.getCurrentUpgrade.mockReturnValue(null)
			mockConfigManager2.getCurrentUpgrade.mockReturnValue(null)

			const upgrades = scheduler.getAllCurrentUpgrades()

			expect(upgrades.size).toBe(0)
		})
	})

	describe("triggerManualCheck", () => {
		it("should trigger manual check when running", async () => {
			scheduler.start()

			mockConfigManager1.checkAndUpgradeCollection.mockResolvedValue(false)
			mockConfigManager2.checkAndUpgradeCollection.mockResolvedValue(false)

			await scheduler.triggerManualCheck()

			expect(mockConfigManager1.checkAndUpgradeCollection).toHaveBeenCalledWith("collection1")
			expect(mockConfigManager2.checkAndUpgradeCollection).toHaveBeenCalledWith("collection2")
		})

		it("should throw error when not running", async () => {
			await expect(scheduler.triggerManualCheck()).rejects.toThrow("Scheduler is not running")
		})
	})

	describe("triggerManualUpgrade", () => {
		it("should trigger manual upgrade for specific collection", async () => {
			scheduler.start()

			mockConfigManager1.checkAndUpgradeCollection.mockResolvedValue(true)

			const result = await scheduler.triggerManualUpgrade("collection1")

			expect(result).toBe(true)
			expect(mockConfigManager1.checkAndUpgradeCollection).toHaveBeenCalledWith("collection1")
		})

		it("should throw error for non-existent collection", async () => {
			scheduler.start()

			await expect(scheduler.triggerManualUpgrade("non-existent")).rejects.toThrow(
				"Config manager not found for collection non-existent",
			)
		})

		it("should throw error when not running", async () => {
			await expect(scheduler.triggerManualUpgrade("collection1")).rejects.toThrow(
				"Scheduler is not running",
			)
		})

		it("should emit upgradeCompleted event on success", async () => {
			scheduler.start()

			mockConfigManager1.checkAndUpgradeCollection.mockResolvedValue(true)

			const upgradeCompletedSpy = vitest.fn()
			scheduler.on("upgradeCompleted", upgradeCompletedSpy)

			await scheduler.triggerManualUpgrade("collection1")

			expect(upgradeCompletedSpy).toHaveBeenCalled()
		})

		it("should emit upgradeFailed event on failure", async () => {
			scheduler.start()

			mockConfigManager1.checkAndUpgradeCollection.mockRejectedValue(
				new Error("Upgrade failed"),
			)

			const upgradeFailedSpy = vitest.fn()
			scheduler.on("upgradeFailed", upgradeFailedSpy)

			await expect(
				scheduler.triggerManualUpgrade("collection1"),
			).rejects.toThrow()

			expect(upgradeFailedSpy).toHaveBeenCalled()
		})
	})

	describe("isWithinUpgradeWindow", () => {
		it("should return true for 24/7 window", () => {
			const result = (scheduler as any).isWithinUpgradeWindow(12, 0, 24)
			expect(result).toBe(true)
		})

		it("should return true for time within window", () => {
			const result = (scheduler as any).isWithinUpgradeWindow(10, 8, 20)
			expect(result).toBe(true)
		})

		it("should return false for time outside window", () => {
			const result = (scheduler as any).isWithinUpgradeWindow(6, 8, 20)
			expect(result).toBe(false)
		})

		it("should handle overnight window", () => {
			const result = (scheduler as any).isWithinUpgradeWindow(2, 22, 6)
			expect(result).toBe(true)
		})
	})

	describe("countRunningUpgrades", () => {
		it("should count upgrades with in_progress status", () => {
			mockConfigManager1.getCurrentUpgrade.mockReturnValue({
				status: "in_progress",
			})
			mockConfigManager2.getCurrentUpgrade.mockReturnValue({
				status: "completed",
			})

			const count = (scheduler as any).countRunningUpgrades()

			expect(count).toBe(1)
		})

		it("should return 0 when no upgrades are running", () => {
			mockConfigManager1.getCurrentUpgrade.mockReturnValue(null)
			mockConfigManager2.getCurrentUpgrade.mockReturnValue(null)

			const count = (scheduler as any).countRunningUpgrades()

			expect(count).toBe(0)
		})
	})

	describe("event emission", () => {
		it("should emit scheduled event when scheduling", () => {
			const scheduledSpy = vitest.fn()
			scheduler.on("scheduled", scheduledSpy)

			scheduler.start()

			expect(scheduledSpy).toHaveBeenCalled()
		})

		it("should emit checkStarted event when check starts", async () => {
			scheduler.start()

			mockConfigManager1.checkAndUpgradeCollection.mockResolvedValue(false)

			const checkStartedSpy = vitest.fn()
			scheduler.on("checkStarted", checkStartedSpy)

			await scheduler.triggerManualCheck()

			expect(checkStartedSpy).toHaveBeenCalled()
		})

		it("should emit checkCompleted event when check completes", async () => {
			scheduler.start()

			mockConfigManager1.checkAndUpgradeCollection.mockResolvedValue(false)

			const checkCompletedSpy = vitest.fn()
			scheduler.on("checkCompleted", checkCompletedSpy)

			await scheduler.triggerManualCheck()

			expect(checkCompletedSpy).toHaveBeenCalled()
		})

		it("should emit checkError event when check fails", async () => {
			scheduler.start()

			mockConfigManager1.checkAndUpgradeCollection.mockRejectedValue(
				new Error("Check failed"),
			)

			const checkErrorSpy = vitest.fn()
			scheduler.on("checkError", checkErrorSpy)

			await scheduler.triggerManualCheck()

			expect(checkErrorSpy).toHaveBeenCalled()
		})
	})
})
