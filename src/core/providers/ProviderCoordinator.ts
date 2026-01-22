import * as vscode from "vscode"

import {
	type ProviderName,
	type ProviderSettings,
	type ProviderSettingsEntry,
	type ModeConfig,
} from "@shared/types"

import { ProviderSettingsManager } from "../config/ProviderSettingsManager"
import { ContextProxy } from "../config/ContextProxy"
import { ErrorHandler } from "../error/ErrorHandler"

export class ProviderCoordinator {
	private providerSettingsManager: ProviderSettingsManager
	private contextProxy: ContextProxy
	private errorHandler: ErrorHandler

	constructor(context: vscode.ExtensionContext, contextProxy: ContextProxy) {
		this.contextProxy = contextProxy
		this.providerSettingsManager = new ProviderSettingsManager(context)
		this.errorHandler = new ErrorHandler()
	}

	/**
	 * Checks if a provider profile entry exists
	 */
	public hasProviderProfileEntry(name: string): boolean {
		const profiles = this.contextProxy.getValues().listApiConfigMeta || []
		return profiles.some((profile) => profile.name === name)
	}

	/**
	 * Upserts a provider profile
	 */
	public async upsertProviderProfile(
		name: string,
		providerSettings: ProviderSettings,
		activate: boolean = true,
	): Promise<string | undefined> {
		try {
			const id = await this.executeWithRetry(
				async () => await this.providerSettingsManager.saveConfig(name, providerSettings),
				"upsertProviderProfile",
				3
			)

			if (activate) {
				await this.activateProviderProfile({ name })
			}

			return id
		} catch (error) {
			console.error("[ProviderCoordinator] Failed to upsert provider profile:", error)
			throw error
		}
	}

	/**
	 * Deletes a provider profile
	 */
	public async deleteProviderProfile(profileToDelete: ProviderSettingsEntry): Promise<void> {
		try {
			await this.executeWithRetry(
				async () => await this.providerSettingsManager.deleteConfig(profileToDelete.name),
				"deleteProviderProfile",
				3
			)
		} catch (error) {
			console.error("[ProviderCoordinator] Failed to delete provider profile:", error)
			throw error
		}
	}

	/**
	 * Activates a provider profile
	 */
	public async activateProviderProfile(args: { name: string } | { id: string }): Promise<{ name: string; id?: string; providerSettings: ProviderSettings }> {
		try {
			const { name, id, ...providerSettings } = await this.executeWithRetry(
				async () => await this.providerSettingsManager.activateProfile(args),
				"activateProviderProfile",
				3
			)

			await Promise.all([
				this.contextProxy.setValue("listApiConfigMeta", await this.providerSettingsManager.listConfig()),
				this.contextProxy.setValue("currentApiConfigName", name),
				this.contextProxy.setProviderSettings(providerSettings),
			])

			return { name, id, providerSettings }
		} catch (error) {
			console.error("[ProviderCoordinator] Failed to activate provider profile:", error)
			throw error
		}
	}

	/**
	 * Gets all provider profiles
	 */
	public async getProviderProfiles(): Promise<ProviderSettingsEntry[]> {
		return await this.providerSettingsManager.listConfig()
	}

	/**
	 * Gets the current provider profile
	 */
	public async getProviderProfile(): Promise<string> {
		const currentApiConfigName = await this.contextProxy.getValue("currentApiConfigName")
		return currentApiConfigName || "default"
	}

	/**
	 * Sets the current provider profile
	 */
	public async setProviderProfile(name: string): Promise<void> {
		await this.activateProviderProfile({ name })
	}

	/**
	 * Updates task API handler if needed based on mode
	 */
	public async updateTaskApiHandlerIfNeeded(mode: ModeConfig): Promise<void> {
		const currentProvider = await this.contextProxy.getValue("apiProvider")
		const currentModelId = await this.contextProxy.getValue("apiModelId")

		// Check if we need to update the API handler based on mode changes
		if (mode.slug === "architect" && currentProvider === "anthropic" && !currentModelId?.includes("claude-3-5")) {
			// For architect mode, prefer Claude 3.5 models
			await this.contextProxy.setValue("apiModelId", "claude-3-5-sonnet-20241022")
		}
	}

	/**
	 * Gets the provider settings manager
	 */
	public getProviderSettingsManager(): ProviderSettingsManager {
		return this.providerSettingsManager
	}

	private async executeWithRetry<T>(
		operation: () => Promise<T>,
		operationName: string,
		maxRetries: number = 3
	): Promise<T> {
		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				console.log(`[ProviderCoordinator#${operationName}] Attempt ${attempt + 1}/${maxRetries}`)
				const result = await operation()
				console.log(`[ProviderCoordinator#${operationName}] Operation completed successfully`)
				return result
			} catch (error) {
				console.error(`[ProviderCoordinator#${operationName}] Error on attempt ${attempt + 1}: ${error}`)
				
				const result = await this.errorHandler.handleError(
					error instanceof Error ? error : new Error(String(error)),
					{
						operation: operationName,
						timestamp: Date.now()
					}
				)

				if (attempt === maxRetries - 1 || !result.shouldRetry) {
					console.log(`[ProviderCoordinator#${operationName}] Max retries reached or no retry allowed, throwing error`)
					throw error
				}

				const delay = 1000 * (attempt + 1)
				console.log(`[ProviderCoordinator#${operationName}] Retrying after ${delay}ms`)
				await this.delay(delay)
			}
		}
		throw new Error(`Operation ${operationName} failed after ${maxRetries} attempts`)
	}

	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms))
	}
}