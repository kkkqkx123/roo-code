import React, { useMemo } from "react"
import { VSCodeCheckbox, VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react"
import { IMAGE_GENERATION_MODELS, type ImageGenerationProvider, getImageGenerationProvider } from "@roo-code/types"
import { useAppTranslation } from "@/i18n/TranslationContext"

interface ImageGenerationSettingsProps {
	enabled: boolean
	onChange: (enabled: boolean) => void
	imageGenerationProvider?: ImageGenerationProvider
	setImageGenerationProvider: (provider: ImageGenerationProvider) => void
	setImageGenerationSelectedModel: (model: string) => void
}

export const ImageGenerationSettings = ({
	enabled,
	onChange,
	imageGenerationProvider,
	setImageGenerationProvider,
	setImageGenerationSelectedModel,
}: ImageGenerationSettingsProps) => {
	const { t } = useAppTranslation()

	const currentProvider = getImageGenerationProvider(imageGenerationProvider, false)

	const availableModels = useMemo(() => {
		return IMAGE_GENERATION_MODELS.filter((model) => model.provider === currentProvider)
	}, [currentProvider])

	const currentModel = availableModels[0]?.value || IMAGE_GENERATION_MODELS[0].value

	const _handleProviderChange = (value: string) => {
		const newProvider = value as ImageGenerationProvider
		setImageGenerationProvider(newProvider)

		const providerModels = IMAGE_GENERATION_MODELS.filter((m) => m.provider === newProvider)
		if (providerModels.length > 0) {
			setImageGenerationSelectedModel(providerModels[0].value)
		}
	}

	const handleModelChange = (value: string) => {
		setImageGenerationSelectedModel(value)
	}

	return (
		<div className="space-y-4">
			<div>
				<div className="flex items-center gap-2">
					<VSCodeCheckbox checked={enabled} onChange={(e: any) => onChange(e.target.checked)}>
						<span className="font-medium">{t("settings:experimental.IMAGE_GENERATION.name")}</span>
					</VSCodeCheckbox>
				</div>
				<p className="text-vscode-descriptionForeground text-sm mt-0">
					{t("settings:experimental.IMAGE_GENERATION.description")}
				</p>
			</div>

			{enabled && (
				<div className="ml-2 space-y-3">
					{/* Model Selection */}
					<div>
						<label className="block font-medium mb-1">
							{t("settings:experimental.IMAGE_GENERATION.modelSelectionLabel")}
						</label>
						<VSCodeDropdown
							value={currentModel}
							onChange={(e: any) => handleModelChange(e.target.value)}
							className="w-full">
							{availableModels.map((model) => (
								<VSCodeOption key={model.value} value={model.value} className="py-2 px-3">
									{model.label}
								</VSCodeOption>
							))}
						</VSCodeDropdown>
						<p className="text-vscode-descriptionForeground text-xs mt-1">
							{t("settings:experimental.IMAGE_GENERATION.modelSelectionDescription")}
						</p>
					</div>
				</div>
			)}
		</div>
	)
}
