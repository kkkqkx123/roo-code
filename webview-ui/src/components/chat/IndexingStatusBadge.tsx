import React, { useState, useEffect, useMemo } from "react"
import { Database, Zap } from "lucide-react"

import { cn } from "@src/lib/utils"
import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@/i18n/TranslationContext"

import type { IndexingStatus, IndexingStatusUpdateMessage, ConfigUpgradeStatusUpdateMessage } from "@roo/ExtensionMessage"

import { useExtensionState } from "@src/context/ExtensionStateContext"
import { PopoverTrigger, StandardTooltip, Button } from "@src/components/ui"

import { CodeIndexPopover } from "./CodeIndexPopover"

interface IndexingStatusBadgeProps {
	className?: string
}

export const IndexingStatusBadge: React.FC<IndexingStatusBadgeProps> = ({ className }) => {
	const { t } = useAppTranslation()
	const { cwd } = useExtensionState()

	const [indexingStatus, setIndexingStatus] = useState<IndexingStatus>({
		systemStatus: "Standby",
		processedItems: 0,
		totalItems: 0,
		currentItemUnit: "items",
	})

	const [configUpgradeStatus, setConfigUpgradeStatus] = useState<any>(null)

	useEffect(() => {
		vscode.postMessage({ type: "requestIndexingStatus" })

		const handleMessage = (event: MessageEvent<IndexingStatusUpdateMessage | ConfigUpgradeStatusUpdateMessage>) => {
			if (event.data.type === "indexingStatusUpdate") {
				const status = event.data.values
				if (!status.workspacePath || status.workspacePath === cwd) {
					setIndexingStatus(status)
				}
			} else if (event.data.type === "configUpgradeStatusUpdate") {
				const status = event.data.values
				if (!status.workspacePath || status.workspacePath === cwd) {
					setConfigUpgradeStatus(status)
				}
			}
		}

		window.addEventListener("message", handleMessage)

		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [cwd])

	const progressPercentage = useMemo(
		() =>
			indexingStatus.totalItems > 0
				? Math.round((indexingStatus.processedItems / indexingStatus.totalItems) * 100)
				: 0,
		[indexingStatus.processedItems, indexingStatus.totalItems],
	)

	const tooltipText = useMemo(() => {
		if (configUpgradeStatus && configUpgradeStatus.status === "in_progress") {
			const progress = configUpgradeStatus.progress || 0
			return t("chat:indexingStatus.upgrading", { 
				percentage: String(progress),
				currentPreset: configUpgradeStatus.currentPreset,
				targetPreset: configUpgradeStatus.targetPreset 
			})
		}
		
		if (configUpgradeStatus && configUpgradeStatus.status === "rolling_back") {
			const progress = configUpgradeStatus.progress || 0
			return t("chat:indexingStatus.rollingBack", { 
				percentage: String(progress),
				currentPreset: configUpgradeStatus.currentPreset,
				targetPreset: configUpgradeStatus.targetPreset 
			})
		}
		
		switch (indexingStatus.systemStatus) {
			case "Standby":
				return t("chat:indexingStatus.ready")
			case "Indexing":
				return t("chat:indexingStatus.indexing", { percentage: String(progressPercentage) })
			case "Indexed":
				return t("chat:indexingStatus.indexed")
			case "Error":
				return t("chat:indexingStatus.error")
			default:
				return t("chat:indexingStatus.status")
		}
	}, [indexingStatus.systemStatus, progressPercentage, configUpgradeStatus, t])

	const statusColorClass = useMemo(() => {
		if (configUpgradeStatus && configUpgradeStatus.status === "in_progress") {
			return "bg-blue-500 animate-pulse"
		}
		
		if (configUpgradeStatus && configUpgradeStatus.status === "rolling_back") {
			return "bg-yellow-500 animate-pulse"
		}
		
		const statusColors = {
			Standby: "bg-vscode-descriptionForeground/60",
			Indexing: "bg-yellow-500 animate-pulse",
			Indexed: "bg-green-500",
			Error: "bg-red-500",
		}

		return statusColors[indexingStatus.systemStatus as keyof typeof statusColors] || statusColors.Standby
	}, [indexingStatus.systemStatus, configUpgradeStatus])

	const showUpgradeIcon = configUpgradeStatus && (configUpgradeStatus.status === "in_progress" || configUpgradeStatus.status === "rolling_back")

	return (
		<CodeIndexPopover indexingStatus={indexingStatus} configUpgradeStatus={configUpgradeStatus}>
			<StandardTooltip content={tooltipText}>
				<PopoverTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						aria-label={tooltipText}
						className={cn(
							"relative h-5 w-5 p-0",
							"text-vscode-foreground opacity-85",
							"hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)]",
							"focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder",
							className,
						)}>
						{showUpgradeIcon ? <Zap className="w-4 h-4" /> : <Database className="w-4 h-4" />}
						<span
							className={cn(
								"absolute top-0 right-0 w-1.5 h-1.5 rounded-full transition-colors duration-200",
								statusColorClass,
							)}
						/>
					</Button>
				</PopoverTrigger>
			</StandardTooltip>
		</CodeIndexPopover>
	)
}
