import { SECRET_STATE_KEYS, ProviderSettings } from "@shared/types"

export function checkExistKey(config: ProviderSettings | undefined) {
	if (!config) {
		return false
	}

	// Special case for human-relay, fake-ai, claude-code, qwen-code, and roo providers which don't need any configuration.
	if (
		config.apiProvider &&
		["human-relay", "claude-code", "qwen-code"].includes(config.apiProvider)
	) {
		return true
	}

	// Check all secret keys from the centralized SECRET_STATE_KEYS array.
	const hasSecretKey = SECRET_STATE_KEYS.some((key) => config[key as keyof ProviderSettings] !== undefined)
	return hasSecretKey
}
