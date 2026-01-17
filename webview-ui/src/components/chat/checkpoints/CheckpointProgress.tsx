import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

interface CheckpointProgressProps {
  isVisible: boolean
  progress: number // 0-100
  status: 'initializing' | 'staging' | 'committing' | 'completed' | 'error'
  message?: string
  onClose?: () => void
}

export const CheckpointProgress = ({
  isVisible,
  progress,
  status,
  message,
  onClose
}: CheckpointProgressProps) => {
  const { t } = useTranslation()
  const [show, setShow] = useState(false)
  const [localProgress, setLocalProgress] = useState(0)

  // 平滑进度动画
  useEffect(() => {
    if (isVisible) {
      setShow(true)
    } else {
      // 延迟隐藏以显示完成动画
      const timer = setTimeout(() => setShow(false), 500)
      return () => clearTimeout(timer)
    }
  }, [isVisible])

  // 平滑进度更新
  useEffect(() => {
    if (!isVisible) return
    
    const targetProgress = Math.max(0, Math.min(100, progress))
    const diff = targetProgress - localProgress
    
    if (Math.abs(diff) < 1) {
      setLocalProgress(targetProgress)
      return
    }
    
    const timer = setTimeout(() => {
      setLocalProgress(prev => prev + (diff > 0 ? 1 : -1))
    }, 20)
    
    return () => clearTimeout(timer)
  }, [progress, isVisible, localProgress])

  // 状态对应的消息
  const getStatusMessage = () => {
    if (message) return message
    
    switch (status) {
      case 'initializing':
        return t("chat:checkpoint.progress.initializing", "正在初始化检查点...")
      case 'staging':
        return t("chat:checkpoint.progress.staging", "正在暂存文件...")
      case 'committing':
        return t("chat:checkpoint.progress.committing", "正在创建检查点...")
      case 'completed':
        return t("chat:checkpoint.progress.completed", "检查点创建完成")
      case 'error':
        return t("chat:checkpoint.progress.error", "检查点创建失败")
      default:
        return t("chat:checkpoint.progress.processing", "正在处理...")
    }
  }

  // 状态对应的图标
  const getStatusIcon = () => {
    switch (status) {
      case 'initializing':
      case 'staging':
      case 'committing':
        return "codicon codicon-loading codicon-modifier-spin"
      case 'completed':
        return "codicon codicon-check"
      case 'error':
        return "codicon codicon-error"
      default:
        return "codicon codicon-info"
    }
  }

  if (!show) return null

  return (
    <div className={cn(
      "fixed bottom-4 right-4 w-80 bg-vscode-notifications-background border border-vscode-notifications-border rounded-lg shadow-lg z-50 transition-all duration-300",
      isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
    )}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={getStatusIcon()} />
            <span className="font-medium text-sm">
              {t("chat:checkpoint.progress.title", "检查点进度")}
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-vscode-descriptionForeground hover:text-vscode-foreground transition-colors"
            >
              <span className="codicon codicon-close" />
            </button>
          )}
        </div>
        
        <div className="mb-2">
          <div className="text-sm text-vscode-descriptionForeground">
            {getStatusMessage()}
          </div>
        </div>
        
        <div className="w-full bg-vscode-progressBar-background rounded-full h-2">
          <div 
            className={cn(
              "h-full rounded-full transition-all duration-300",
              status === 'error' ? "bg-vscode-inputValidation-errorBackground" :
              status === 'completed' ? "bg-vscode-inputValidation-infoBackground" :
              "bg-vscode-progressBar-foreground"
            )}
            style={{ width: `${localProgress}%` }}
          />
        </div>
        
        <div className="flex justify-between text-xs text-vscode-descriptionForeground mt-1">
          <span>{Math.round(localProgress)}%</span>
          <span>
            {status === 'completed' ? t("chat:checkpoint.progress.done", "完成") : 
             status === 'error' ? t("chat:checkpoint.progress.failed", "失败") : 
             t("chat:checkpoint.progress.inProgress", "进行中")}
          </span>
        </div>
      </div>
    </div>
  )
}