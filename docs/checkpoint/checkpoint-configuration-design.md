# 用户自定义检查点配置设计

## 设计概述

基于对现有命令授权UI机制的分析，本设计提出一个用户可配置的检查点系统，效仿AutoApproveSettings的设计模式，提供灵活的命令级别检查点配置和多Shell支持。

## 配置架构设计

### 1. 设置数据结构

#### 核心接口定义
```typescript
interface CheckpointSettings {
  // 主开关
  checkpointEnabled?: boolean
  
  // 检查点触发规则
  alwaysCheckpointReadOnly?: boolean
  alwaysCheckpointWrite?: boolean
  alwaysCheckpointExecute?: boolean
  alwaysCheckpointBrowser?: boolean
  alwaysCheckpointMcp?: boolean
  
  // 命令级别检查点配置
  checkpointCommands?: string[]        // 需要检查点的命令
  noCheckpointCommands?: string[]      // 不需要检查点的命令
  
  // 检查点策略
  checkpointBeforeHighRisk?: boolean    // 高风险命令前检查点
  checkpointAfterHighRisk?: boolean    // 高风险命令后检查点
  checkpointOnError?: boolean          // 命令失败时检查点
  
  // 多Shell支持
  shellSpecificCheckpoints?: {
    powershell?: ShellCheckpointConfig
    bash?: ShellCheckpointConfig
    zsh?: ShellCheckpointConfig
    cmd?: ShellCheckpointConfig
  }
}

interface ShellCheckpointConfig {
  checkpointCommands?: string[]
  noCheckpointCommands?: string[]
  checkpointBeforeHighRisk?: boolean
  checkpointAfterHighRisk?: boolean
  // Shell特定的风险规则
  shellSpecificRiskRules?: string[]
}
```

### 2. 默认配置值

#### 基于风险等级的默认设置
```typescript
const defaultCheckpointSettings: CheckpointSettings = {
  checkpointEnabled: true,
  alwaysCheckpointExecute: true,
  checkpointBeforeHighRisk: true,
  checkpointCommands: [
    'rm -rf',
    'git reset --hard',
    'chmod -R 777',
    'Remove-Item -Recurse -Force',
    'del /s /q /f'
  ],
  shellSpecificCheckpoints: {
    powershell: {
      checkpointCommands: [
        'Remove-Item -Recurse -Force',
        'Set-ExecutionPolicy Unrestricted',
        'Invoke-Expression'
      ]
    },
    bash: {
      checkpointCommands: [
        'rm -rf',
        'chmod -R',
        'git reset --hard'
      ]
    },
    // ... 其他shell默认配置
  }
}
```

## UI组件设计

### 1. 主要设置组件

#### CheckpointSettings.tsx
```typescript
import { HTMLAttributes, useState } from "react"
import { Shield, TerminalIcon } from "lucide-react"

import { useAppTranslation } from "@/i18n/TranslationContext"
import { vscode } from "@/utils/vscode"
import { Button, Input } from "@/components/ui"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { CheckpointToggle } from "./CheckpointToggle"
import { ShellSpecificCheckpointSettings } from "./ShellSpecificCheckpointSettings"

type CheckpointSettingsProps = HTMLAttributes<HTMLDivElement> & {
  checkpointEnabled?: boolean
  alwaysCheckpointReadOnly?: boolean
  alwaysCheckpointWrite?: boolean
  alwaysCheckpointExecute?: boolean
  alwaysCheckpointBrowser?: boolean
  alwaysCheckpointMcp?: boolean
  checkpointCommands?: string[]
  noCheckpointCommands?: string[]
  checkpointBeforeHighRisk?: boolean
  checkpointAfterHighRisk?: boolean
  checkpointOnError?: boolean
  shellSpecificCheckpoints?: {
    powershell?: ShellCheckpointConfig
    bash?: ShellCheckpointConfig
    zsh?: ShellCheckpointConfig
    cmd?: ShellCheckpointConfig
  }
  setCachedStateField: SetCachedStateField<
    | "checkpointEnabled"
    | "alwaysCheckpointReadOnly"
    | "alwaysCheckpointWrite"
    | "alwaysCheckpointExecute"
    | "alwaysCheckpointBrowser"
    | "alwaysCheckpointMcp"
    | "checkpointCommands"
    | "noCheckpointCommands"
    | "checkpointBeforeHighRisk"
    | "checkpointAfterHighRisk"
    | "checkpointOnError"
    | "shellSpecificCheckpoints"
  >
}

export const CheckpointSettings = ({
  checkpointEnabled,
  alwaysCheckpointReadOnly,
  alwaysCheckpointWrite,
  alwaysCheckpointExecute,
  alwaysCheckpointBrowser,
  alwaysCheckpointMcp,
  checkpointCommands,
  noCheckpointCommands,
  checkpointBeforeHighRisk,
  checkpointAfterHighRisk,
  checkpointOnError,
  shellSpecificCheckpoints,
  setCachedStateField,
  ...props
}: CheckpointSettingsProps) => {
  const { t } = useAppTranslation()
  const [commandInput, setCommandInput] = useState("")
  const [noCheckpointInput, setNoCheckpointInput] = useState("")

  const handleAddCheckpointCommand = () => {
    const currentCommands = checkpointCommands ?? []
    if (commandInput && !currentCommands.includes(commandInput)) {
      const newCommands = [...currentCommands, commandInput]
      setCachedStateField("checkpointCommands", newCommands)
      setCommandInput("")
      vscode.postMessage({ 
        type: "updateSettings", 
        updatedSettings: { checkpointCommands: newCommands } 
      })
    }
  }

  const handleAddNoCheckpointCommand = () => {
    const currentCommands = noCheckpointCommands ?? []
    if (noCheckpointInput && !currentCommands.includes(noCheckpointInput)) {
      const newCommands = [...currentCommands, noCheckpointInput]
      setCachedStateField("noCheckpointCommands", newCommands)
      setNoCheckpointInput("")
      vscode.postMessage({ 
        type: "updateSettings", 
        updatedSettings: { noCheckpointCommands: newCommands } 
      })
    }
  }

  return (
    <div {...props}>
      <SectionHeader>
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4" />
          <div>{t("settings:sections.checkpoint")}</div>
        </div>
      </SectionHeader>

      <Section>
        <div className="space-y-4">
          {/* 主开关 */}
          <VSCodeCheckbox
            checked={checkpointEnabled ?? false}
            onChange={() => setCachedStateField("checkpointEnabled", !checkpointEnabled)}
            data-testid="checkpoint-enabled-checkbox">
            <span className="font-medium">{t("settings:checkpoint.enabled")}</span>
          </VSCodeCheckbox>
          <div className="text-vscode-descriptionForeground text-sm mt-1">
            {t("settings:checkpoint.description")}
          </div>

          {/* 检查点触发规则 */}
          <CheckpointToggle
            alwaysCheckpointReadOnly={alwaysCheckpointReadOnly}
            alwaysCheckpointWrite={alwaysCheckpointWrite}
            alwaysCheckpointExecute={alwaysCheckpointExecute}
            alwaysCheckpointBrowser={alwaysCheckpointBrowser}
            alwaysCheckpointMcp={alwaysCheckpointMcp}
            onToggle={(key, value) => setCachedStateField(key, value)}
          />

          {/* 检查点策略配置 */}
          <div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
            <div className="font-bold">{t("settings:checkpoint.strategy.label")}</div>
            
            <VSCodeCheckbox
              checked={checkpointBeforeHighRisk ?? true}
              onChange={(e: any) => 
                setCachedStateField("checkpointBeforeHighRisk", e.target.checked)
              }
              data-testid="checkpoint-before-high-risk-checkbox">
              <span className="font-medium">
                {t("settings:checkpoint.strategy.beforeHighRisk")}
              </span>
            </VSCodeCheckbox>
            
            <VSCodeCheckbox
              checked={checkpointAfterHighRisk ?? false}
              onChange={(e: any) => 
                setCachedStateField("checkpointAfterHighRisk", e.target.checked)
              }
              data-testid="checkpoint-after-high-risk-checkbox">
              <span className="font-medium">
                {t("settings:checkpoint.strategy.afterHighRisk")}
              </span>
            </VSCodeCheckbox>
            
            <VSCodeCheckbox
              checked={checkpointOnError ?? false}
              onChange={(e: any) => 
                setCachedStateField("checkpointOnError", e.target.checked)
              }
              data-testid="checkpoint-on-error-checkbox">
              <span className="font-medium">
                {t("settings:checkpoint.strategy.onError")}
              </span>
            </VSCodeCheckbox>
          </div>

          {/* 命令级别配置 */}
          {alwaysCheckpointExecute && (
            <div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
              <div className="flex items-center gap-4 font-bold">
                <TerminalIcon className="w-4 h-4" />
                <div>{t("settings:checkpoint.execute.label")}</div>
              </div>

              {/* 需要检查点的命令 */}
              <div>
                <label className="block font-medium mb-1" data-testid="checkpoint-commands-heading">
                  {t("settings:checkpoint.execute.checkpointCommands")}
                </label>
                <div className="text-vscode-descriptionForeground text-sm mt-1">
                  {t("settings:checkpoint.execute.checkpointCommandsDescription")}
                </div>

                <div className="flex gap-2 mt-2">
                  <Input
                    value={commandInput}
                    onChange={(e: any) => setCommandInput(e.target.value)}
                    onKeyDown={(e: any) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleAddCheckpointCommand()
                      }
                    }}
                    placeholder={t("settings:checkpoint.execute.commandPlaceholder")}
                    className="grow"
                    data-testid="checkpoint-command-input"
                  />
                  <Button 
                    className="h-8" 
                    onClick={handleAddCheckpointCommand}
                    data-testid="add-checkpoint-command-button">
                    {t("settings:checkpoint.execute.addButton")}
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 mt-2">
                  {(checkpointCommands ?? []).map((cmd, index) => (
                    <Button
                      key={index}
                      variant="secondary"
                      data-testid={`remove-checkpoint-command-${index}`}
                      onClick={() => {
                        const newCommands = (checkpointCommands ?? []).filter((_, i) => i !== index)
                        setCachedStateField("checkpointCommands", newCommands)
                        vscode.postMessage({
                          type: "updateSettings",
                          updatedSettings: { checkpointCommands: newCommands },
                        })
                      }}>
                      <div className="flex flex-row items-center gap-1">
                        <div>{cmd}</div>
                        <X className="text-foreground scale-75" />
                      </div>
                    </Button>
                  ))}
                </div>
              </div>

              {/* 不需要检查点的命令 */}
              <div className="mt-4">
                <label className="block font-medium mb-1" data-testid="no-checkpoint-commands-heading">
                  {t("settings:checkpoint.execute.noCheckpointCommands")}
                </label>
                <div className="text-vscode-descriptionForeground text-sm mt-1">
                  {t("settings:checkpoint.execute.noCheckpointCommandsDescription")}
                </div>

                <div className="flex gap-2 mt-2">
                  <Input
                    value={noCheckpointInput}
                    onChange={(e: any) => setNoCheckpointInput(e.target.value)}
                    onKeyDown={(e: any) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleAddNoCheckpointCommand()
                      }
                    }}
                    placeholder={t("settings:checkpoint.execute.noCheckpointPlaceholder")}
                    className="grow"
                    data-testid="no-checkpoint-command-input"
                  />
                  <Button 
                    className="h-8" 
                    onClick={handleAddNoCheckpointCommand}
                    data-testid="add-no-checkpoint-command-button">
                    {t("settings:checkpoint.execute.addButton")}
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 mt-2">
                  {(noCheckpointCommands ?? []).map((cmd, index) => (
                    <Button
                      key={index}
                      variant="secondary"
                      data-testid={`remove-no-checkpoint-command-${index}`}
                      onClick={() => {
                        const newCommands = (noCheckpointCommands ?? []).filter((_, i) => i !== index)
                        setCachedStateField("noCheckpointCommands", newCommands)
                        vscode.postMessage({
                          type: "updateSettings",
                          updatedSettings: { noCheckpointCommands: newCommands },
                        })
                      }}>
                      <div className="flex flex-row items-center gap-1">
                        <div>{cmd}</div>
                        <X className="text-foreground scale-75" />
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 多Shell支持配置 */}
          <ShellSpecificCheckpointSettings
            shellSpecificCheckpoints={shellSpecificCheckpoints}
            setCachedStateField={setCachedStateField}
          />
        </div>
      </Section>
    </div>
  )
}
```

### 2. 开关组件

#### CheckpointToggle.tsx
```typescript
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "@/i18n/TranslationContext"

export const checkpointSettingsConfig = {
  alwaysCheckpointReadOnly: {
    key: "alwaysCheckpointReadOnly",
    labelKey: "settings:checkpoint.readOnly.label",
    descriptionKey: "settings:checkpoint.readOnly.description",
    icon: "eye",
    testId: "always-checkpoint-readonly-toggle"
  },
  alwaysCheckpointWrite: {
    key: "alwaysCheckpointWrite", 
    labelKey: "settings:checkpoint.write.label",
    descriptionKey: "settings:checkpoint.write.description",
    icon: "edit",
    testId: "always-checkpoint-write-toggle"
  },
  alwaysCheckpointExecute: {
    key: "alwaysCheckpointExecute",
    labelKey: "settings:checkpoint.execute.label", 
    descriptionKey: "settings:checkpoint.execute.description",
    icon: "terminal",
    testId: "always-checkpoint-execute-toggle"
  },
  // ... 其他配置项
}

type CheckpointToggleProps = {
  alwaysCheckpointReadOnly?: boolean
  alwaysCheckpointWrite?: boolean
  alwaysCheckpointExecute?: boolean
  alwaysCheckpointBrowser?: boolean
  alwaysCheckpointMcp?: boolean
  onToggle: (key: string, value: boolean) => void
}

export const CheckpointToggle = (props: CheckpointToggleProps) => {
  const { t } = useAppTranslation()
  
  return (
    <div className="space-y-3">
      {Object.entries(checkpointSettingsConfig).map(([key, config]) => (
        <VSCodeCheckbox
          key={key}
          checked={props[key as keyof CheckpointToggleProps] ?? false}
          onChange={(e: any) => props.onToggle(key, e.target.checked)}
          data-testid={config.testId}>
          <div>
            <div className="font-medium">{t(config.labelKey)}</div>
            <div className="text-vscode-descriptionForeground text-sm">
              {t(config.descriptionKey)}
            </div>
          </div>
        </VSCodeCheckbox>
      ))}
    </div>
  )
}
```

### 3. 多Shell配置组件

#### ShellSpecificCheckpointSettings.tsx
```typescript
import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAppTranslation } from "@/i18n/TranslationContext"

type ShellSpecificCheckpointSettingsProps = {
  shellSpecificCheckpoints?: {
    powershell?: ShellCheckpointConfig
    bash?: ShellCheckpointConfig
    zsh?: ShellCheckpointConfig
    cmd?: ShellCheckpointConfig
  }
  setCachedStateField: (key: "shellSpecificCheckpoints", value: any) => void
}

export const ShellSpecificCheckpointSettings = ({
  shellSpecificCheckpoints,
  setCachedStateField
}: ShellSpecificCheckpointSettingsProps) => {
  const { t } = useAppTranslation()
  const [selectedShell, setSelectedShell] = useState<keyof ShellSpecificCheckpoints>("powershell")
  
  const currentShellSettings = shellSpecificCheckpoints?.[selectedShell] || {}
  
  const handleShellSettingChange = (key: keyof ShellCheckpointConfig, value: any) => {
    const updated = {
      ...shellSpecificCheckpoints,
      [selectedShell]: {
        ...currentShellSettings,
        [key]: value
      }
    }
    setCachedStateField("shellSpecificCheckpoints", updated)
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <label className="font-medium">
          {t("settings:checkpoint.shellSpecific.label")}
        </label>
        <Select value={selectedShell} onValueChange={setSelectedShell}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="powershell">PowerShell</SelectItem>
            <SelectItem value="bash">Bash</SelectItem>
            <SelectItem value="zsh">Zsh</SelectItem>
            <SelectItem value="cmd">CMD</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* 动态显示当前shell的配置 */}
      <div className="pl-3 border-l-2 border-vscode-button-background">
        <div className="font-bold mb-2">
          {t(`settings:checkpoint.shellSpecific.${selectedShell}`)}
        </div>
        
        {/* Shell特定的命令配置 */}
        <div className="space-y-3">
          <VSCodeCheckbox
            checked={currentShellSettings.checkpointBeforeHighRisk ?? true}
            onChange={(e: any) => 
              handleShellSettingChange("checkpointBeforeHighRisk", e.target.checked)
            }>
            <span className="font-medium">
              {t("settings:checkpoint.strategy.beforeHighRisk")}
            </span>
          </VSCodeCheckbox>
          
          {/* Shell特定的命令列表配置可以在这里添加 */}
        </div>
      </div>
    </div>
  )
}
```

## 检查点逻辑实现

### 1. 检查点决策引擎

#### checkpoint-commands.ts
```typescript
import { findLongestPrefixMatch } from "../auto-approval/commands"
import { detectShellType } from "../../utils/shell"

export function shouldCreateCheckpoint(
  command: string,
  settings: CheckpointSettings,
  shellPath?: string
): { shouldCheckpoint: boolean; reason: string } {
  if (!settings.checkpointEnabled) {
    return { shouldCheckpoint: false, reason: "checkpoint_disabled" }
  }
  
  const shellType = detectShellType(shellPath)
  const shellConfig = getShellSpecificConfig(settings, shellType)
  
  // 检查命令是否在不需要检查点的列表中
  if (isNoCheckpointCommand(command, shellConfig.noCheckpointCommands || [])) {
    return { shouldCheckpoint: false, reason: "command_exempted" }
  }
  
  // 检查命令是否在需要检查点的列表中
  if (isCheckpointCommand(command, shellConfig.checkpointCommands || [])) {
    return { shouldCheckpoint: true, reason: "command_required" }
  }
  
  // 基于风险等级决定
  const riskLevel = assessCommandRisk(command, shellType)
  return shouldCheckpointBasedOnRisk(riskLevel, shellConfig)
}

function isCheckpointCommand(command: string, checkpointCommands: string[]): boolean {
  const longestMatch = findLongestPrefixMatch(command, checkpointCommands)
  return longestMatch !== null
}

function isNoCheckpointCommand(command: string, noCheckpointCommands: string[]): boolean {
  const longestMatch = findLongestPrefixMatch(command, noCheckpointCommands)
  return longestMatch !== null
}
```

### 2. 命令执行集成

#### ExecuteCommandTool.ts扩展
```typescript
export async function executeCommandInTerminal(
  task: Task,
  options: ExecuteCommandOptions
): Promise<[boolean, ToolResponse]> {
  const settings = await getCheckpointSettings()
  
  // 检查是否需要创建检查点
  const checkpointResult = shouldCreateCheckpoint(
    options.command, 
    settings, 
    options.shell
  )
  
  if (checkpointResult.shouldCheckpoint && settings.checkpointBeforeHighRisk) {
    await task.checkpointSave(false, true) // 静默保存检查点
  }
  
  // 执行命令
  const result = await executeCommand(options)
  
  // 命令执行后检查点
  if (checkpointResult.shouldCheckpoint && settings.checkpointAfterHighRisk && result.success) {
    await task.checkpointSave(false, true)
  }
  
  // 错误时检查点
  if (settings.checkpointOnError && !result.success) {
    await task.checkpointSave(false, true)
  }
  
  return [true, result]
}
```

## 国际化支持

### 1. 翻译键定义

#### settings.json扩展
```json
{
  "settings": {
    "sections": {
      "checkpoint": "检查点设置"
    },
    "checkpoint": {
      "enabled": "启用检查点保护",
      "description": "在执行高风险操作前自动创建检查点",
      "readOnly": {
        "label": "只读操作",
        "description": "对只读文件操作创建检查点"
      },
      "execute": {
        "label": "终端命令",
        "checkpointCommands": "需要检查点的命令",
        "noCheckpointCommands": "不需要检查点的命令",
        "commandPlaceholder": "输入命令前缀（如：rm -rf, git reset --hard）",
        "noCheckpointPlaceholder": "输入命令前缀（如：ls, pwd, git status）"
      },
      "strategy": {
        "label": "检查点策略",
        "beforeHighRisk": "高风险命令执行前创建检查点",
        "afterHighRisk": "高风险命令成功执行后创建检查点", 
        "onError": "命令执行失败时创建检查点"
      },
      "shellSpecific": {
        "label": "Shell特定配置",
        "powershell": "PowerShell配置",
        "bash": "Bash配置",
        "zsh": "Zsh配置", 
        "cmd": "CMD配置"
      }
    }
  }
}
```

## 测试策略

### 1. 单元测试

#### 检查点决策逻辑测试
```typescript
describe("shouldCreateCheckpoint", () => {
  it("should return false when checkpoint is disabled", () => {
    const settings = { checkpointEnabled: false }
    const result = shouldCreateCheckpoint("rm -rf /tmp", settings)
    expect(result.shouldCheckpoint).toBe(false)
    expect(result.reason).toBe("checkpoint_disabled")
  })
  
  it("should return true for high-risk commands", () => {
    const settings = { 
      checkpointEnabled: true,
      checkpointCommands: ["rm -rf"] 
    }
    const result = shouldCreateCheckpoint("rm -rf /tmp", settings)
    expect(result.shouldCheckpoint).toBe(true)
    expect(result.reason).toBe("command_required")
  })
})
```

### 2. 集成测试

#### 命令执行集成测试
```typescript
describe("executeCommandWithCheckpoint", () => {
  it("should create checkpoint before high-risk command", async () => {
    const mockTask = { checkpointSave: vi.fn() }
    const settings = { 
      checkpointEnabled: true,
      checkpointBeforeHighRisk: true,
      checkpointCommands: ["rm -rf"] 
    }
    
    await executeCommandInTerminal(mockTask, { command: "rm -rf /tmp" })
    expect(mockTask.checkpointSave).toHaveBeenCalled()
  })
})
```

## 总结

本设计提出了一个完整的用户自定义检查点配置系统，效仿了现有的命令授权UI机制，提供了：

1. **灵活的命令级别配置** - 支持用户自定义需要/不需要检查点的命令
2. **多Shell支持** - 针对不同Shell环境提供差异化配置
3. **智能检查点策略** - 基于风险等级和命令结果的检查点触发
4. **一致的用户体验** - 复用现有的UI组件和交互模式
5. **完整的测试覆盖** - 单元测试和集成测试确保功能可靠性

这个设计方案确保了检查点机制能够有效保护用户免受终端命令的风险，同时提供了用户友好的配置界面。