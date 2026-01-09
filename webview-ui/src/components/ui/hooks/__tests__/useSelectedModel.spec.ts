// npx vitest src/components/ui/hooks/__tests__/useSelectedModel.spec.ts

import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook } from "@testing-library/react"

import { ProviderSettings, ModelInfo, openAiModelInfoSaneDefaults } from "@roo-code/types"

import { useSelectedModel } from "../useSelectedModel"

const createWrapper = () => {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	})
	return ({ children }: { children: React.ReactNode }) =>
		React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe("useSelectedModel", () => {
	describe("default behavior", () => {
		it("should return anthropic default when no configuration is provided", () => {
			const wrapper = createWrapper()
			const { result } = renderHook(() => useSelectedModel(), { wrapper })

			expect(result.current.provider).toBe("anthropic")
			expect(result.current.id).toBe("claude-sonnet-4-5")
			expect(result.current.info).toBeDefined()
			expect(result.current.info?.supportsImages).toBe(true)
			expect(result.current.info?.supportsNativeTools).toBe(true)
			expect(result.current.info?.supportsPromptCache).toBe(true)
		})
	})

	describe("claude-code provider", () => {
		it("should return claude-code model with correct model info", () => {
			const apiConfiguration: ProviderSettings = {
				apiProvider: "claude-code",
				apiModelId: "claude-sonnet-4-5",
			}

			const wrapper = createWrapper()
			const { result } = renderHook(() => useSelectedModel(apiConfiguration), { wrapper })

			expect(result.current.provider).toBe("claude-code")
			expect(result.current.id).toBe("claude-sonnet-4-5")
			expect(result.current.info).toBeDefined()
			expect(result.current.info?.supportsImages).toBe(true)
			expect(result.current.info?.supportsPromptCache).toBe(true)
			expect(result.current.info?.maxTokens).toBe(32768)
			expect(result.current.info?.contextWindow).toBe(200_000)
		})

		it("should use default claude-code model when no modelId is specified", () => {
			const apiConfiguration: ProviderSettings = {
				apiProvider: "claude-code",
			}

			const wrapper = createWrapper()
			const { result } = renderHook(() => useSelectedModel(apiConfiguration), { wrapper })

			expect(result.current.provider).toBe("claude-code")
			expect(result.current.id).toBe("claude-sonnet-4-5")
			expect(result.current.info).toBeDefined()
			expect(result.current.info?.supportsImages).toBe(true)
		})
	})

	describe("openai provider", () => {
		it("should use openAiModelInfoSaneDefaults when no custom model info is provided", () => {
			const apiConfiguration: ProviderSettings = {
				apiProvider: "openai",
				openAiModelId: "gpt-4o",
			}

			const wrapper = createWrapper()
			const { result } = renderHook(() => useSelectedModel(apiConfiguration), { wrapper })

			expect(result.current.provider).toBe("openai")
			expect(result.current.id).toBe("gpt-4o")
			expect(result.current.info).toEqual(openAiModelInfoSaneDefaults)
			expect(result.current.info?.supportsNativeTools).toBe(true)
			expect(result.current.info?.defaultToolProtocol).toBe("native")
		})

		it("should merge native tool defaults with custom model info", () => {
			const customModelInfo: ModelInfo = {
				maxTokens: 16384,
				contextWindow: 128000,
				supportsImages: true,
				supportsPromptCache: false,
				inputPrice: 0.01,
				outputPrice: 0.03,
				description: "Custom OpenAI-compatible model",
			}

			const apiConfiguration: ProviderSettings = {
				apiProvider: "openai",
				openAiModelId: "custom-model",
				openAiCustomModelInfo: customModelInfo,
			}

			const wrapper = createWrapper()
			const { result } = renderHook(() => useSelectedModel(apiConfiguration), { wrapper })

			expect(result.current.provider).toBe("openai")
			expect(result.current.id).toBe("custom-model")
			// Should merge native tool defaults with custom model info
			const nativeToolDefaults = {
				supportsNativeTools: openAiModelInfoSaneDefaults.supportsNativeTools,
				defaultToolProtocol: openAiModelInfoSaneDefaults.defaultToolProtocol,
			}
			expect(result.current.info).toEqual({ ...nativeToolDefaults, ...customModelInfo })
			expect(result.current.info?.supportsNativeTools).toBe(true)
			expect(result.current.info?.defaultToolProtocol).toBe("native")
		})

		it("should allow custom model info to override native tool defaults", () => {
			const customModelInfo: ModelInfo = {
				maxTokens: 8192,
				contextWindow: 32000,
				supportsImages: false,
				supportsPromptCache: false,
				supportsNativeTools: false, // Explicitly disable
				defaultToolProtocol: "xml", // Override default to use XML instead of native
			}

			const apiConfiguration: ProviderSettings = {
				apiProvider: "openai",
				openAiModelId: "custom-model-no-tools",
				openAiCustomModelInfo: customModelInfo,
			}

			const wrapper = createWrapper()
			const { result } = renderHook(() => useSelectedModel(apiConfiguration), { wrapper })

			expect(result.current.provider).toBe("openai")
			expect(result.current.id).toBe("custom-model-no-tools")
			// Custom model info should override the native tool defaults
			expect(result.current.info?.supportsNativeTools).toBe(false)
			expect(result.current.info?.defaultToolProtocol).toBe("xml")
		})
	})
})
