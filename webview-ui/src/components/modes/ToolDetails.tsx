import React from "react"
import { ToolGroup, ToolName } from "@shared/types"
import { TOOL_GROUPS } from "@shared/tools"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { StandardTooltip } from "@src/components/ui"

interface ToolDetailsProps {
	group: ToolGroup
	tool?: ToolName
	showTooltip?: boolean
	className?: string
}

export const ToolDetails: React.FC<ToolDetailsProps> = ({
	group,
	tool,
	showTooltip = true,
	className = ""
}) => {
	const { tDynamic } = useAppTranslation()

	// 获取组名称
	const groupName = tDynamic(`prompts:tools.toolNames.${group}`)

	// 如果没有指定具体工具，只显示组名称
	if (!tool) {
		return <span className={className}>{groupName}</span>
	}

	// 获取工具详情名称
	const toolDetailName = tDynamic(`prompts:tools.toolDetails.${group}.${tool}`)

	// 构建完整显示文本
	const displayText = `${groupName} - ${toolDetailName}`

	if (showTooltip) {
		return (
			<StandardTooltip content={displayText}>
				<span className={className}>{displayText}</span>
			</StandardTooltip>
		)
	}

	return <span className={className}>{displayText}</span>
}

interface ToolGroupDetailsProps {
	group: ToolGroup
	className?: string
}

export const ToolGroupDetails: React.FC<ToolGroupDetailsProps> = ({
	group,
	className = ""
}) => {
	const { tDynamic } = useAppTranslation()
	const groupConfig = TOOL_GROUPS[group]

	if (!groupConfig) {
		return null
	}

	const allTools = [...(groupConfig.tools || []), ...(groupConfig.customTools || [])]
	const groupName = tDynamic(`prompts:tools.toolNames.${group}`)

	return (
		<div className={className}>
			<div className="font-medium mb-2">{groupName}</div>
			<div className="ml-4 space-y-1">
				{allTools.map((tool) => (
					<div key={tool} className="text-sm text-vscode-descriptionForeground">
						{tDynamic(`prompts:tools.toolDetails.${group}.${tool as ToolName}`)}
					</div>
				))}
			</div>
		</div>
	)
}