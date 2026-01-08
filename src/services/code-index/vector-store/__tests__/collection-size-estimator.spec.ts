import { QdrantClient } from "@qdrant/js-client-rest"
import { CollectionSizeEstimator } from "../collection-size-estimator"

vitest.mock("@qdrant/js-client-rest")

describe("CollectionSizeEstimator", () => {
	let estimator: CollectionSizeEstimator
	let mockQdrantClient: any

	const mockQdrantUrl = "http://mock-qdrant:6333"
	const mockApiKey = "test-api-key"
	const mockCollectionName = "test-collection"

	beforeEach(() => {
		vitest.clearAllMocks()

		mockQdrantClient = {
			getCollection: vitest.fn(),
		}

		;(QdrantClient as any).mockImplementation(() => mockQdrantClient)

		estimator = new CollectionSizeEstimator(mockQdrantUrl, mockApiKey)
	})

	it("should correctly initialize QdrantClient", () => {
		expect(QdrantClient).toHaveBeenCalledWith({
			url: mockQdrantUrl,
			apiKey: mockApiKey,
		})
	})

	it("should correctly initialize QdrantClient without API key", () => {
		const estimatorWithoutKey = new CollectionSizeEstimator(mockQdrantUrl)
		expect(QdrantClient).toHaveBeenCalledWith({
			url: mockQdrantUrl,
			apiKey: undefined,
		})
	})

	describe("estimateSize", () => {
		it("should return the correct collection size", async () => {
			const mockPointsCount = 1000
			mockQdrantClient.getCollection.mockResolvedValue({
				points_count: mockPointsCount,
			})

			const size = await estimator.estimateSize(mockCollectionName)

			expect(mockQdrantClient.getCollection).toHaveBeenCalledWith(mockCollectionName)
			expect(size).toBe(mockPointsCount)
		})

		it("should return 0 when collection has no points", async () => {
			mockQdrantClient.getCollection.mockResolvedValue({
				points_count: 0,
			})

			const size = await estimator.estimateSize(mockCollectionName)

			expect(size).toBe(0)
		})

		it("should return 0 when points_count is undefined", async () => {
			mockQdrantClient.getCollection.mockResolvedValue({
				points_count: undefined,
			})

			const size = await estimator.estimateSize(mockCollectionName)

			expect(size).toBe(0)
		})

		it("should return 0 when getCollection throws an error", async () => {
			const mockError = new Error("Collection not found")
			mockQdrantClient.getCollection.mockRejectedValue(mockError)

			const size = await estimator.estimateSize(mockCollectionName)

			expect(size).toBe(0)
		})

		it("should handle network errors gracefully", async () => {
			const mockError = new Error("Network error")
			mockQdrantClient.getCollection.mockRejectedValue(mockError)

			const size = await estimator.estimateSize(mockCollectionName)

			expect(size).toBe(0)
		})
	})

	describe("estimateSizeFromFiles", () => {
		it("should correctly estimate size from file count with default vectors per file", async () => {
			const fileCount = 100
			const expectedSize = fileCount * 10

			const size = await estimator.estimateSizeFromFiles(fileCount)

			expect(size).toBe(expectedSize)
		})

		it("should correctly estimate size with custom vectors per file", async () => {
			const fileCount = 100
			const avgVectorsPerFile = 20
			const expectedSize = fileCount * avgVectorsPerFile

			const size = await estimator.estimateSizeFromFiles(fileCount, avgVectorsPerFile)

			expect(size).toBe(expectedSize)
		})

		it("should handle zero file count", async () => {
			const fileCount = 0
			const expectedSize = 0

			const size = await estimator.estimateSizeFromFiles(fileCount)

			expect(size).toBe(expectedSize)
		})

		it("should handle large file counts", async () => {
			const fileCount = 1000000
			const avgVectorsPerFile = 5
			const expectedSize = fileCount * avgVectorsPerFile

			const size = await estimator.estimateSizeFromFiles(fileCount, avgVectorsPerFile)

			expect(size).toBe(expectedSize)
		})
	})
})
