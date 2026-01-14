import { HTMLAttributes, useState } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { GitBranch, Shield, Terminal } from "lucide-react"
import { Trans } from "react-i18next"
import { buildDocLink } from "@src/utils/docLinks"
import { Slider, Button, Input } from "@/components/ui"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import {
	DEFAULT_CHECKPOINT_TIMEOUT_SECONDS,
	MAX_CHECKPOINT_TIMEOUT_SECONDS,
	MIN_CHECKPOINT_TIMEOUT_SECONDS,
} from "@roo-code/types"

type CheckpointSettingsProps = HTMLAttributes<HTMLDivElement> & {
	enableCheckpoints?: boolean
	checkpointTimeout?: number
	checkpointBeforeHighRiskCommands?: boolean
	checkpointAfterHighRiskCommands?: boolean
	checkpointOnCommandError?: boolean
	checkpointCommands?: string[]
	noCheckpointCommands?: string[]
	setCachedStateField: SetCachedStateField<
		"enableCheckpoints" 
		| "checkpointTimeout"
		| "checkpointBeforeHighRiskCommands"
		| "checkpointAfterHighRiskCommands"
		| "checkpointOnCommandError"
		| "checkpointCommands"
		| "noCheckpointCommands"
	>
}

export const CheckpointSettings = ({
	enableCheckpoints,
	checkpointTimeout,
	checkpointBeforeHighRiskCommands,
	checkpointAfterHighRiskCommands,
	checkpointOnCommandError,
	checkpointCommands,
	noCheckpointCommands,
	setCachedStateField,
	...props
}: CheckpointSettingsProps) => {
	const { t } = useAppTranslation()
	const [checkpointCommandInput, setCheckpointCommandInput] = useState("")
	const [noCheckpointCommandInput, setNoCheckpointCommandInput] = useState("")

	const handleAddCheckpointCommand = () => {
		const currentCommands = checkpointCommands ?? []

		if (checkpointCommandInput && !currentCommands.includes(checkpointCommandInput)) {
			const newCommands = [...currentCommands, checkpointCommandInput]
			setCachedStateField("checkpointCommands", newCommands)
			setCheckpointCommandInput("")
		}
	}

	const handleAddNoCheckpointCommand = () => {
		const currentCommands = noCheckpointCommands ?? []

		if (noCheckpointCommandInput && !currentCommands.includes(noCheckpointCommandInput)) {
			const newCommands = [...currentCommands, noCheckpointCommandInput]
			setCachedStateField("noCheckpointCommands", newCommands)
			setNoCheckpointCommandInput("")
		}
	}

	return (
		<div {...props}>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<GitBranch className="w-4" />
					<div>{t("settings:sections.checkpoints")}</div>
				</div>
			</SectionHeader>

			<Section>
				<div className="space-y-4">
					{/* 基础检查点设置 */}
					<div>
						<VSCodeCheckbox
							checked={enableCheckpoints}
							onChange={(e: any) => {
								setCachedStateField("enableCheckpoints", e.target.checked)
							}}>
							<span className="font-medium">{t("settings:checkpoints.enable.label")}</span>
						</VSCodeCheckbox>
						<div className="text-vscode-descriptionForeground text-sm mt-1">
							<Trans i18nKey="settings:checkpoints.enable.description">
								<VSCodeLink
									href={buildDocLink("features/checkpoints", "settings_checkpoints")}
									style={{ display: "inline" }}>
									{" "}
								</VSCodeLink>
							</Trans>
						</div>
					</div>

					{enableCheckpoints && (
						<>
							{/* 超时设置 */}
							<div>
								<label className="block text-sm font-medium mb-2">
									{t("settings:checkpoints.timeout.label")}
								</label>
								<div className="flex items-center gap-2">
									<Slider
										min={MIN_CHECKPOINT_TIMEOUT_SECONDS}
										max={MAX_CHECKPOINT_TIMEOUT_SECONDS}
										step={1}
										defaultValue={[checkpointTimeout ?? DEFAULT_CHECKPOINT_TIMEOUT_SECONDS]}
										onValueChange={([value]) => {
											setCachedStateField("checkpointTimeout", value)
										}}
										className="flex-1"
										data-testid="checkpoint-timeout-slider"
									/>
									<span className="w-12 text-center">
										{checkpointTimeout ?? DEFAULT_CHECKPOINT_TIMEOUT_SECONDS}
									</span>
								</div>
								<div className="text-vscode-descriptionForeground text-sm mt-1">
									{t("settings:checkpoints.timeout.description")}
								</div>
							</div>

							{/* 终端命令检查点设置 */}
							<div className="pt-4 border-t border-vscode-panel-border">
								<div className="flex items-center gap-2 mb-4">
									<Terminal className="w-4 h-4" />
									<h3 className="font-medium">{t("settings:checkpoints.terminal.label")}</h3>
								</div>

								{/* 检查点触发策略 */}
								<div className="space-y-3">
									<div className="flex items-center gap-2">
										<Shield className="w-4 h-4" />
										<span className="font-medium">{t("settings:checkpoints.terminal.triggers")}</span>
									</div>

									<VSCodeCheckbox
										checked={checkpointBeforeHighRiskCommands}
										onChange={(e: any) => {
											setCachedStateField("checkpointBeforeHighRiskCommands", e.target.checked)
										}}>
										<span>{t("settings:checkpoints.terminal.beforeHighRisk")}</span>
									</VSCodeCheckbox>
									<div className="text-vscode-descriptionForeground text-sm ml-6">
										{t("settings:checkpoints.terminal.beforeHighRiskDescription")}
									</div>

									<VSCodeCheckbox
										checked={checkpointAfterHighRiskCommands}
										onChange={(e: any) => {
											setCachedStateField("checkpointAfterHighRiskCommands", e.target.checked)
										}}>
										<span>{t("settings:checkpoints.terminal.afterHighRisk")}</span>
									</VSCodeCheckbox>
									<div className="text-vscode-descriptionForeground text-sm ml-6">
										{t("settings:checkpoints.terminal.afterHighRiskDescription")}
									</div>

									<VSCodeCheckbox
										checked={checkpointOnCommandError}
										onChange={(e: any) => {
											setCachedStateField("checkpointOnCommandError", e.target.checked)
										}}>
										<span>{t("settings:checkpoints.terminal.onError")}</span>
									</VSCodeCheckbox>
									<div className="text-vscode-descriptionForeground text-sm ml-6">
										{t("settings:checkpoints.terminal.onErrorDescription")}
									</div>
								</div>

								{/* 命令级别配置 */}
								<div className="space-y-4 mt-6">
									{/* 需要检查点的命令 */}
									<div>
										<label className="block font-medium mb-2">
											{t("settings:checkpoints.terminal.requiredCommands")}
										</label>
										<div className="text-vscode-descriptionForeground text-sm mb-2">
											{t("settings:checkpoints.terminal.requiredCommandsDescription")}
										</div>
										<div className="flex gap-2">
											<Input
												value={checkpointCommandInput}
												onChange={(e: any) => setCheckpointCommandInput(e.target.value)}
												onKeyDown={(e: any) => {
													if (e.key === "Enter") {
														e.preventDefault()
														handleAddCheckpointCommand()
													}
												}}
												placeholder={t("settings:checkpoints.terminal.commandPlaceholder")}
												className="flex-1"
											/>
											<Button onClick={handleAddCheckpointCommand}>
												{t("settings:checkpoints.terminal.addButton")}
											</Button>
										</div>
										<div className="flex flex-wrap gap-2 mt-2">
											{(checkpointCommands ?? []).map((cmd, index) => (
												<Button
													key={index}
													variant="secondary"
													onClick={() => {
														const newCommands = (checkpointCommands ?? []).filter((_, i) => i !== index)
														setCachedStateField("checkpointCommands", newCommands)
													}}>
													{cmd}
												</Button>
											))}
										</div>
									</div>

									{/* 不需要检查点的命令 */}
									<div>
										<label className="block font-medium mb-2">
											{t("settings:checkpoints.terminal.exemptedCommands")}
										</label>
										<div className="text-vscode-descriptionForeground text-sm mb-2">
											{t("settings:checkpoints.terminal.exemptedCommandsDescription")}
										</div>
										<div className="flex gap-2">
											<Input
												value={noCheckpointCommandInput}
												onChange={(e: any) => setNoCheckpointCommandInput(e.target.value)}
												onKeyDown={(e: any) => {
													if (e.key === "Enter") {
														e.preventDefault()
														handleAddNoCheckpointCommand()
													}
												}}
												placeholder={t("settings:checkpoints.terminal.exemptedPlaceholder")}
												className="flex-1"
											/>
											<Button onClick={handleAddNoCheckpointCommand}>
												{t("settings:checkpoints.terminal.addButton")}
											</Button>
										</div>
										<div className="flex flex-wrap gap-2 mt-2">
											{(noCheckpointCommands ?? []).map((cmd, index) => (
												<Button
													key={index}
													variant="secondary"
													onClick={() => {
														const newCommands = (noCheckpointCommands ?? []).filter((_, i) => i !== index)
														setCachedStateField("noCheckpointCommands", newCommands)
													}}>
													{cmd}
												</Button>
											))}
										</div>
									</div>
								</div>
							</div>
						</>
					)}
				</div>
			</Section>
		</div>
	)
}
