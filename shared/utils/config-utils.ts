import { SECRET_STATE_KEYS, ProviderSettings } from "@shared/types"

export function checkExistKey(config: ProviderSettings | undefined) {
	if (!config) {
		return false
	}

	if (
		config.apiProvider &&
		["human-relay", "claude-code", "qwen-code"].includes(config.apiProvider)
	) {
		return true
	}

	const hasSecretKey = SECRET_STATE_KEYS.some((key) => config[key as keyof ProviderSettings] !== undefined)
	return hasSecretKey
}
