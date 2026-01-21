import { VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Section } from "@src/components/settings/Section"
import { Slider } from "@src/components/ui/slider"
import { VECTOR_STORAGE_PRESETS } from "@services/code-index/vector-storage-presets"
import type { VectorStorageConfig } from "@shared/types"

interface VectorStorageSettingsProps {
	config: VectorStorageConfig
	onChange: (config: VectorStorageConfig) => void
}

export const VectorStorageSettings: React.FC<VectorStorageSettingsProps> = ({ config, onChange }) => {
	const { t } = useAppTranslation()

	const handleModeChange = (mode: "auto" | "preset" | "custom") => {
		const newConfig: VectorStorageConfig = { ...config, mode }

		if (mode === "preset") {
			newConfig.preset = config.preset || "medium"
			newConfig.customConfig = VECTOR_STORAGE_PRESETS[newConfig.preset].customConfig
		} else if (mode === "auto") {
			newConfig.preset = undefined
			newConfig.customConfig = undefined
		}

		onChange(newConfig)
	}

	const handlePresetChange = (preset: "tiny" | "small" | "medium" | "large") => {
		onChange({
			...config,
			preset,
			customConfig: VECTOR_STORAGE_PRESETS[preset].customConfig,
		})
	}

	const handleThresholdChange = (thresholdType: "tiny" | "small" | "medium" | "large", value: number) => {
		onChange({
			...config,
			thresholds: {
				tiny: config.thresholds?.tiny ?? 2000,
				small: config.thresholds?.small ?? 10000,
				medium: config.thresholds?.medium ?? 100000,
				large: config.thresholds?.large ?? 1000000,
				[thresholdType]: value,
			},
		})
	}

	return (
		<Section>
			<div className="flex flex-col gap-2">
				<label className="block font-medium">{t("settings:codeIndex.vectorStorage.mode")}</label>
				<div className="text-sm text-vscode-descriptionForeground mb-2">
					{t("settings:codeIndex.vectorStorage.modeDescription")}
				</div>
				<VSCodeDropdown
					value={config.mode}
					onChange={(e: any) => handleModeChange(e.target.value)}
					className="w-full">
					<VSCodeOption value="auto">{t("settings:codeIndex.vectorStorage.modes.auto")}</VSCodeOption>
					<VSCodeOption value="preset">{t("settings:codeIndex.vectorStorage.modes.preset")}</VSCodeOption>
					<VSCodeOption value="custom">{t("settings:codeIndex.vectorStorage.modes.custom")}</VSCodeOption>
				</VSCodeDropdown>
			</div>

			{config.mode === "preset" && (
				<div className="flex flex-col gap-2">
					<label className="block font-medium">{t("settings:codeIndex.vectorStorage.preset")}</label>
					<div className="text-sm text-vscode-descriptionForeground mb-2">
						{t("settings:codeIndex.vectorStorage.presetDescription")}
					</div>
					<VSCodeDropdown
						value={config.preset || "medium"}
						onChange={(e: any) => handlePresetChange(e.target.value)}
						className="w-full">
						<VSCodeOption value="tiny">
							{t("settings:codeIndex.vectorStorage.presets.tiny")}
						</VSCodeOption>
						<VSCodeOption value="small">
							{t("settings:codeIndex.vectorStorage.presets.small")}
						</VSCodeOption>
						<VSCodeOption value="medium">
							{t("settings:codeIndex.vectorStorage.presets.medium")}
						</VSCodeOption>
						<VSCodeOption value="large">
							{t("settings:codeIndex.vectorStorage.presets.large")}
						</VSCodeOption>
					</VSCodeDropdown>
				</div>
			)}

			{config.mode === "auto" && (
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<label className="block font-medium">
							{t("settings:codeIndex.vectorStorage.thresholds.tiny")}
						</label>
						<div className="flex items-center gap-2">
							<Slider
								min={500}
								max={5000}
								step={100}
								value={[config.thresholds?.tiny || 2000]}
								onValueChange={([value]) => handleThresholdChange("tiny", value)}
								className="flex-1"
							/>
							<span className="w-16 text-right">{config.thresholds?.tiny || 2000}</span>
						</div>
						<div className="text-sm text-vscode-descriptionForeground">
							{t("settings:codeIndex.vectorStorage.thresholds.tinyDescription")}
						</div>
					</div>

					<div className="flex flex-col gap-2">
						<label className="block font-medium">
							{t("settings:codeIndex.vectorStorage.thresholds.small")}
						</label>
						<div className="flex items-center gap-2">
							<Slider
								min={1000}
								max={50000}
								step={1000}
								value={[config.thresholds?.small || 10000]}
								onValueChange={([value]) => handleThresholdChange("small", value)}
								className="flex-1"
							/>
							<span className="w-16 text-right">{config.thresholds?.small || 10000}</span>
						</div>
						<div className="text-sm text-vscode-descriptionForeground">
							{t("settings:codeIndex.vectorStorage.thresholds.smallDescription")}
						</div>
					</div>

					<div className="flex flex-col gap-2">
						<label className="block font-medium">
							{t("settings:codeIndex.vectorStorage.thresholds.medium")}
						</label>
						<div className="flex items-center gap-2">
							<Slider
								min={20000}
								max={200000}
								step={5000}
								value={[config.thresholds?.medium || 100000]}
								onValueChange={([value]) => handleThresholdChange("medium", value)}
								className="flex-1"
							/>
							<span className="w-16 text-right">{config.thresholds?.medium || 100000}</span>
						</div>
						<div className="text-sm text-vscode-descriptionForeground">
							{t("settings:codeIndex.vectorStorage.thresholds.mediumDescription")}
						</div>
					</div>
				</div>
			)}
		</Section>
	)
}
