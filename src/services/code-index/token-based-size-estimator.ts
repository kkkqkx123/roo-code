// 使用字符/4判断，假定100token/vector
import * as path from "path"
import * as fs from "fs/promises"
import { listFiles } from "../glob/list-files"
import { RooIgnoreController } from "../../core/ignore/RooIgnoreController"
import { getWorkspacePathForContext } from "../../utils/path"
import { scannerExtensions } from "./shared/supported-extensions"
import { isPathInIgnoredDirectory } from "../glob/ignore-utils"
import { MAX_LIST_FILES_LIMIT_CODE_INDEX } from "./constants"

export interface SizeEstimationResult {
	estimatedVectorCount: number
	estimatedTokenCount: number
	fileCount: number
	totalFileSize: number
}

export class TokenBasedSizeEstimator {
	private readonly avgTokensPerVector: number = 100
	private readonly avgVectorsPerFile: number = 10

	async estimateCollectionSize(
		directoryPath: string,
	): Promise<SizeEstimationResult> {
		try {
			const scanWorkspace = getWorkspacePathForContext(directoryPath)

			const [allPaths, _] = await listFiles(directoryPath, true, MAX_LIST_FILES_LIMIT_CODE_INDEX)

			const filePaths = allPaths.filter((p) => !p.endsWith("/"))

			const ignoreController = new RooIgnoreController(directoryPath)
			await ignoreController.initialize()

			const allowedPaths = ignoreController.filterPaths(filePaths)

			const supportedPaths = allowedPaths.filter((filePath) => {
				const ext = path.extname(filePath).toLowerCase()
				const relativeFilePath = path.relative(scanWorkspace, filePath)

				if (isPathInIgnoredDirectory(filePath)) {
					return false
				}

				if (!scannerExtensions.includes(ext)) {
					return false
				}

				return true
			})

			let totalTokenCount = 0
			let totalFileSize = 0
			let processedFileCount = 0

			for (const filePath of supportedPaths) {
				try {
					const stats = await fs.stat(filePath)
					if (stats.size > 0) {
						const content = await fs.readFile(filePath, "utf-8")
						const tokenCount = this.estimateTokenCount(content)
						totalTokenCount += tokenCount
						totalFileSize += stats.size
						processedFileCount++
					}
				} catch (error) {
					console.warn(`[TokenBasedSizeEstimator] Failed to read file ${filePath}:`, error)
				}
			}

			const estimatedVectorCount = Math.ceil(totalTokenCount / this.avgTokensPerVector)

			return {
				estimatedVectorCount,
				estimatedTokenCount: totalTokenCount,
				fileCount: processedFileCount,
				totalFileSize,
			}
		} catch (error) {
			console.error("[TokenBasedSizeEstimator] Failed to estimate collection size:", error)
			return {
				estimatedVectorCount: 0,
				estimatedTokenCount: 0,
				fileCount: 0,
				totalFileSize: 0,
			}
		}
	}

	private estimateTokenCount(text: string): number {
		const trimmedText = text.trim()
		if (trimmedText.length === 0) {
			return 0
		}

		const wordCount = trimmedText.split(/\s+/).filter((word) => word.length > 0).length
		const charCount = trimmedText.length

		const avgCharsPerToken = 4
		const estimatedTokens = Math.ceil(charCount / avgCharsPerToken)

		const codeMultiplier = 1.2
		return Math.floor(estimatedTokens * codeMultiplier)
	}
}
