import { safeWriteJson } from "../../utils/safeWriteJson"
import * as path from "path"
import * as fs from "fs/promises"

import { fileExistsAtPath } from "../../utils/fs"

import { GlobalFileNames } from "@shared/globalFileNames"
import { getTaskDirectoryPath } from "../../utils/storage"

// 导入类型定义
export type { ApiMessage, ReadApiMessagesOptions, SaveApiMessagesOptions } from "./types/ApiMessage"
import type { ApiMessage, ReadApiMessagesOptions, SaveApiMessagesOptions } from "./types/ApiMessage"

// 导入错误类
import {
	ApiMessageReadError,
	ApiMessageSaveError,
	ApiMessageParseError,
	ApiMessageMigrationError,
	ApiMessageFileNotFoundError,
	ApiMessageValidationError,
} from "./errors/ApiMessageErrors"

// 导入验证器
import { validateApiMessageArray, sanitizeApiMessageArray } from "./validators/ApiMessageValidator"

/**
 * 从旧格式文件迁移 API 消息
 * @param oldPath - 旧文件路径
 * @param taskId - 任务 ID
 * @returns 迁移后的消息数组
 * @throws {ApiMessageMigrationError} 当迁移失败时抛出
 */
async function migrateFromOldFormat(oldPath: string, taskId: string): Promise<ApiMessage[]> {
	try {
		const fileContent = await fs.readFile(oldPath, "utf8")
		const parsedData = JSON.parse(fileContent)

		if (Array.isArray(parsedData) && parsedData.length === 0) {
			console.warn(
				`[Roo-Debug] readApiMessages: Found OLD API conversation history file (claude_messages.json), but it's empty. TaskId: ${taskId}, Path: ${oldPath}`,
			)
		}

		// 验证迁移的数据
		validateApiMessageArray(parsedData)

		// 删除旧文件
		await fs.unlink(oldPath)
		console.log(`[Roo-Debug] readApiMessages: Successfully migrated old format file. TaskId: ${taskId}, Path: ${oldPath}`)

		return parsedData
	} catch (error) {
		if (error instanceof SyntaxError) {
			throw new ApiMessageParseError(
				`Failed to parse old format file: ${oldPath}`,
				error,
			)
		}
		throw new ApiMessageMigrationError(
			`Failed to migrate from old format: ${oldPath}`,
			error as Error,
		)
	}
}

/**
 * 读取任务的 API 对话历史
 *
 * @param options - 读取选项
 * @param options.taskId - 任务 ID
 * @param options.globalStoragePath - 全局存储路径
 * @returns API 消息数组，如果文件不存在则返回空数组
 * @throws {ApiMessageReadError} 当读取失败时抛出
 * @throws {ApiMessageParseError} 当解析失败时抛出
 * @throws {ApiMessageMigrationError} 当迁移失败时抛出
 *
 * @example
 * ```typescript
 * const messages = await readApiMessages({
 *     taskId: 'task-123',
 *     globalStoragePath: '/path/to/storage'
 * })
 * ```
 */
export async function readApiMessages(options: ReadApiMessagesOptions): Promise<ApiMessage[]> {
	const { taskId, globalStoragePath } = options
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.apiConversationHistory)

	try {
		// 尝试读取新格式的文件
		if (await fileExistsAtPath(filePath)) {
			const fileContent = await fs.readFile(filePath, "utf8")
			
			try {
				const parsedData = JSON.parse(fileContent)
				
				// 验证数据结构
				validateApiMessageArray(parsedData)
				
				if (Array.isArray(parsedData) && parsedData.length === 0) {
					console.warn(
						`[Roo-Debug] readApiMessages: Found API conversation history file, but it's empty. TaskId: ${taskId}, Path: ${filePath}`,
					)
				}
				
				return parsedData
			} catch (error) {
				if (error instanceof SyntaxError) {
					throw new ApiMessageParseError(
						`Failed to parse API conversation history file: ${filePath}`,
						error,
					)
				}
				throw error
			}
		}

		// 尝试从旧格式迁移
		const oldPath = path.join(taskDir, "claude_messages.json")
		if (await fileExistsAtPath(oldPath)) {
			return await migrateFromOldFormat(oldPath, taskId)
		}

		// 文件不存在，返回空数组
		console.warn(
			`[Roo-Debug] readApiMessages: API conversation history file not found for taskId: ${taskId}. Expected at: ${filePath}`,
		)
		return []
	} catch (error) {
		if (error instanceof ApiMessageParseError || error instanceof ApiMessageMigrationError) {
			throw error
		}
		throw new ApiMessageReadError(
			`Failed to read API messages for task: ${taskId}`,
			error as Error,
		)
	}
}

/**
 * 保存任务的 API 对话历史
 *
 * @param options - 保存选项
 * @param options.messages - 要保存的消息数组
 * @param options.taskId - 任务 ID
 * @param options.globalStoragePath - 全局存储路径
 * @throws {ApiMessageValidationError} 当消息验证失败时抛出
 * @throws {ApiMessageSaveError} 当保存失败时抛出
 *
 * @example
 * ```typescript
 * await saveApiMessages({
 *     messages: apiMessages,
 *     taskId: 'task-123',
 *     globalStoragePath: '/path/to/storage'
 * })
 * ```
 */
export async function saveApiMessages(options: SaveApiMessagesOptions): Promise<void> {
	const { messages, taskId, globalStoragePath } = options

	try {
		// 验证输入数据
		if (!Array.isArray(messages)) {
			throw new ApiMessageValidationError("Messages must be an array")
		}

		// 验证每条消息
		validateApiMessageArray(messages)

		// 清理和规范化消息
		const sanitizedMessages = sanitizeApiMessageArray(messages)

		// 保存到文件
		const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
		const filePath = path.join(taskDir, GlobalFileNames.apiConversationHistory)
		
		await safeWriteJson(filePath, sanitizedMessages)
	} catch (error) {
		if (error instanceof ApiMessageValidationError) {
			throw error
		}
		throw new ApiMessageSaveError(
			`Failed to save API messages for task: ${taskId}`,
			error as Error,
		)
	}
}
