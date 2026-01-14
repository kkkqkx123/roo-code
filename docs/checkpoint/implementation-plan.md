# 检查点机制扩展实现方案

## 实现概述

基于前面的分析，本方案详细描述了如何实现用户可配置的检查点机制扩展，支持终端命令的检查点保护和多Shell环境。

## 实现步骤

### 阶段1: 基础架构扩展（1-2周）

#### 1.1 扩展设置系统

**目标**: 在现有设置系统中添加检查点配置

**实现文件**:
- `src/core/settings/CheckpointSettings.ts` - 检查点设置管理
- `src/core/settings/types.ts` - 扩展设置类型定义

**关键代码**:
```typescript
// 扩展设置类型
export interface CheckpointSettings {
  enabled?: boolean
  alwaysExecute?: boolean
  checkpointCommands?: string[]
  noCheckpointCommands?: string[]
  checkpointBeforeHighRisk?: boolean
  checkpointAfterHighRisk?: boolean
  checkpointOnError?: boolean
  shellSpecific?: Record<string, ShellCheckpointConfig>
}

// 添加到主设置接口
export interface Settings {
  // ... 现有设置
  checkpoint?: CheckpointSettings
}
```

#### 1.2 创建检查点决策引擎

**目标**: 实现检查点触发决策逻辑

**实现文件**: `src/core/checkpoint/CheckpointDecisionEngine.ts`

**核心算法**:
```typescript
export class CheckpointDecisionEngine {
  async shouldCreateCheckpoint(
    command: string,
    shellPath?: string
  ): Promise<CheckpointDecision> {
    const settings = await this.getCheckpointSettings()
    
    if (!settings.enabled) {
      return { shouldCheckpoint: false, reason: "disabled" }
    }
    
    const shellType = detectShellType(shellPath)
    const shellConfig = this.getShellConfig(settings, shellType)
    
    // 检查命令豁免
    if (this.isExemptedCommand(command, shellConfig)) {
      return { shouldCheckpoint: false, reason: "exempted" }
    }
    
    // 检查命令要求
    if (this.isRequiredCommand(command, shellConfig)) {
      return { shouldCheckpoint: true, reason: "required" }
    }
    
    // 基于风险等级决策
    const riskLevel = this.assessRisk(command, shellType)
    return this.decideByRisk(riskLevel, shellConfig)
  }
  
  private isExemptedCommand(command: string, config: ShellCheckpointConfig): boolean {
    return findLongestPrefixMatch(command, config.noCheckpointCommands || []) !== null
  }
  
  private isRequiredCommand(command: string, config: ShellCheckpointConfig): boolean {
    return findLongestPrefixMatch(command, config.checkpointCommands || []) !== null
  }
}
```

### 阶段2: UI组件实现（1-2周）

#### 2.1 创建检查点设置组件

**目标**: 实现效仿AutoApproveSettings的UI组件

**实现文件**: `webview-ui/src/components/settings/CheckpointSettings.tsx`

**组件结构**:
```typescript
// 复用AutoApproveSettings的设计模式
const CheckpointSettings = ({
  checkpointEnabled,
  alwaysCheckpointExecute,
  checkpointCommands,
  noCheckpointCommands,
  setCachedStateField
}: CheckpointSettingsProps) => {
  return (
    <Section>
      {/* 主开关 */}
      <VSCodeCheckbox checked={checkpointEnabled}>
        <span>启用检查点保护</span>
      </VSCodeCheckbox>
      
      {/* 分类开关 */}
      <CheckpointToggle
        alwaysCheckpointExecute={alwaysCheckpointExecute}
        onToggle={handleToggle}
      />
      
      {/* 命令配置 */}
      {alwaysCheckpointExecute && (
        <div className="pl-3 border-l-2">
          <CommandList
            title="需要检查点的命令"
            commands={checkpointCommands}
            onAdd={handleAddCheckpointCommand}
            onRemove={handleRemoveCheckpointCommand}
          />
          <CommandList
            title="不需要检查点的命令"
            commands={noCheckpointCommands}
            onAdd={handleAddNoCheckpointCommand}
            onRemove={handleRemoveNoCheckpointCommand}
          />
        </div>
      )}
    </Section>
  )
}
```

#### 2.2 集成到设置页面

**目标**: 将检查点设置添加到主设置页面

**修改文件**: `webview-ui/src/components/settings/Settings.tsx`

**集成代码**:
```typescript
// 在设置页面中添加检查点设置部分
const Settings = () => {
  return (
    <div className="space-y-6">
      {/* 现有设置 */}
      <AutoApproveSettings {...props} />
      
      {/* 新增检查点设置 */}
      <CheckpointSettings
        checkpointEnabled={extensionState.checkpointEnabled}
        alwaysCheckpointExecute={extensionState.alwaysCheckpointExecute}
        checkpointCommands={extensionState.checkpointCommands}
        noCheckpointCommands={extensionState.noCheckpointCommands}
        setCachedStateField={setCachedStateField}
      />
    </div>
  )
}
```

### 阶段3: 命令执行集成（1周）

#### 3.1 扩展ExecuteCommandTool

**目标**: 在命令执行前后添加检查点逻辑

**修改文件**: `src/core/tools/ExecuteCommandTool.ts`

**集成代码**:
```typescript
export async function executeCommandInTerminal(
  task: Task,
  options: ExecuteCommandOptions
): Promise<[boolean, ToolResponse]> {
  const decisionEngine = new CheckpointDecisionEngine()
  const decision = await decisionEngine.shouldCreateCheckpoint(
    options.command, 
    options.shell
  )
  
  // 执行前检查点
  if (decision.shouldCheckpoint && decision.beforeExecution) {
    await task.checkpointSave(false, true) // 静默保存
    task.log("info", `检查点已创建: ${decision.reason}`)
  }
  
  // 执行命令
  const result = await executeCommand(options)
  
  // 执行后检查点
  if (decision.shouldCheckpoint && decision.afterExecution && result.success) {
    await task.checkpointSave(false, true)
    task.log("info", `执行后检查点已创建`)
  }
  
  // 错误时检查点
  if (decision.shouldCheckpoint && decision.onError && !result.success) {
    await task.checkpointSave(false, true)
    task.log("info", `错误检查点已创建`)
  }
  
  return [true, result]
}
```

#### 3.2 扩展Task.checkpointSave

**目标**: 支持静默检查点保存

**修改文件**: `src/core/task/Task.ts`

**扩展代码**:
```typescript
public async checkpointSave(
  force: boolean = false, 
  suppressMessage: boolean = false
): Promise<void> {
  const result = await this.checkpointManager.checkpointSave(force)
  
  if (!suppressMessage && result.success) {
    this.log("info", "检查点已保存")
  }
  
  return result
}
```

### 阶段4: 多Shell支持（1周）

#### 4.1 Shell检测和配置

**目标**: 实现Shell类型检测和差异化配置

**实现文件**: `src/utils/shell-detection.ts`

**检测逻辑**:
```typescript
export function detectShellType(shellPath?: string): ShellType {
  if (!shellPath) return "bash" // 默认
  
  const path = shellPath.toLowerCase()
  
  if (path.includes("powershell") || path.includes("pwsh")) {
    return "powershell"
  } else if (path.includes("bash")) {
    return "bash"
  } else if (path.includes("zsh")) {
    return "zsh"
  } else if (path.includes("cmd") || path.includes("command")) {
    return "cmd"
  }
  
  return "bash" // 默认回退
}
```

#### 4.2 Shell特定风险规则

**目标**: 实现Shell特定的命令风险评估

**实现文件**: `src/core/checkpoint/shell-risk-rules.ts`

**规则定义**:
```typescript
export const shellRiskRules: Record<ShellType, RiskRule[]> = {
  powershell: [
    { pattern: "Remove-Item -Recurse -Force", risk: "high" },
    { pattern: "Set-ExecutionPolicy Unrestricted", risk: "high" },
    { pattern: "Invoke-Expression", risk: "medium" }
  ],
  bash: [
    { pattern: "rm -rf", risk: "high" },
    { pattern: "chmod -R 777", risk: "high" },
    { pattern: "git reset --hard", risk: "high" }
  ],
  // ... 其他shell规则
}
```

### 阶段5: 测试和验证（1周）

#### 5.1 单元测试

**目标**: 确保核心逻辑的正确性

**测试文件**: `src/core/checkpoint/__tests__/CheckpointDecisionEngine.test.ts`

**测试用例**:
```typescript
describe("CheckpointDecisionEngine", () => {
  let engine: CheckpointDecisionEngine
  
  beforeEach(() => {
    engine = new CheckpointDecisionEngine()
  })
  
  it("should not checkpoint when disabled", async () => {
    const settings = { enabled: false }
    vi.spyOn(engine, "getCheckpointSettings").mockResolvedValue(settings)
    
    const decision = await engine.shouldCreateCheckpoint("rm -rf /tmp")
    expect(decision.shouldCheckpoint).toBe(false)
  })
  
  it("should checkpoint for high-risk commands", async () => {
    const settings = { 
      enabled: true,
      checkpointCommands: ["rm -rf"] 
    }
    vi.spyOn(engine, "getCheckpointSettings").mockResolvedValue(settings)
    
    const decision = await engine.shouldCreateCheckpoint("rm -rf /tmp")
    expect(decision.shouldCheckpoint).toBe(true)
  })
})
```

#### 5.2 集成测试

**目标**: 验证命令执行集成

**测试文件**: `src/core/tools/__tests__/ExecuteCommandTool.test.ts`

**测试用例**:
```typescript
describe("executeCommandWithCheckpoint", () => {
  it("should create checkpoint for high-risk command", async () => {
    const mockTask = {
      checkpointSave: vi.fn().mockResolvedValue({ success: true }),
      log: vi.fn()
    }
    
    const mockEngine = {
      shouldCreateCheckpoint: vi.fn().mockResolvedValue({
        shouldCheckpoint: true,
        beforeExecution: true,
        reason: "high_risk"
      })
    }
    
    await executeCommandInTerminal(mockTask, { command: "rm -rf /tmp" })
    expect(mockTask.checkpointSave).toHaveBeenCalled()
  })
})
```

## 实现细节

### 1. 检查点触发时机

#### 执行前检查点
- **触发条件**: `checkpointBeforeHighRisk = true` 且命令被识别为高风险
- **目的**: 在执行可能破坏系统的命令前保存状态
- **实现**: 在命令执行前调用 `task.checkpointSave()`

#### 执行后检查点
- **触发条件**: `checkpointAfterHighRisk = true` 且命令成功执行
- **目的**: 在成功执行高风险命令后保存新状态
- **实现**: 在命令成功执行后调用 `task.checkpointSave()`

#### 错误时检查点
- **触发条件**: `checkpointOnError = true` 且命令执行失败
- **目的**: 在命令失败时保存错误状态用于调试
- **实现**: 在命令执行失败后调用 `task.checkpointSave()`

### 2. 命令匹配策略

#### 最长前缀匹配
复用现有的 `findLongestPrefixMatch` 函数：
```typescript
// 检查命令是否匹配检查点规则
function isCheckpointCommand(command: string, rules: string[]): boolean {
  return findLongestPrefixMatch(command, rules) !== null
}
```

#### 风险等级评估
```typescript
function assessCommandRisk(command: string, shellType: ShellType): RiskLevel {
  const rules = shellRiskRules[shellType]
  
  for (const rule of rules) {
    if (command.includes(rule.pattern)) {
      return rule.risk
    }
  }
  
  return "low" // 默认低风险
}
```

### 3. 用户配置管理

#### 设置持久化
使用现有的设置系统进行持久化：
```typescript
// 保存检查点设置
async function saveCheckpointSettings(settings: CheckpointSettings) {
  await vscode.postMessage({
    type: "updateSettings",
    updatedSettings: { checkpoint: settings }
  })
}
```

#### 配置验证
```typescript
function validateCheckpointSettings(settings: CheckpointSettings): ValidationResult {
  const errors: string[] = []
  
  if (settings.checkpointCommands?.some(cmd => !cmd.trim())) {
    errors.push("检查点命令不能为空")
  }
  
  return { valid: errors.length === 0, errors }
}
```

## 部署和发布

### 1. 版本兼容性

#### 向后兼容
- 保持现有检查点机制不变
- 新增功能默认禁用，需要用户显式启用
- 现有API保持不变

#### 设置迁移
```typescript
// 迁移现有设置到新格式
function migrateCheckpointSettings(oldSettings: any): CheckpointSettings {
  return {
    enabled: oldSettings.checkpointEnabled ?? false,
    alwaysExecute: oldSettings.alwaysCheckpointExecute ?? true,
    checkpointCommands: oldSettings.checkpointCommands ?? [],
    // ... 其他默认值
  }
}
```

### 2. 性能考虑

#### 检查点频率控制
```typescript
// 避免频繁检查点
const MIN_CHECKPOINT_INTERVAL = 5000 // 5秒
let lastCheckpointTime = 0

async function createCheckpointIfNeeded(task: Task): Promise<void> {
  const now = Date.now()
  if (now - lastCheckpointTime < MIN_CHECKPOINT_INTERVAL) {
    return // 避免过于频繁
  }
  
  await task.checkpointSave(false, true)
  lastCheckpointTime = now
}
```

#### 异步执行
检查点保存应该异步执行，不阻塞命令执行：
```typescript
// 异步创建检查点
function createCheckpointAsync(task: Task): void {
  task.checkpointSave(false, true).catch(error => {
    task.log("error", `检查点保存失败: ${error.message}`)
  })
}
```

## 风险缓解

### 1. 误报处理

#### 安全模式
提供安全模式，在不确定时询问用户：
```typescript
async function shouldCheckpointWithConfirmation(
  command: string,
  decision: CheckpointDecision
): Promise<boolean> {
  if (decision.shouldCheckpoint && decision.confidence < 0.8) {
    // 低置信度时询问用户
    return await showCheckpointConfirmationDialog(command)
  }
  
  return decision.shouldCheckpoint
}
```

#### 学习机制
记录用户决策，改进风险评估：
```typescript
function learnFromUserDecision(
  command: string,
  userDecision: boolean,
  predictedRisk: RiskLevel
): void {
  // 更新风险评估模型
  riskAssessmentModel.update(command, userDecision, predictedRisk)
}
```

### 2. 错误处理

#### 检查点失败处理
```typescript
async function safeCheckpointSave(task: Task): Promise<boolean> {
  try {
    await task.checkpointSave(false, true)
    return true
  } catch (error) {
    task.log("error", `检查点保存失败: ${error.message}`)
    return false
  }
}
```

#### 降级策略
检查点失败时提供降级选项：
```typescript
async function executeWithFallback(task: Task, command: string): Promise<void> {
  const checkpointSuccess = await safeCheckpointSave(task)
  
  if (!checkpointSuccess) {
    const proceed = await showCheckpointFailedDialog(command)
    if (!proceed) {
      throw new Error("用户取消命令执行")
    }
  }
  
  await executeCommand(command)
}
```

## 总结

本实现方案提供了一个完整的检查点机制扩展，具有以下特点：

1. **用户友好**: 效仿现有UI设计，提供直观的配置界面
2. **灵活配置**: 支持命令级别和多Shell环境的精细化配置
3. **智能决策**: 基于风险等级和用户配置的智能检查点触发
4. **健壮可靠**: 完善的错误处理和降级策略
5. **性能优化**: 避免频繁检查点，异步执行不阻塞
6. **向后兼容**: 保持现有功能不变，平滑升级

通过分阶段实施，可以确保功能的稳定性和质量，同时最小化对现有系统的影响。