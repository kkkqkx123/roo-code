import { useMemo, useRef, useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

import { CheckpointMenu } from "./CheckpointMenu"
import { checkpointSchema, checkpointMetadataSchema } from "./schema"
import { GitCommitVertical } from "lucide-react"

type CheckpointSavedProps = {
	ts: number
	commitHash: string
	currentHash?: string
	checkpoint?: Record<string, unknown>
}

export const CheckpointSaved = ({ checkpoint, currentHash, ...props }: CheckpointSavedProps) => {
	const { t } = useTranslation()
	const isCurrent = currentHash === props.commitHash
	const [isPopoverOpen, setIsPopoverOpen] = useState(false)
	const [isClosing, setIsClosing] = useState(false)
	const [isHovering, setIsHovering] = useState(false)
	const closeTimer = useRef<number | null>(null)

	useEffect(() => {
		return () => {
			if (closeTimer.current) {
				window.clearTimeout(closeTimer.current)
				closeTimer.current = null
			}
		}
	}, [])

	const handlePopoverOpenChange = (open: boolean) => {
		setIsPopoverOpen(open)
		if (open) {
			setIsClosing(false)
			if (closeTimer.current) {
				window.clearTimeout(closeTimer.current)
				closeTimer.current = null
			}
		} else {
			setIsClosing(true)
			closeTimer.current = window.setTimeout(() => {
				setIsClosing(false)
				closeTimer.current = null
			}, 200) // keep menu visible briefly to avoid popover jump
		}
	}

	const handleMouseEnter = () => {
		setIsHovering(true)
	}

	const handleMouseLeave = () => {
		setIsHovering(false)
	}

	// Menu is visible when hovering, popover is open, or briefly after popover closes
	const menuVisible = isHovering || isPopoverOpen || isClosing

	const metadata = useMemo(() => {
		if (!checkpoint) {
			return undefined
		}

		const result = checkpointSchema.safeParse(checkpoint)

		if (!result.success) {
			return undefined
		}

		return result.data
	}, [checkpoint])

	const hasApiContext = useMemo(() => {
		if (!checkpoint) return false
		
		try {
			const metadata = checkpoint as any
			
			// 检查是否有checkpointMetadata字段
			if (!metadata.checkpointMetadata) return false
			
			// 验证checkpointMetadata是否包含必要的上下文信息
			const parsed = checkpointMetadataSchema.safeParse(metadata.checkpointMetadata)
			if (!parsed.success) return false
			
			// 检查是否包含系统提示词或工具协议
			const { systemPrompt, toolProtocol } = parsed.data
			return !!(systemPrompt || toolProtocol)
		} catch {
			return false
		}
	}, [checkpoint])

	if (!metadata) {
		return null
	}

	return (
		<div
			className="flex items-center justify-between gap-2 pt-2 pb-3"
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}>
			<div className="flex items-center gap-2 text-blue-400 whitespace-nowrap">
				<GitCommitVertical className="w-4" />
				<span className="font-semibold">{t("chat:checkpoint.regular")}</span>
				{isCurrent && <span className="text-muted">({t("chat:checkpoint.current")})</span>}
			</div>
			<span
				className="block w-full h-[2px] mt-[2px] text-xs"
				style={{
					backgroundImage:
						"linear-gradient(90deg, rgba(0, 188, 255, .65), rgba(0, 188, 255, .65) 80%, rgba(0, 188, 255, 0) 99%)",
				}}></span>

			{/* Keep menu visible while hovering, popover is open, or briefly after close to prevent jump */}
			<div data-testid="checkpoint-menu-container" className={cn("h-4 -mt-2", menuVisible ? "block" : "hidden")}>
				<CheckpointMenu
					ts={props.ts}
					commitHash={props.commitHash}
					checkpoint={metadata}
					hasApiContext={hasApiContext}
					showContextRestore={false} // 当前检查点不显示上下文恢复
					onOpenChange={handlePopoverOpenChange}
				/>
			</div>
		</div>
	)
}
