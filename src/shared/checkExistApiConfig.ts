import { SECRET_STATE_KEYS, GLOBAL_SECRET_KEYS, ProviderSettings } from "@roo-code/types"

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
	// Filter out keys that are not part of ProviderSettings (global secrets are stored separately)
	const providerSecretKeys = SECRET_STATE_KEYS.filter(
		(key): key is keyof ProviderSettings => !GLOBAL_SECRET_KEYS.includes(key as any)
	)
	const hasSecretKey = providerSecretKeys.some((key) => config[key] !== undefined)
	return hasSecretKey
}
