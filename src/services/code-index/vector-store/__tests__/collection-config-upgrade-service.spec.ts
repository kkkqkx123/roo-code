import { QdrantClient } from "@qdrant/js-client-rest"
import { CollectionConfigUpgradeService } from "../collection-config-upgrade-service"
import { VectorStorageConfigManager } from "../../vector-storage-config-manager"
import { VECTOR_STORAGE_PRESETS } from "@shared/config/vector-storage-presets"

vitest.mock("@qdrant/js-client-rest")
vitest.mock("../../vector-storage-config-manager")

// Mock vscode module
vitest.mock("vscode", () => ({
	EventEmitter: vitest.fn().mockImplementation(() => ({
		event: vitest.fn(),
		fire: vitest.fn(),
		dispose: vitest.fn(),
	})),
}))

describe("CollectionConfigUpgradeService", () => {
	let upgradeService: CollectionConfigUpgradeService
	let mockQdrantClient: any
	let mockConfigManager: any

	const mockCollectionName = "test-collection"
	const mockThresholds = {
		tiny: 2000,
		small: 50000,
		medium: 500000,
		large: Infinity,
	}

	beforeEach(() => {
		vitest.clearAllMocks()

		mockQdrantClient = {
			getCollection: vitest.fn(),
			updateCollection: vitest.fn(),
		}

		mockConfigManager = {
			getConfig: vitest.fn().mockReturnValue({
				thresholds: mockThresholds,
			}),
		}

		;(QdrantClient as any).mockImplementation(() => mockQdrantClient)
		;(VectorStorageConfigManager as any).mockImplementation(() => mockConfigManager)

		upgradeService = new CollectionConfigUpgradeService(
			mockQdrantClient,
			mockConfigManager,
			mockCollectionName,
		)
	})

	describe("constructor", () => {
		it("should correctly initialize the service", () => {
			expect((upgradeService as any).qdrantClient).toBe(mockQdrantClient)
			expect((upgradeService as any).configManager).toBe(mockConfigManager)
			expect((upgradeService as any).collectionName).toBe(mockCollectionName)
			expect((upgradeService as any).thresholds).toEqual(mockThresholds)
		})

		it("should use default thresholds if not provided", () => {
			mockConfigManager.getConfig.mockReturnValue({
				thresholds: undefined,
			})

			const serviceWithoutThresholds = new CollectionConfigUpgradeService(
				mockQdrantClient,
				mockConfigManager,
				mockCollectionName,
			)

			expect((serviceWithoutThresholds as any).thresholds).toEqual({
				tiny: 2000,
				small: 50000,
				medium: 500000,
				large: Infinity,
			})
		})
	})

	describe("getCurrentUpgrade", () => {
		it("should return current upgrade for default collection", () => {
			const mockProgress = {
				collectionName: mockCollectionName,
				status: "in_progress",
				progress: 50,
			}
			;(upgradeService as any).currentUpgrades.set(mockCollectionName, mockProgress)

			const result = upgradeService.getCurrentUpgrade()

			expect(result).toEqual(mockProgress)
		})

		it("should return current upgrade for specified collection", () => {
			const otherCollection = "other-collection"
			const mockProgress = {
				collectionName: otherCollection,
				status: "in_progress",
				progress: 50,
			}
			;(upgradeService as any).currentUpgrades.set(otherCollection, mockProgress)

			const result = upgradeService.getCurrentUpgrade(otherCollection)

			expect(result).toEqual(mockProgress)
		})

		it("should return undefined when no upgrade in progress", () => {
			const result = upgradeService.getCurrentUpgrade()
			expect(result).toBeUndefined()
		})
	})

	describe("isUpgradeInProgress", () => {
		it("should return true when upgrade is in progress", () => {
			const mockProgress = {
				collectionName: mockCollectionName,
				status: "in_progress",
				progress: 50,
			}
			;(upgradeService as any).currentUpgrades.set(mockCollectionName, mockProgress)

			const result = upgradeService.isUpgradeInProgress()

			expect(result).toBe(true)
		})

		it("should return false when upgrade is not in progress", () => {
			const mockProgress = {
				collectionName: mockCollectionName,
				status: "completed",
				progress: 100,
			}
			;(upgradeService as any).currentUpgrades.set(mockCollectionName, mockProgress)

			const result = upgradeService.isUpgradeInProgress()

			expect(result).toBe(false)
		})

		it("should return false when no upgrade exists", () => {
			const result = upgradeService.isUpgradeInProgress()
			expect(result).toBe(false)
		})
	})

	describe("isUpgradePaused", () => {
		it("should return true when upgrade is paused", () => {
			const mockProgress = {
				collectionName: mockCollectionName,
				status: "paused",
				progress: 50,
			}
			;(upgradeService as any).currentUpgrades.set(mockCollectionName, mockProgress)

			const result = upgradeService.isUpgradePaused()

			expect(result).toBe(true)
		})

		it("should return false when upgrade is not paused", () => {
			const mockProgress = {
				collectionName: mockCollectionName,
				status: "in_progress",
				progress: 50,
			}
			;(upgradeService as any).currentUpgrades.set(mockCollectionName, mockProgress)

			const result = upgradeService.isUpgradePaused()

			expect(result).toBe(false)
		})
	})

	describe("cancelUpgrade", () => {
		it("should cancel upgrade successfully", () => {
			const mockProgress = {
				collectionName: mockCollectionName,
				status: "in_progress",
				progress: 50,
				message: "Upgrading...",
			}
			;(upgradeService as any).currentUpgrades.set(mockCollectionName, mockProgress)

			const result = upgradeService.cancelUpgrade()

			expect(result).toBe(true)
			expect((upgradeService as any).currentUpgrades.get(mockCollectionName)).toBeUndefined()
		})

		it("should return false when no upgrade in progress", () => {
			const result = upgradeService.cancelUpgrade()
			expect(result).toBe(false)
		})

		it("should return false when upgrade is already completed", () => {
			const mockProgress = {
				collectionName: mockCollectionName,
				status: "completed",
				progress: 100,
			}
			;(upgradeService as any).currentUpgrades.set(mockCollectionName, mockProgress)

			const result = upgradeService.cancelUpgrade()

			expect(result).toBe(false)
		})
	})

	describe("pauseUpgrade", () => {
		it("should pause upgrade successfully", () => {
			const mockProgress = {
				collectionName: mockCollectionName,
				status: "in_progress",
				progress: 50,
				steps: [],
			}
			;(upgradeService as any).currentUpgrades.set(mockCollectionName, mockProgress)

			const result = upgradeService.pauseUpgrade()

			expect(result).toBe(true)
			expect((upgradeService as any)._pauseRequested).toBe(true)
			expect((upgradeService as any)._pausedStepIndex).toBe(0)
		})

		it("should return false when no upgrade in progress", () => {
			const result = upgradeService.pauseUpgrade()
			expect(result).toBe(false)
		})
	})

	describe("determineTargetPreset", () => {
		it("should return tiny for small collections", () => {
			const result = (upgradeService as any).determineTargetPreset(1000)
			expect(result).toBe("tiny")
		})

		it("should return small for medium collections", () => {
			const result = (upgradeService as any).determineTargetPreset(10000)
			expect(result).toBe("small")
		})

		it("should return medium for large collections", () => {
			const result = (upgradeService as any).determineTargetPreset(100000)
			expect(result).toBe("medium")
		})

		it("should return large for very large collections", () => {
			const result = (upgradeService as any).determineTargetPreset(1000000)
			expect(result).toBe("large")
		})

		it("should handle boundary values correctly", () => {
			expect((upgradeService as any).determineTargetPreset(2000)).toBe("small")
			expect((upgradeService as any).determineTargetPreset(50000)).toBe("medium")
			expect((upgradeService as any).determineTargetPreset(500000)).toBe("large")
		})
	})

	describe("detectCurrentPreset", () => {
		it("should detect tiny preset (no HNSW config)", () => {
			const config = {
				hnsw_config: undefined,
			}
			const result = (upgradeService as any).detectCurrentPreset(config)
			expect(result).toBe("tiny")
		})

		it("should detect small preset", () => {
			const config = {
				hnsw_config: {
					m: 16,
					ef_construct: 128,
				},
			}
			const result = (upgradeService as any).detectCurrentPreset(config)
			expect(result).toBe("small")
		})

		it("should detect medium preset", () => {
			const config = {
				hnsw_config: {
					m: 32,
					ef_construct: 256,
				},
			}
			const result = (upgradeService as any).detectCurrentPreset(config)
			expect(result).toBe("medium")
		})

		it("should detect large preset", () => {
			const config = {
				hnsw_config: {
					m: 64,
					ef_construct: 512,
				},
			}
			const result = (upgradeService as any).detectCurrentPreset(config)
			expect(result).toBe("large")
		})

		it("should return null for unknown preset", () => {
			const config = {
				hnsw_config: {
					m: 100,
					ef_construct: 1000,
				},
			}
			const result = (upgradeService as any).detectCurrentPreset(config)
			expect(result).toBe(null)
		})
	})

	describe("calculateUpgradePath", () => {
		it("should calculate upgrade path from tiny to small", () => {
			const result = (upgradeService as any).calculateUpgradePath("tiny", "small")
			expect(result).toEqual(["small"])
		})

		it("should calculate upgrade path from tiny to medium", () => {
			const result = (upgradeService as any).calculateUpgradePath("tiny", "medium")
			expect(result).toEqual(["small", "medium"])
		})

		it("should calculate upgrade path from tiny to large", () => {
			const result = (upgradeService as any).calculateUpgradePath("tiny", "large")
			expect(result).toEqual(["small", "medium", "large"])
		})

		it("should return empty array for same preset", () => {
			const result = (upgradeService as any).calculateUpgradePath("small", "small")
			expect(result).toEqual([])
		})

		it("should return empty array for downgrade", () => {
			const result = (upgradeService as any).calculateUpgradePath("medium", "small")
			expect(result).toEqual([])
		})

		it("should handle null current preset", () => {
			const result = (upgradeService as any).calculateUpgradePath(null, "small")
			expect(result).toEqual(["small"])
		})
	})

	describe("checkAndUpgradeCollection", () => {
		it("should return false when no upgrade needed", async () => {
			mockQdrantClient.getCollection.mockResolvedValue({
				points_count: 1000,
				config: {
					hnsw_config: undefined,
				},
			})

			const result = await upgradeService.checkAndUpgradeCollection()

			expect(result).toBe(false)
		})

		it("should upgrade when collection size exceeds threshold", async () => {
			mockQdrantClient.getCollection.mockResolvedValue({
				points_count: 10000,
				config: {
					hnsw_config: undefined,
				},
			})

			mockQdrantClient.updateCollection.mockResolvedValue({})

			const result = await upgradeService.checkAndUpgradeCollection()

			expect(result).toBe(true)
			expect(mockQdrantClient.updateCollection).toHaveBeenCalled()
		})

		it("should handle errors gracefully", async () => {
			mockQdrantClient.getCollection.mockRejectedValue(new Error("Collection not found"))

			await expect(upgradeService.checkAndUpgradeCollection()).rejects.toThrow()
		})
	})

	describe("getUpgradeStatistics", () => {
		it("should return correct statistics", () => {
			const history = [
				{
					status: "completed",
					startTime: 1000,
					endTime: 2000,
				},
				{
					status: "failed",
					startTime: 3000,
					endTime: 4000,
				},
				{
					status: "cancelled",
					startTime: 5000,
					endTime: 6000,
				},
			]
			;(upgradeService as any).upgradeHistory.set(mockCollectionName, history)

			const stats = upgradeService.getUpgradeStatistics()

			expect(stats.totalUpgrades).toBe(3)
			expect(stats.successfulUpgrades).toBe(1)
			expect(stats.failedUpgrades).toBe(1)
			expect(stats.cancelledUpgrades).toBe(1)
			expect(stats.averageDuration).toBe(1000)
		})

		it("should handle empty history", () => {
			const stats = upgradeService.getUpgradeStatistics()

			expect(stats.totalUpgrades).toBe(0)
			expect(stats.successfulUpgrades).toBe(0)
			expect(stats.failedUpgrades).toBe(0)
			expect(stats.cancelledUpgrades).toBe(0)
			expect(stats.averageDuration).toBe(0)
		})
	})

	describe("getRecentUpgrades", () => {
		it("should return recent upgrades sorted by time", () => {
			const history = [
				{
					startTime: 1000,
				},
				{
					startTime: 3000,
				},
				{
					startTime: 2000,
				},
			]
			;(upgradeService as any).upgradeHistory.set(mockCollectionName, history)

			const recent = upgradeService.getRecentUpgrades(2)

			expect(recent.length).toBe(2)
			expect(recent[0].startTime).toBe(3000)
			expect(recent[1].startTime).toBe(2000)
		})

		it("should respect limit parameter", () => {
			const history = Array.from({ length: 15 }, (_, i) => ({
				startTime: i * 1000,
			}))
			;(upgradeService as any).upgradeHistory.set(mockCollectionName, history)

			const recent = upgradeService.getRecentUpgrades(10)

			expect(recent.length).toBe(10)
		})
	})
})
