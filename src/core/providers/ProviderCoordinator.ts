import * as vscode from "vscode"

import {
	type ProviderName,
	type ProviderSettings,
	type ProviderSettingsEntry,
	type ModeConfig,
} from "@roo-code/types"

import { ProviderSettingsManager } from "../config/ProviderSettingsManager"
import { ContextProxy } from "../config/ContextProxy"

export class ProviderCoordinator {
	private providerSettingsManager: ProviderSettingsManager
	private contextProxy: ContextProxy

	constructor(context: vscode.ExtensionContext, contextProxy: ContextProxy) {
		this.contextProxy = contextProxy
		this.providerSettingsManager = new ProviderSettingsManager(context)
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
		const id = await this.providerSettingsManager.saveConfig(name, providerSettings)

		if (activate) {
			await this.activateProviderProfile({ name })
		}

		return id
	}

	/**
	 * Deletes a provider profile
	 */
	public async deleteProviderProfile(profileToDelete: ProviderSettingsEntry): Promise<void> {
		await this.providerSettingsManager.deleteConfig(profileToDelete.name)
	}

	/**
	 * Activates a provider profile
	 */
	public async activateProviderProfile(args: { name: string } | { id: string }): Promise<{ name: string; id?: string; providerSettings: ProviderSettings }> {
		const { name, id, ...providerSettings } = await this.providerSettingsManager.activateProfile(args)

		await Promise.all([
			this.contextProxy.setValue("listApiConfigMeta", await this.providerSettingsManager.listConfig()),
			this.contextProxy.setValue("currentApiConfigName", name),
			this.contextProxy.setProviderSettings(providerSettings),
		])

		return { name, id, providerSettings }
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
	 * Handles OpenRouter callback
	 */
	public async handleOpenRouterCallback(code: string): Promise<void> {
		try {
			const response = await fetch("https://openrouter.ai/api/v1/auth/keys", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					code,
				}),
			})

			if (!response.ok) {
				throw new Error(`OpenRouter API error: ${response.status}`)
			}

			const data = await response.json()
			if (data.key) {
				await this.contextProxy.storeSecret("openRouterApiKey", data.key)
				
				// Show success message
				vscode.window.showInformationMessage("OpenRouter API key has been set successfully!")
			} else {
				throw new Error("No API key received from OpenRouter")
			}
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to get OpenRouter API key: ${error.message}`)
			throw error
		}
	}

	/**
	 * Handles Requesty callback
	 */
	public async handleRequestyCallback(code: string, baseUrl: string | null): Promise<void> {
		try {
			const url = baseUrl ? `${baseUrl}/api/keys` : "https://api.requesty.ai/api/keys"
			const response = await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					code,
				}),
			})

			if (!response.ok) {
				throw new Error(`Requesty API error: ${response.status}`)
			}

			const data = await response.json()
			if (data.key) {
				await this.contextProxy.storeSecret("requestyApiKey", data.key)
				
				// Show success message
				vscode.window.showInformationMessage("Requesty API key has been set successfully!")
			} else {
				throw new Error("No API key received from Requesty")
			}
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to get Requesty API key: ${error.message}`)
			throw error
		}
	}

	/**
	 * Updates task API handler if needed based on mode
	 */
	public async updateTaskApiHandlerIfNeeded(
		mode: ModeConfig,
		hasFileBasedSystemPromptOverride: boolean,
	): Promise<void> {
		const currentProvider = await this.contextProxy.getValue("apiProvider")
		const currentModelId = await this.contextProxy.getValue("apiModelId")

		// Check if we need to update the API handler based on mode changes
		if (mode.slug === "architect" && currentProvider === "anthropic" && !currentModelId?.includes("claude-3-5")) {
			// For architect mode, prefer Claude 3.5 models
			await this.contextProxy.setValue("apiModelId", "claude-3-5-sonnet-20241022")
		}

		// Handle other mode-specific API handler updates
		if (hasFileBasedSystemPromptOverride) {
			// If there's a file-based system prompt override, we might need to adjust the model
			// based on the capabilities required
			console.log("File-based system prompt override detected, API handler may need adjustment")
		}
	}

	/**
	 * Gets the provider settings manager
	 */
	public getProviderSettingsManager(): ProviderSettingsManager {
		return this.providerSettingsManager
	}

	/**
	 * Disposes the provider coordinator
	 */
	public dispose(): void {
		// ProviderSettingsManager doesn't have a dispose method
		// Nothing to clean up currently
	}
}