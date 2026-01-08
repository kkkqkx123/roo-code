import i18next from "i18next"

import { type ProviderSettings } from "@roo-code/types"

export function validateApiConfiguration(apiConfiguration: ProviderSettings): string | undefined {
	const keysAndIdsPresentErrorMessage = validateModelsAndKeysProvided(apiConfiguration)

	if (keysAndIdsPresentErrorMessage) {
		return keysAndIdsPresentErrorMessage
	}

	return undefined
}

function validateModelsAndKeysProvided(apiConfiguration: ProviderSettings): string | undefined {
	switch (apiConfiguration.apiProvider) {
		case "anthropic":
			if (!apiConfiguration.apiKey) {
				return i18next.t("settings:validation.apiKey")
			}
			break
		case "gemini":
			if (!apiConfiguration.geminiApiKey) {
				return i18next.t("settings:validation.apiKey")
			}
			break
		case "openai-native":
			if (!apiConfiguration.openAiNativeApiKey) {
				return i18next.t("settings:validation.apiKey")
			}
			break
		case "openai":
			if (!apiConfiguration.openAiBaseUrl || !apiConfiguration.openAiApiKey || !apiConfiguration.openAiModelId) {
				return i18next.t("settings:validation.openAi")
			}
			break
		case "qwen-code":
			if (!apiConfiguration.qwenCodeOauthPath) {
				return i18next.t("settings:validation.qwenCodeOauthPath")
			}
			break
		case "claude-code":
			break
		case "gemini-cli":
			break
		case "human-relay":
			break
	}

	return undefined
}

/**
 * Validates an Amazon Bedrock ARN and optionally checks if the region in
 * the ARN matches the provided region.
 *
 * Note: This function does not perform strict format validation on the ARN.
 * Users entering custom ARNs are advanced users who should be trusted to
 * provide valid ARNs without restriction. See issue #10108.
 *
 * @param arn The ARN string to validate
 * @param region Optional region to check against the ARN's region
 * @returns An object with validation results: { isValid, arnRegion, errorMessage }
 */
export function validateBedrockArn(arn: string, region?: string) {
	// Try to extract region from ARN for region mismatch warning.
	// This is a permissive regex that attempts to find the region component
	// without enforcing strict ARN format validation.
	const regionMatch = arn.match(/^arn:[^:]+:[^:]+:([^:]+):/)
	const arnRegion = regionMatch?.[1]

	// Check if region in ARN matches provided region (if specified).
	if (region && arnRegion && arnRegion !== region) {
		return {
			isValid: true,
			arnRegion,
			errorMessage: i18next.t("settings:validation.arn.regionMismatch", { arnRegion, region }),
		}
	}

	// ARN is always considered valid - trust the user to enter valid ARNs.
	return { isValid: true, arnRegion, errorMessage: undefined }
}
