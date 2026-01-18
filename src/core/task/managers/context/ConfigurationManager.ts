import type { ClineProvider } from "../../../webview/ClineProvider"
import type { ProviderSettings } from "@roo-code/types"
import { RooCodeEventName } from "@roo-code/types"

export interface ConfigurationManagerOptions {
	taskId: string
	providerRef: WeakRef<ClineProvider>
	onConfigurationUpdate?: (newConfig: ProviderSettings) => void
}

export class ConfigurationManager {
	private taskId: string
	private providerRef: WeakRef<ClineProvider>
	private onConfigurationUpdate?: (newConfig: ProviderSettings) => void
	private providerProfileChangeListener?: (config: { name: string; provider?: string }) => void

	constructor(options: ConfigurationManagerOptions) {
		this.taskId = options.taskId
		this.providerRef = options.providerRef
		this.onConfigurationUpdate = options.onConfigurationUpdate
	}

	async updateApiConfiguration(newApiConfiguration: ProviderSettings): Promise<void> {
		const provider = this.providerRef.deref()
		if (!provider) {
			return
		}

		if (this.onConfigurationUpdate) {
			this.onConfigurationUpdate(newApiConfiguration)
		}

		if (!this.providerProfileChangeListener) {
			this.setupProviderProfileChangeListener(provider)
		}
	}

	setupProviderProfileChangeListener(provider: ClineProvider): void {
		if (typeof provider.on !== "function") {
			return
		}

		this.providerProfileChangeListener = async () => {
			try {
				const newState = await provider.getState()
				if (newState?.apiConfiguration) {
					await this.updateApiConfiguration(newState.apiConfiguration)
				}
			} catch (error) {
				console.error(
					`[ConfigurationManager#${this.taskId}] Failed to update API configuration on profile change:`,
					error,
				)
			}
		}

		provider.on(RooCodeEventName.ProviderProfileChanged, this.providerProfileChangeListener)
	}

	getCurrentProfileId(state: any): string {
		return (
			state?.listApiConfigMeta?.find((profile: any) => profile.name === state?.currentApiConfigName)?.id ??
			"default"
		)
	}

	dispose(): void {
		const provider = this.providerRef.deref()
		if (provider && this.providerProfileChangeListener) {
			provider.off(RooCodeEventName.ProviderProfileChanged, this.providerProfileChangeListener)
		}
	}
}
