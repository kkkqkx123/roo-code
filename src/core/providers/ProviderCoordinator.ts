import * as vscode from "vscode"

import {
	type ProviderName,
	type ProviderSettings,
	type ProviderSettingsEntry,
	type ModeConfig,
} from "@shared/types"

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

	/**
	 * Disposes the provider coordinator
	 */
	public dispose(): void {
		// ProviderSettingsManager doesn't have a dispose method
		// Nothing to clean up currently
	}
}