import { useState, useCallback } from "react"
import { CheckIcon, Cross2Icon } from "@radix-ui/react-icons"
import { useTranslation } from "react-i18next"

import { Button, Popover, PopoverContent, PopoverTrigger, StandardTooltip } from "@/components/ui"
import { useRooPortal } from "@/components/ui/hooks"

import { vscode } from "@src/utils/vscode"
import { Checkpoint } from "./schema"

type CheckpointMenuBaseProps = {
	ts: number
	commitHash: string
	checkpoint: Checkpoint
	hasApiContext?: boolean // 新增：是否有API上下文可恢复
	showContextRestore?: boolean // 新增：是否显示上下文恢复选项
}
type CheckpointMenuControlledProps = {
	onOpenChange: (open: boolean) => void
}
type CheckpointMenuUncontrolledProps = {
	onOpenChange?: undefined
}
type CheckpointMenuProps = CheckpointMenuBaseProps & (CheckpointMenuControlledProps | CheckpointMenuUncontrolledProps) & {
  onRestore?: (commitHash: string, restoreType: 'files_only' | 'context_only' | 'files_and_context') => void
  onDiff?: (commitHash: string, mode: 'checkpoint' | 'from-init' | 'to-current') => void
}

export const CheckpointMenu = ({
  ts,
  commitHash,
  checkpoint,
  hasApiContext = false,
  showContextRestore = true,
  onOpenChange,
  onRestore,
  onDiff
}: CheckpointMenuProps) => {
	const { t } = useTranslation()
	const [internalRestoreOpen, setInternalRestoreOpen] = useState(false)
	const [restoreConfirming, setRestoreConfirming] = useState(false)
	const [internalMoreOpen, setInternalMoreOpen] = useState(false)
	const portalContainer = useRooPortal("roo-portal")

	const previousCommitHash = checkpoint?.from

	const restoreOpen = internalRestoreOpen
	const moreOpen = internalMoreOpen
	const setRestoreOpen = useCallback(
		(open: boolean) => {
			setInternalRestoreOpen(open)
			if (onOpenChange) {
				onOpenChange(open)
			}
		},
		[onOpenChange],
	)

	const setMoreOpen = useCallback(
		(open: boolean) => {
			setInternalMoreOpen(open)
			if (onOpenChange) {
				onOpenChange(open)
			}
		},
		[onOpenChange],
	)

	const onCheckpointDiff = useCallback(() => {
		if (onDiff) {
			onDiff(commitHash, "checkpoint")
		} else {
			vscode.postMessage({
				type: "checkpointDiff",
				payload: { ts, previousCommitHash, commitHash, mode: "checkpoint" },
			})
		}
	}, [ts, previousCommitHash, commitHash, onDiff])

	const onDiffFromInit = useCallback(() => {
		if (onDiff) {
			onDiff(commitHash, "from-init")
		} else {
			vscode.postMessage({
				type: "checkpointDiff",
				payload: { ts, commitHash, mode: "from-init" },
			})
		}
	}, [ts, commitHash, onDiff])

	const onDiffWithCurrent = useCallback(() => {
		if (onDiff) {
			onDiff(commitHash, "to-current")
		} else {
			vscode.postMessage({
				type: "checkpointDiff",
				payload: { ts, commitHash, mode: "to-current" },
			})
		}
	}, [ts, commitHash, onDiff])



	const onRestoreFilesOnly = useCallback(() => {
		if (onRestore) {
			onRestore(commitHash, "files_only")
		} else {
			vscode.postMessage({
				type: "checkpointRestore",
				payload: {
					ts,
					commitHash,
					mode: "restore",
					restoreType: "files_only"
				}
			})
		}
		setRestoreOpen(false)
	}, [ts, commitHash, setRestoreOpen, onRestore])

	const onRestoreContextOnly = useCallback(() => {
		if (onRestore) {
			onRestore(commitHash, "context_only")
		} else {
			vscode.postMessage({
				type: "checkpointRestore",
				payload: {
					ts,
					commitHash,
					mode: "restore",
					restoreType: "context_only"
				}
			})
		}
		setRestoreOpen(false)
	}, [ts, commitHash, setRestoreOpen, onRestore])

	const onRestoreFilesAndContext = useCallback(() => {
		if (onRestore) {
			onRestore(commitHash, "files_and_context")
		} else {
			vscode.postMessage({
				type: "checkpointRestore",
				payload: {
					ts,
					commitHash,
					mode: "restore",
					restoreType: "files_and_context"
				}
			})
		}
		setRestoreOpen(false)
	}, [ts, commitHash, setRestoreOpen, onRestore])

	const handleOpenChange = useCallback(
		(open: boolean) => {
			setRestoreOpen(open)
			if (!open) {
				setRestoreConfirming(false)
			}
		},
		[setRestoreOpen],
	)

	return (
		<div className="flex flex-row gap-1">
			<StandardTooltip content={t("chat:checkpoint.menu.viewDiff")}>
				<Button variant="ghost" size="icon" onClick={onCheckpointDiff}>
					<span className="codicon codicon-diff-single" />
				</Button>
			</StandardTooltip>
			<Popover
				open={restoreOpen}
				onOpenChange={(open) => {
					handleOpenChange(open)
					setRestoreConfirming(false)
				}}
				data-testid="restore-popover">
				<StandardTooltip content={t("chat:checkpoint.menu.restore")}>
					<PopoverTrigger asChild>
						<Button variant="ghost" size="icon" aria-label={t("chat:checkpoint.menu.restore")}>
							<span className="codicon codicon-history" />
						</Button>
					</PopoverTrigger>
				</StandardTooltip>
				<PopoverContent align="end" container={portalContainer}>
					<div className="flex flex-col gap-2">
						<div className="flex flex-col gap-1 group hover:text-foreground">
							<Button variant="secondary" onClick={onRestoreFilesOnly} data-testid="restore-files-btn">
								{t("chat:checkpoint.menu.restoreFiles")}
							</Button>
							<div className="text-muted transition-colors group-hover:text-foreground">
								{t("chat:checkpoint.menu.restoreFilesDescription")}
							</div>
						</div>
						{showContextRestore && hasApiContext && (
							<div className="flex flex-col gap-1 group hover:text-foreground">
								<Button variant="secondary" onClick={onRestoreContextOnly} data-testid="restore-context-btn">
									{t("chat:checkpoint.menu.restoreContext")}
								</Button>
								<div className="text-muted transition-colors group-hover:text-foreground">
									{t("chat:checkpoint.menu.restoreContextDescription")}
								</div>
							</div>
						)}
						<div className="flex flex-col gap-1 group hover:text-foreground">
							{!restoreConfirming ? (
								<Button
									variant="secondary"
									onClick={() => setRestoreConfirming(true)}
									data-testid="restore-files-and-context-btn">
									{t("chat:checkpoint.menu.restoreFilesAndContext")}
								</Button>
							) : (
								<>
									<Button
										variant="primary"
										onClick={onRestoreFilesAndContext}
										className="grow"
										data-testid="confirm-restore-btn">
										<div className="flex flex-row gap-1">
											<CheckIcon />
											<div>{t("chat:checkpoint.menu.confirm")}</div>
										</div>
									</Button>
									<Button variant="secondary" onClick={() => setRestoreConfirming(false)}>
										<div className="flex flex-row gap-1">
											<Cross2Icon />
											<div>{t("chat:checkpoint.menu.cancel")}</div>
										</div>
									</Button>
								</>
							)}
							{restoreConfirming ? (
								<div data-testid="checkpoint-confirm-warning" className="text-destructive font-bold">
									{t("chat:checkpoint.menu.cannotUndo")}
								</div>
							) : (
								<div className="text-muted transition-colors group-hover:text-foreground">
									{t("chat:checkpoint.menu.restoreFilesAndContextDescription")}
								</div>
							)}
						</div>
					</div>
				</PopoverContent>
			</Popover>
			<Popover open={moreOpen} onOpenChange={(open) => setMoreOpen(open)} data-testid="more-popover">
				<StandardTooltip content={t("chat:task.seeMore")}>
					<PopoverTrigger asChild>
						<Button variant="ghost" size="icon" aria-label={t("chat:checkpoint.menu.more")}>
							<span className="codicon codicon-kebab-vertical" />
						</Button>
					</PopoverTrigger>
				</StandardTooltip>
				<PopoverContent align="end" container={portalContainer} className="w-auto min-w-max">
					<div className="flex flex-col gap-2">
						<Button
							variant="secondary"
							onClick={() => {
								onDiffFromInit()
								setMoreOpen(false)
							}}>
							<span className="codicon codicon-versions mr-2" />
							{t("chat:checkpoint.menu.viewDiffFromInit")}
						</Button>
						<Button
							variant="secondary"
							onClick={() => {
								onDiffWithCurrent()
								setMoreOpen(false)
							}}>
							<span className="codicon codicon-diff mr-2" />
							{t("chat:checkpoint.menu.viewDiffWithCurrent")}
						</Button>
					</div>
				</PopoverContent>
			</Popover>
		</div>
	)
}
