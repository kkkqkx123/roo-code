import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Section } from "@src/components/settings/Section"
import { Slider } from "@src/components/ui/slider"
import type { CustomVectorStorageConfig } from "@shared/types"

interface VectorStorageAdvancedSettingsProps {
	config: CustomVectorStorageConfig
	onChange: (config: CustomVectorStorageConfig) => void
}

export const VectorStorageAdvancedSettings: React.FC<VectorStorageAdvancedSettingsProps> = ({ config, onChange }) => {
	const { t } = useAppTranslation()

	const updateConfig = (section: keyof CustomVectorStorageConfig, key: string, value: any) => {
		onChange({
			...config,
			[section]: {
				...config[section],
				[key]: value,
			},
		})
	}

	return (
		<Section>
			{config.hnsw && (
				<>
					<h3 className="text-base font-semibold mb-3">{t("settings:codeIndex.vectorStorage.hnswConfig")}</h3>

					<div className="flex flex-col gap-3 mb-4">
						<div className="flex flex-col gap-1">
							<label className="text-sm font-medium">
								{t("settings:codeIndex.vectorStorage.hnswM")}
							</label>
							<div className="flex items-center gap-2">
								<Slider
									min={2}
									max={128}
									step={2}
									value={[config.hnsw.m]}
									onValueChange={([value]) => updateConfig("hnsw", "m", value)}
									className="flex-1"
								/>
								<span className="w-10 text-right text-sm">{config.hnsw.m}</span>
							</div>
							<div className="text-xs text-vscode-descriptionForeground">
								{t("settings:codeIndex.vectorStorage.hnswMDescription")}
							</div>
						</div>

						<div className="flex flex-col gap-1">
							<label className="text-sm font-medium">
								{t("settings:codeIndex.vectorStorage.hnswEfConstruct")}
							</label>
							<div className="flex items-center gap-2">
								<Slider
									min={10}
									max={1000}
									step={10}
									value={[config.hnsw.ef_construct]}
									onValueChange={([value]) => updateConfig("hnsw", "ef_construct", value)}
									className="flex-1"
								/>
								<span className="w-10 text-right text-sm">{config.hnsw.ef_construct}</span>
							</div>
							<div className="text-xs text-vscode-descriptionForeground">
								{t("settings:codeIndex.vectorStorage.hnswEfConstructDescription")}
							</div>
						</div>

						<VSCodeCheckbox
							checked={config.hnsw.on_disk}
							onChange={(e: any) => updateConfig("hnsw", "on_disk", e.target.checked)}>
							<label className="text-sm font-medium">
								{t("settings:codeIndex.vectorStorage.hnswOnDisk")}
							</label>
						</VSCodeCheckbox>
					</div>
				</>
			)}

			<h3 className="text-base font-semibold mb-3">{t("settings:codeIndex.vectorStorage.vectorConfig")}</h3>

			<div className="flex flex-col gap-3">
				<VSCodeCheckbox
					checked={config.vectors.on_disk}
					onChange={(e: any) => updateConfig("vectors", "on_disk", e.target.checked)}>
					<label className="text-sm font-medium">
						{t("settings:codeIndex.vectorStorage.vectorsOnDisk")}
					</label>
				</VSCodeCheckbox>

				{config.vectors.quantization && (
					<VSCodeCheckbox
						checked={config.vectors.quantization.enabled}
						onChange={(e: any) => {
							const newConfig = { ...config }
							newConfig.vectors.quantization = {
								...newConfig.vectors.quantization,
								enabled: e.target.checked,
								type: newConfig.vectors.quantization?.type || "scalar",
							}
							onChange(newConfig)
						}}>
						<label className="text-sm font-medium">
							{t("settings:codeIndex.vectorStorage.quantization")}
						</label>
					</VSCodeCheckbox>
				)}
			</div>
		</Section>
	)
}
