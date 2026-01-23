export type EmbedderProvider =
	| "openai"
	| "openai-compatible"
	| "gemini"

export interface EmbeddingModelProfile {
	dimension: number
	scoreThreshold?: number
	queryPrefix?: string
}

export type EmbeddingModelProfiles = {
	[provider in EmbedderProvider]?: {
		[modelId: string]: EmbeddingModelProfile
	}
}

export const EMBEDDING_MODEL_PROFILES: EmbeddingModelProfiles = {
	openai: {
		"text-embedding-3-small": { dimension: 1536, scoreThreshold: 0.4 },
		"text-embedding-3-large": { dimension: 3072, scoreThreshold: 0.4 },
		"text-embedding-ada-002": { dimension: 1536, scoreThreshold: 0.4 },
	},
	"openai-compatible": {
		"text-embedding-3-small": { dimension: 1536, scoreThreshold: 0.4 },
		"text-embedding-3-large": { dimension: 3072, scoreThreshold: 0.4 },
		"text-embedding-ada-002": { dimension: 1536, scoreThreshold: 0.4 },
		"nomic-embed-code": {
			dimension: 3584,
			scoreThreshold: 0.15,
			queryPrefix: "Represent this query for searching relevant code: ",
		},
	},
	gemini: {
		"text-embedding-004": { dimension: 768 },
		"gemini-embedding-001": { dimension: 3072, scoreThreshold: 0.4 },
	},
}

export function getModelDimension(provider: EmbedderProvider, modelId: string): number | undefined {
	const providerProfiles = EMBEDDING_MODEL_PROFILES[provider]
	if (!providerProfiles) {
		console.warn(`Provider not found in profiles: ${provider}`)
		return undefined
	}

	const modelProfile = providerProfiles[modelId]
	if (!modelProfile) {
		return undefined
	}

	return modelProfile.dimension
}

export function getModelScoreThreshold(provider: EmbedderProvider, modelId: string): number | undefined {
	const providerProfiles = EMBEDDING_MODEL_PROFILES[provider]
	if (!providerProfiles) {
		return undefined
	}

	const modelProfile = providerProfiles[modelId]
	return modelProfile?.scoreThreshold
}

export function getModelQueryPrefix(provider: EmbedderProvider, modelId: string): string | undefined {
	const providerProfiles = EMBEDDING_MODEL_PROFILES[provider]
	if (!providerProfiles) {
		return undefined
	}

	const modelProfile = providerProfiles[modelId]
	return modelProfile?.queryPrefix
}

export function getDefaultModelId(provider: EmbedderProvider): string {
	switch (provider) {
		case "openai":
		case "openai-compatible":
			return "text-embedding-3-small"

		case "gemini":
			return "gemini-embedding-001"
	}
}
