import { safeWriteJson } from "../../utils/safeWriteJson"
import * as path from "path"
import * as fs from "fs/promises"

import type { ClineMessage } from "@shared/types"

import { fileExistsAtPath } from "../../utils/fs"

import { GlobalFileNames } from "../../shared/globalFileNames"
import { getTaskDirectoryPath } from "../../utils/storage"

export type ReadTaskMessagesOptions = {
	taskId: string
	globalStoragePath: string
}

export async function readTaskMessages({
	taskId,
	globalStoragePath,
}: ReadTaskMessagesOptions): Promise<ClineMessage[]> {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.uiMessages)
	const fileExists = await fileExistsAtPath(filePath)

	if (fileExists) {
		try {
			const fileContent = await fs.readFile(filePath, "utf8")
			if (!fileContent.trim()) {
				console.warn(`[readTaskMessages] UI messages file is empty for task ${taskId}: ${filePath}`)
				return []
			}
			const messages = JSON.parse(fileContent)
			console.log(`[readTaskMessages] Successfully loaded ${messages.length} UI messages for task ${taskId}`)
			return messages
		} catch (error) {
			console.error(`[readTaskMessages] Error reading UI messages file for task ${taskId}: ${error.message}`)
			console.error(`[readTaskMessages] File path: ${filePath}`)
			// Return empty array to allow graceful recovery
			return []
		}
	}

	console.log(`[readTaskMessages] No UI messages file found for task ${taskId}: ${filePath}`)
	return []
}

export type SaveTaskMessagesOptions = {
	messages: ClineMessage[]
	taskId: string
	globalStoragePath: string
}

export async function saveTaskMessages({ messages, taskId, globalStoragePath }: SaveTaskMessagesOptions) {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.uiMessages)
	await safeWriteJson(filePath, messages)
}
