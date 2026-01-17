import fs from "fs/promises"
import path from "path"
import * as vscode from "vscode"
import { isBinaryFile } from "isbinaryfile"

const binaryFileCache = new Map<string, { isBinary: boolean; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000

const DEFAULT_BINARY_EXTENSIONS_TO_IGNORE = new Set([
	".exe",
	".dll",
	".so",
	".dylib",
	".bin",
	".dat",
	".obj",
	".o",
	".a",
	".lib",
])

const MAX_FILE_SIZE_FOR_DETECTION = 10 * 1024 * 1024

function getBinaryFileIgnorePatterns(): Set<string> {
	const config = vscode.workspace.getConfiguration("coder")
	const patterns = config.get<string[]>("binaryFileIgnorePatterns", [])
	return new Set(patterns.map((p) => p.toLowerCase()))
}

export function shouldIgnoreBinaryFileByExtension(filePath: string): boolean {
	const ext = path.extname(filePath).toLowerCase()
	const ignorePatterns = getBinaryFileIgnorePatterns()

	for (const pattern of ignorePatterns) {
		if (pattern.startsWith("*.")) {
			const patternExt = pattern.slice(1).toLowerCase()
			if (ext === patternExt) {
				return true
			}
		} else if (pattern.endsWith("*")) {
			const patternPrefix = pattern.slice(0, -1).toLowerCase()
			if (filePath.toLowerCase().startsWith(patternPrefix)) {
				return true
			}
		} else if (pattern.includes("*")) {
			const regexPattern = pattern
				.replace(/\./g, "\\.")
				.replace(/\*/g, ".*")
				.toLowerCase()
			const regex = new RegExp(regexPattern)
			if (regex.test(filePath.toLowerCase())) {
				return true
			}
		} else {
			if (filePath.toLowerCase() === pattern.toLowerCase()) {
				return true
			}
		}
	}

	return DEFAULT_BINARY_EXTENSIONS_TO_IGNORE.has(ext)
}

export async function safeIsBinaryFile(filePath: string): Promise<boolean> {
	try {
		return await isBinaryFile(filePath)
	} catch (error) {
		console.warn(`Failed to check if file is binary: ${filePath}`, error)
		return false
	}
}

export async function cachedIsBinaryFile(filePath: string): Promise<boolean> {
	const now = Date.now()
	const cached = binaryFileCache.get(filePath)

	if (cached && now - cached.timestamp < CACHE_TTL) {
		return cached.isBinary
	}

	const isBinary = await safeIsBinaryFile(filePath)
	binaryFileCache.set(filePath, { isBinary, timestamp: now })

	return isBinary
}

export async function shouldCheckBinaryFile(
	filePath: string,
	maxSize: number = MAX_FILE_SIZE_FOR_DETECTION,
): Promise<boolean> {
	try {
		const stats = await fs.stat(filePath)
		return stats.size <= maxSize
	} catch {
		return false
	}
}

export async function isBinaryFileOptimized(filePath: string): Promise<boolean> {
	if (shouldIgnoreBinaryFileByExtension(filePath)) {
		return true
	}

	if (!(await shouldCheckBinaryFile(filePath))) {
		return true
	}

	return await cachedIsBinaryFile(filePath)
}

export function clearBinaryFileCache(): void {
	binaryFileCache.clear()
}

export function getBinaryFileCacheSize(): number {
	return binaryFileCache.size
}
