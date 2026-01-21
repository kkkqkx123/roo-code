import React, { memo, useCallback, useEffect, useMemo, useState } from "react"
import { convertHeadersToObject } from "./utils/headers"
import { useDebounce } from "react-use"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"

import {
	type ProviderName,
	type ProviderSettings,
	openAiNativeDefaultModelId,
	anthropicDefaultModelId,
	claudeCodeDefaultModelId,
	qwenCodeDefaultModelId,
	geminiDefaultModelId,
	type ToolProtocol,
} from "@shared/types"
import { DEFAULT_CONSECUTIVE_MISTAKE_LIMIT } from "@core/constants/default-values"
import { TOOL_PROTOCOL } from "@core/tools/tool-utils"

import { vscode } from "@src/utils/vscode"
import { validateApiConfiguration } from "@src/utils/validate"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useSelectedModel } from "@src/components/ui/hooks/useSelectedModel"
import { useExtensionState } from "@src/context/ExtensionStateContext"

import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem,
	SearchableSelect,
	Collapsible,
	CollapsibleTrigger,
	CollapsibleContent,
} from "@src/components/ui"

import {
	Anthropic,
	ClaudeCode,
	Gemini,
	OpenAI,
	OpenAICompatible,
	QwenCode,
} from "./providers"

import { MODELS_BY_PROVIDER, PROVIDERS } from "./constants"
import { inputEventTransform, noTransform } from "./transforms"
import { ModelInfoView } from "./ModelInfoView"
import { ApiErrorMessage } from "./ApiErrorMessage"
import { ThinkingBudget } from "./ThinkingBudget"
import { Verbosity } from "./Verbosity"
import { DiffSettingsControl } from "./DiffSettingsControl"
import { TodoListSettingsControl } from "./TodoListSettingsControl"
import { TemperatureControl } from "./TemperatureControl"
import { RateLimitSecondsControl } from "./RateLimitSecondsControl"
import { ConsecutiveMistakeLimitControl } from "./ConsecutiveMistakeLimitControl"
import { buildDocLink } from "@src/utils/docLinks"
import { BookOpenText } from "lucide-react"

export interface ApiOptionsProps {
	uriScheme: string | undefined
	apiConfiguration: ProviderSettings
	setApiConfigurationField: <K extends keyof ProviderSettings>(
		field: K,
		value: ProviderSettings[K],
		isUserAction?: boolean,
	) => void
	fromWelcomeView?: boolean
	errorMessage: string | undefined
	setErrorMessage: React.Dispatch<React.SetStateAction<string | undefined>>
}

const ApiOptions = ({
	uriScheme: _uriScheme,
	apiConfiguration,
	setApiConfigurationField,
	fromWelcomeView,
	errorMessage,
	setErrorMessage,
}: ApiOptionsProps) => {
	const { t } = useAppTranslation()
	const { claudeCodeIsAuthenticated } = useExtensionState()

	const [customHeaders, setCustomHeaders] = useState<[string, string][]>(() => {
		const headers = apiConfiguration?.openAiHeaders || {}
		return Object.entries(headers)
	})

	useEffect(() => {
		const propHeaders = apiConfiguration?.openAiHeaders || {}

		if (JSON.stringify(customHeaders) !== JSON.stringify(Object.entries(propHeaders))) {
			setCustomHeaders(Object.entries(propHeaders))
		}
	}, [apiConfiguration?.openAiHeaders, customHeaders])

	// Helper to convert array of tuples to object (filtering out empty keys).

	// Debounced effect to update the main configuration when local
	// customHeaders state stabilizes.
	useDebounce(
		() => {
			const currentConfigHeaders = apiConfiguration?.openAiHeaders || {}
			const newHeadersObject = convertHeadersToObject(customHeaders)

			// Only update if the processed object is different from the current config.
			if (JSON.stringify(currentConfigHeaders) !== JSON.stringify(newHeadersObject)) {
				setApiConfigurationField("openAiHeaders", newHeadersObject)
			}
		},
		300,
		[customHeaders, apiConfiguration?.openAiHeaders, setApiConfigurationField],
	)

	const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
	const [isAdvancedSettingsOpen, setIsAdvancedSettingsOpen] = useState(false)

	const handleInputChange = useCallback(
		<K extends keyof ProviderSettings, E>(
			field: K,
			transform: (event: E) => ProviderSettings[K] = inputEventTransform,
		) =>
			(event: E | Event) => {
				setApiConfigurationField(field, transform(event as E))
			},
		[setApiConfigurationField],
	)

	const {
		provider: selectedProvider,
		id: selectedModelId,
		info: selectedModelInfo,
	} = useSelectedModel(apiConfiguration)

	// Update `apiModelId` whenever `selectedModelId` changes.
	useEffect(() => {
		if (selectedModelId && apiConfiguration.apiModelId !== selectedModelId) {
			// Pass false as third parameter to indicate this is not a user action
			// This is an internal sync, not a user-initiated change
			setApiConfigurationField("apiModelId", selectedModelId, false)
		}
	}, [selectedModelId, setApiConfigurationField, apiConfiguration.apiModelId])

	// Debounced refresh model updates, only executed 250ms after the user
	// stops typing.
	useDebounce(
		() => {
			if (selectedProvider === "openai") {
				// Use our custom headers state to build the headers object.
				const headerObject = convertHeadersToObject(customHeaders)

				vscode.postMessage({
					type: "requestOpenAiModels",
					values: {
						baseUrl: apiConfiguration?.openAiBaseUrl,
						apiKey: apiConfiguration?.openAiApiKey,
						customHeaders: {}, // Reserved for any additional headers.
						openAiHeaders: headerObject,
					},
				})
			}
		},
		250,
		[
			selectedProvider,
			apiConfiguration?.openAiBaseUrl,
			apiConfiguration?.openAiApiKey,
			customHeaders,
		],
	)

	useEffect(() => {
		const apiValidationResult = validateApiConfiguration(apiConfiguration)
		setErrorMessage(apiValidationResult)
	}, [apiConfiguration, setErrorMessage])

	const selectedProviderModels = useMemo(() => {
		const models = MODELS_BY_PROVIDER[selectedProvider]

		if (!models) return []

		// Include the currently selected model even if deprecated (so users can see what they have selected)
		// But filter out other deprecated models from being newly selectable
		const availableModels = Object.entries(models)
			.filter(([modelId, modelInfo]) => {
				// Always include the currently selected model
				if (modelId === selectedModelId) return true
				// Filter out deprecated models that aren't currently selected
				return !modelInfo.deprecated
			})
			.map(([modelId]) => ({
				value: modelId,
				label: modelId,
			}))

		return availableModels
	}, [selectedProvider, selectedModelId])

	const onProviderChange = useCallback(
		(value: ProviderName) => {
			setApiConfigurationField("apiProvider", value)

			// It would be much easier to have a single attribute that stores
			// the modelId, but we have a separate attribute for each of
			// OpenRouter, Unbound, and Requesty.
			// If you switch to one of these providers and the corresponding
			// modelId is not set then you immediately end up in an error state.
			// To address that we set the modelId to the default value for th
			// provider if it's not already set.
			const validateAndResetModel = (
				modelId: string | undefined,
				field: keyof ProviderSettings,
				defaultValue?: string,
			) => {
				// in case we haven't set a default value for a provider
				if (!defaultValue) return

				// only set default if no model is set, but don't reset invalid models
				// let users see and decide what to do with invalid model selections
				const shouldSetDefault = !modelId

				if (shouldSetDefault) {
					setApiConfigurationField(field, defaultValue, false)
				}
			}

			// Define a mapping object that associates each provider with its model configuration
			const PROVIDER_MODEL_CONFIG: Partial<
				Record<
					ProviderName,
					{
						field: keyof ProviderSettings
						default?: string
					}
				>
			> = {
				anthropic: { field: "apiModelId", default: anthropicDefaultModelId },
				"claude-code": { field: "apiModelId", default: claudeCodeDefaultModelId },
				"qwen-code": { field: "apiModelId", default: qwenCodeDefaultModelId },
				"openai-native": { field: "apiModelId", default: openAiNativeDefaultModelId },
				gemini: { field: "apiModelId", default: geminiDefaultModelId },
				openai: { field: "openAiModelId" },
			}

			const config = PROVIDER_MODEL_CONFIG[value]
			if (config) {
				validateAndResetModel(
					apiConfiguration[config.field] as string | undefined,
					config.field,
					config.default,
				)
			}
		},
		[setApiConfigurationField, apiConfiguration],
	)

	const docs = useMemo(() => {
		const provider = PROVIDERS.find(({ value }) => value === selectedProvider)
		const name = provider?.label

		if (!name) {
			return undefined
		}

		// Get the URL slug - use custom mapping if available, otherwise use the provider key.
		const slugs: Record<string, string> = {
			"openai-native": "openai",
			openai: "openai-compatible",
		}

		const slug = slugs[selectedProvider] || selectedProvider
		return {
			url: buildDocLink(`providers/${slug}`, "provider_docs"),
			name,
		}
	}, [selectedProvider])

	// Calculate the default protocol that would be used if toolProtocol is not set
	// Mirrors the simplified logic in resolveToolProtocol.ts:
	// 1. User preference (toolProtocol) - handled by the select value binding
	// 2. Model default - use if available
	// 3. Native fallback
	const defaultProtocol = selectedModelInfo?.defaultToolProtocol || TOOL_PROTOCOL.NATIVE

	// Show the tool protocol selector when model supports native tools.
	// For OpenAI Compatible providers we always show it so users can force XML/native explicitly.
	const showToolProtocolSelector = selectedProvider === "openai" || selectedModelInfo?.supportsNativeTools === true

	// Convert providers to SearchableSelect options
	const providerOptions = useMemo(() => {
		// Filter out static providers that have no models (unless currently selected)
		const providersWithModels = PROVIDERS.filter(({ value }) => {
			// Always show the currently selected provider to avoid breaking existing configurations
			// Use apiConfiguration.apiProvider directly since that's what's actually selected
			if (value === apiConfiguration.apiProvider) {
				return true
			}

			// Check if this is a static provider (has models in MODELS_BY_PROVIDER)
			const staticModels = MODELS_BY_PROVIDER[value as ProviderName]

			// If it's a static provider, check if it has any models
			if (staticModels) {
				// Hide the provider if it has no models
				return Object.keys(staticModels).length > 0
			}

			// If it's a dynamic provider (not in MODELS_BY_PROVIDER), always show it
			// to avoid race conditions with async model fetching
			return true
		})

		const options = providersWithModels.map(({ value, label }) => ({
			value,
			label,
		}))

		// Pin "roo" to the top if not on welcome screen
		if (!fromWelcomeView) {
			const rooIndex = options.findIndex((opt) => opt.value === "roo")
			if (rooIndex > 0) {
				const [rooOption] = options.splice(rooIndex, 1)
				options.unshift(rooOption)
			}
		}

		return options
	}, [apiConfiguration.apiProvider, fromWelcomeView])

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-col gap-1 relative">
				<div className="flex justify-between items-center">
					<label className="block font-medium">{t("settings:providers.apiProvider")}</label>
					{docs && (
						<VSCodeLink href={docs.url} target="_blank" className="flex gap-2">
							{docs.name}
							<BookOpenText className="size-4 inline ml-2" />
						</VSCodeLink>
					)}
				</div>
				<SearchableSelect
					value={selectedProvider}
					onValueChange={(value) => onProviderChange(value as ProviderName)}
					options={providerOptions}
					placeholder={t("settings:common.select")}
					searchPlaceholder={t("settings:providers.searchProviderPlaceholder")}
					emptyMessage={t("settings:providers.noProviderMatchFound")}
					className="w-full"
					data-testid="provider-select"
				/>
			</div>

			{errorMessage && <ApiErrorMessage errorMessage={errorMessage} />}

			{selectedProvider === "anthropic" && (
				<Anthropic
					apiConfiguration={apiConfiguration}
					setApiConfigurationField={setApiConfigurationField}
					simplifySettings={fromWelcomeView}
				/>
			)}

			{selectedProvider === "claude-code" && (
				<ClaudeCode
					apiConfiguration={apiConfiguration}
					setApiConfigurationField={setApiConfigurationField}
					simplifySettings={fromWelcomeView}
					claudeCodeIsAuthenticated={claudeCodeIsAuthenticated}
				/>
			)}

			{selectedProvider === "openai-native" && (
				<OpenAI
					apiConfiguration={apiConfiguration}
					setApiConfigurationField={setApiConfigurationField}
					selectedModelInfo={selectedModelInfo}
					simplifySettings={fromWelcomeView}
				/>
			)}

			{selectedProvider === "gemini" && (
				<Gemini
					apiConfiguration={apiConfiguration}
					setApiConfigurationField={setApiConfigurationField}
					simplifySettings={fromWelcomeView}
				/>
			)}

			{selectedProvider === "openai" && (
				<OpenAICompatible
					apiConfiguration={apiConfiguration}
					setApiConfigurationField={setApiConfigurationField}
					simplifySettings={fromWelcomeView}
				/>
			)}

			{selectedProvider === "qwen-code" && (
				<QwenCode
					apiConfiguration={apiConfiguration}
					setApiConfigurationField={setApiConfigurationField}
					simplifySettings={fromWelcomeView}
				/>
			)}

			{selectedProvider === "human-relay" && (
				<>
					<div className="text-sm text-vscode-descriptionForeground">
						{t("settings:providers.humanRelay.description")}
					</div>
					<div className="text-sm text-vscode-descriptionForeground">
						{t("settings:providers.humanRelay.instructions")}
					</div>
				</>
			)}

			{/* Skip generic model picker for claude-code since it has its own in ClaudeCode.tsx */}
			{selectedProviderModels.length > 0 && selectedProvider !== "claude-code" && (
				<>
					<div>
						<label className="block font-medium mb-1">{t("settings:providers.model")}</label>
						<Select
							value={selectedModelId === "custom-arn" ? "custom-arn" : selectedModelId}
							onValueChange={(value) => {
								setApiConfigurationField("apiModelId", value)

								// Clear reasoning effort when switching models to allow the new model's default to take effect
								// This is especially important for GPT-5 models which default to "medium"
								if (selectedProvider === "openai-native") {
									setApiConfigurationField("reasoningEffort", undefined)
								}
							}}>
							<SelectTrigger className="w-full">
								<SelectValue placeholder={t("settings:common.select")} />
							</SelectTrigger>
							<SelectContent>
								{selectedProviderModels.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Show error if a deprecated model is selected */}
					{selectedModelInfo?.deprecated && (
						<ApiErrorMessage errorMessage={t("settings:validation.modelDeprecated")} />
					)}

					{/* Only show model info if not deprecated */}
					{!selectedModelInfo?.deprecated && (
						<ModelInfoView
							apiProvider={selectedProvider}
							selectedModelId={selectedModelId}
							modelInfo={selectedModelInfo}
							isDescriptionExpanded={isDescriptionExpanded}
							setIsDescriptionExpanded={setIsDescriptionExpanded}
						/>
					)}
				</>
			)}

			{!fromWelcomeView && (
				<ThinkingBudget
					key={`${selectedProvider}-${selectedModelId}`}
					apiConfiguration={apiConfiguration}
					setApiConfigurationField={setApiConfigurationField}
					modelInfo={selectedModelInfo}
				/>
			)}

			{/* Gate Verbosity UI by capability flag */}
			{!fromWelcomeView && selectedModelInfo?.supportsVerbosity && (
				<Verbosity
					apiConfiguration={apiConfiguration}
					setApiConfigurationField={setApiConfigurationField}
					modelInfo={selectedModelInfo}
				/>
			)}

			{!fromWelcomeView && (
				<Collapsible open={isAdvancedSettingsOpen} onOpenChange={setIsAdvancedSettingsOpen}>
					<CollapsibleTrigger className="flex items-center gap-1 w-full cursor-pointer hover:opacity-80 mb-2">
						<span className={`codicon codicon-chevron-${isAdvancedSettingsOpen ? "down" : "right"}`}></span>
						<span className="font-medium">{t("settings:advancedSettings.title")}</span>
					</CollapsibleTrigger>
					<CollapsibleContent className="space-y-3">
						<TodoListSettingsControl
							todoListEnabled={apiConfiguration.todoListEnabled}
							onChange={(field, value) => setApiConfigurationField(field, value)}
						/>
						<DiffSettingsControl
							diffEnabled={apiConfiguration.diffEnabled}
							fuzzyMatchThreshold={apiConfiguration.fuzzyMatchThreshold}
							onChange={(field, value) => setApiConfigurationField(field, value)}
						/>
						{selectedModelInfo?.supportsTemperature !== false && (
							<TemperatureControl
								value={apiConfiguration.modelTemperature}
								onChange={handleInputChange("modelTemperature", noTransform)}
								maxValue={2}
								defaultValue={selectedModelInfo?.defaultTemperature}
							/>
						)}
						<RateLimitSecondsControl
							value={apiConfiguration.rateLimitSeconds || 0}
							onChange={(value) => setApiConfigurationField("rateLimitSeconds", value)}
						/>
						<ConsecutiveMistakeLimitControl
							value={
								apiConfiguration.consecutiveMistakeLimit !== undefined
									? apiConfiguration.consecutiveMistakeLimit
									: DEFAULT_CONSECUTIVE_MISTAKE_LIMIT
							}
							onChange={(value) => setApiConfigurationField("consecutiveMistakeLimit", value)}
						/>
						{showToolProtocolSelector && (
							<div>
								<label className="block font-medium mb-1">{t("settings:toolProtocol.label")}</label>
								<Select
									value={apiConfiguration.toolProtocol || "default"}
									onValueChange={(value) => {
										const newValue = value === "default" ? undefined : (value as ToolProtocol)
										setApiConfigurationField("toolProtocol", newValue)
									}}>
									<SelectTrigger className="w-full">
										<SelectValue placeholder={t("settings:common.select")} />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="default">
											{t("settings:toolProtocol.default")} (
											{defaultProtocol === TOOL_PROTOCOL.NATIVE
												? t("settings:toolProtocol.native")
												: t("settings:toolProtocol.xml")}
											)
										</SelectItem>
										<SelectItem value={TOOL_PROTOCOL.XML}>
											{t("settings:toolProtocol.xml")}
										</SelectItem>
										<SelectItem value={TOOL_PROTOCOL.NATIVE}>
											{t("settings:toolProtocol.native")}
										</SelectItem>
									</SelectContent>
								</Select>
								<div className="text-sm text-vscode-descriptionForeground mt-1">
									{t("settings:toolProtocol.description")}
								</div>
							</div>
						)}
					</CollapsibleContent>
				</Collapsible>
			)}
		</div>
	)
}

export default memo(ApiOptions)
