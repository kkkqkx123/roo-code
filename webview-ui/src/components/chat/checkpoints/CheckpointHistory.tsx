import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { CheckpointMenu } from "./CheckpointMenu"
import { checkpointSchema } from "./schema"
import { Button } from "@/components/ui"

interface CheckpointHistoryItem {
  ts: number
  commitHash: string
  message?: string
  checkpoint?: Record<string, unknown>
  isCurrent?: boolean
}

interface CheckpointHistoryProps {
  checkpoints: CheckpointHistoryItem[]
  currentHash?: string
  onRestore?: (commitHash: string, restoreType: 'files' | 'context' | 'both') => void
  onDiff?: (commitHash: string, mode: 'checkpoint' | 'from-init' | 'to-current') => void
  className?: string
}

export const CheckpointHistory = ({
  checkpoints,
  currentHash,
  onRestore,
  onDiff,
  className
}: CheckpointHistoryProps) => {
  const { t } = useTranslation()
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  // 按时间戳排序（最新的在前）
  const sortedCheckpoints = [...checkpoints].sort((a, b) => b.ts - a.ts)

  // 限制显示数量
  const visibleCheckpoints = expanded ? sortedCheckpoints : sortedCheckpoints.slice(0, 5)

  const formatTimestamp = (ts: number) => {
    return format(new Date(ts), "yyyy-MM-dd HH:mm:ss")
  }

  const getCheckpointMessage = (checkpoint: CheckpointHistoryItem) => {
    if (checkpoint.message) return checkpoint.message
    
    // 尝试从检查点数据中提取消息
    try {
      const parsed = checkpointSchema.parse(checkpoint.checkpoint || {})
      // 检查点schema中没有message字段，使用默认消息
      return t("chat:checkpoint.history.defaultMessage", "自动检查点")
    } catch {
      return t("chat:checkpoint.history.defaultMessage", "自动检查点")
    }
  }

  const handleRestore = (commitHash: string, restoreType: 'files' | 'context' | 'both') => {
    onRestore?.(commitHash, restoreType)
    setSelectedCheckpoint(null)
  }

  const handleDiff = (commitHash: string, mode: 'checkpoint' | 'from-init' | 'to-current') => {
    onDiff?.(commitHash, mode)
  }

  if (sortedCheckpoints.length === 0) {
    return (
      <div className={cn("text-center py-8 text-vscode-descriptionForeground", className)}>
        <div className="codicon codicon-history text-2xl mb-2" />
        <div className="text-sm">
          {t("chat:checkpoint.history.empty", "暂无检查点历史")}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">
          {t("chat:checkpoint.history.title", "检查点历史")}
          <span className="text-vscode-descriptionForeground ml-2">
            ({sortedCheckpoints.length})
          </span>
        </h3>
        
        {sortedCheckpoints.length > 5 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-xs"
          >
            {expanded ? 
              t("chat:checkpoint.history.collapse", "收起") : 
              t("chat:checkpoint.history.expand", "展开全部")}
          </Button>
        )}
      </div>
      
      <div className="space-y-1 max-h-80 overflow-y-auto">
        {visibleCheckpoints.map((checkpoint, index) => (
          <div
            key={checkpoint.commitHash}
            className={cn(
              "group flex items-center justify-between p-2 rounded border transition-colors",
              checkpoint.commitHash === currentHash ? 
                "bg-vscode-inputValidation-infoBackground border-vscode-inputValidation-infoBorder" :
                "bg-vscode-input-background border-vscode-input-border hover:bg-vscode-inputOption-hoverBackground"
            )}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {checkpoint.commitHash === currentHash && (
                  <span 
                    className="codicon codicon-record text-vscode-inputValidation-infoBorder text-xs" 
                    title={t("chat:checkpoint.history.current", "当前状态")}
                  />
                )}
                <span className="text-xs font-mono text-vscode-descriptionForeground truncate">
                  {checkpoint.commitHash.slice(0, 8)}
                </span>
                <span className="text-xs text-vscode-descriptionForeground">
                  {formatTimestamp(checkpoint.ts)}
                </span>
              </div>
              
              <div className="text-sm truncate">
                {getCheckpointMessage(checkpoint)}
              </div>
            </div>
            
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <CheckpointMenu
                ts={checkpoint.ts}
                commitHash={checkpoint.commitHash}
                checkpoint={checkpointSchema.parse(checkpoint.checkpoint || {})}
                hasApiContext={!!checkpoint.checkpoint}
                showContextRestore={index > 0} // 只有非第一个检查点显示上下文恢复
                onOpenChange={(open) => 
                  setSelectedCheckpoint(open ? checkpoint.commitHash : null)
                }
              />
            </div>
          </div>
        ))}
      </div>
      
      {sortedCheckpoints.length > 5 && !expanded && (
        <div className="text-center text-xs text-vscode-descriptionForeground">
          {t("chat:checkpoint.history.moreItems", "还有 {{count}} 个检查点", { 
            count: sortedCheckpoints.length - 5 
          })}
        </div>
      )}
    </div>
  )
}