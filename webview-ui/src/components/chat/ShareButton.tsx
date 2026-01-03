import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Share2Icon } from "lucide-react"

import { type HistoryItem, type ShareVisibility } from "@roo-code/types"

import { vscode } from "@/utils/vscode"
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
	Command,
	CommandList,
	CommandItem,
	CommandGroup,
	StandardTooltip,
} from "@/components/ui"
import { LucideIconButton } from "./LucideIconButton"

interface ShareButtonProps {
	item?: HistoryItem
	disabled?: boolean
}

export const ShareButton = ({ item, disabled = false }: ShareButtonProps) => {
	const [shareDropdownOpen, setShareDropdownOpen] = useState(false)
	const [shareSuccess, setShareSuccess] = useState<{ visibility: ShareVisibility; url: string } | null>(null)
	const { t } = useTranslation()

	// Listen for share success messages from the extension
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "shareTaskSuccess") {
				setShareSuccess({
					visibility: message.visibility,
					url: message.text,
				})
				// Auto-hide success message and close popover after 5 seconds
				setTimeout(() => {
					setShareSuccess(null)
					setShareDropdownOpen(false)
				}, 5000)
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	const handleShare = (visibility: ShareVisibility) => {
		// Clear any previous success state
		setShareSuccess(null)

		vscode.postMessage({
			type: "shareCurrentTask",
			visibility,
		})
		// Don't close the dropdown immediately - let success message show first
	}

	const handleShareButtonClick = () => {
		setShareDropdownOpen(true)
	}

	// Don't render if no item ID
	if (!item?.id) {
		return null
	}

	return (
		<Popover open={shareDropdownOpen} onOpenChange={setShareDropdownOpen}>
			<StandardTooltip content={t("chat:task.share")}>
				<PopoverTrigger asChild>
					<LucideIconButton
						icon={Share2Icon}
						disabled={disabled}
						tooltip={false}
						onClick={handleShareButtonClick}
						data-testid="share-button"
						title={t("chat:task.share")}></LucideIconButton>
				</PopoverTrigger>
			</StandardTooltip>

			<PopoverContent className="w-56 p-0" align="start">
				{shareSuccess ? (
					<div className="p-3">
						<div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
							<span className="codicon codicon-check"></span>
							<span>
								{shareSuccess.visibility === "public"
									? t("chat:task.shareSuccessPublic")
									: t("chat:task.shareSuccessOrganization")}
							</span>
						</div>
					</div>
				) : (
					<Command>
						<CommandList>
							<CommandGroup>
								<CommandItem
									onSelect={() => handleShare("public")}
									className="cursor-pointer">
									<div className="flex items-center gap-2">
										<span className="codicon codicon-globe text-sm"></span>
										<div className="flex flex-col">
											<span className="text-sm">{t("chat:task.sharePublicly")}</span>
											<span className="text-xs text-vscode-descriptionForeground">
												{t("chat:task.sharePubliclyDescription")}
											</span>
										</div>
									</div>
								</CommandItem>
							</CommandGroup>
						</CommandList>
					</Command>
				)}
			</PopoverContent>
		</Popover>
	)
}
