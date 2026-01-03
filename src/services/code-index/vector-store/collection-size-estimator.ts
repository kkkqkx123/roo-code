import { QdrantClient } from "@qdrant/js-client-rest"

export class CollectionSizeEstimator {
	private client: QdrantClient

	constructor(qdrantUrl: string, apiKey?: string) {
		this.client = new QdrantClient({
			url: qdrantUrl,
			apiKey,
		})
	}

	async estimateSize(collectionName: string): Promise<number> {
		try {
			const collectionInfo = await this.client.getCollection(collectionName)
			return collectionInfo.points_count || 0
		} catch (error) {
			console.warn(`[CollectionSizeEstimator] Failed to get collection size for ${collectionName}:`, error)
			return 0
		}
	}

	async estimateSizeFromFiles(fileCount: number, avgVectorsPerFile: number = 10): Promise<number> {
		return fileCount * avgVectorsPerFile
	}
}
