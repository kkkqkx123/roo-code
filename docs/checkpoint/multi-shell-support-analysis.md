# 多Shell支持需求分析

## 现有Shell支持分析

### Shell检测与配置
**位置**: `src/utils/shell.ts`

**关键功能**:
```typescript
export function detectShellType(shellPath?: string): ShellType {
  // 基于shell路径检测类型
  if (shellPath?.includes('powershell')) return 'powershell'
  if (shellPath?.includes('bash')) return 'bash'
  if (shellPath?.includes('zsh')) return 'zsh'
  if (shellPath?.includes('cmd')) return 'cmd'
  return 'unknown'
}
```

### 终端设置组件
**位置**: `webview-ui/src/components/settings/TerminalSettings.tsx`

**支持的Shell配置**:
- PowerShell计数器设置
- Zsh配置（Oh My Zsh, p10k, zdotdir）
- 通用终端设置

## Shell环境差异分析

### 命令语法差异

#### 1. 文件操作
**Bash/Zsh**:
```bash
rm -rf /path          # 递归强制删除
cp -r source dest     # 递归复制
```

**PowerShell**:
```powershell
Remove-Item -Recurse -Force path  # 递归强制删除
Copy-Item -Recurse source dest    # 递归复制
```

**CMD**:
```cmd
del /s /q /f *        # 递归静默强制删除
xcopy source dest /s  # 递归复制
```

#### 2. 变量和参数
**Bash/Zsh**:
```bash
$VAR                  # 变量引用
${VAR}                # 明确变量引用
```

**PowerShell**:
```powershell
$VAR                  # 变量引用
${VAR}                # 明确变量引用（较少使用）
```

#### 3. 命令执行
**Bash/Zsh**:
```bash
$(command)            # 命令替换
`command`             # 反引号命令替换
```

**PowerShell**:
```powershell
$(command)            # 子表达式
& { command }         # 调用操作符
```

### 风险模式差异

#### PowerShell特有风险
- **执行策略**: `Set-ExecutionPolicy` 可能降低安全性
- **远程执行**: `Invoke-Command` 支持远程命令执行
- **脚本块**: `{ }` 块可能包含危险代码

#### Bash/Zsh特有风险
- **通配符扩展**: `*` 可能匹配意外文件
- **管道炸弹**: `:(){ :|:& };:` fork炸弹
- **重定向覆盖**: `> file` 可能覆盖重要文件

#### CMD特有风险
- **无确认删除**: `/q` 参数跳过确认
- **系统命令**: 某些命令直接修改系统

## 检查点策略差异化需求

### 1. 命令识别差异

#### 高风险命令映射
```typescript
const highRiskCommands = {
  powershell: [
    'Remove-Item -Recurse -Force',
    'Set-ExecutionPolicy Unrestricted',
    'Invoke-Expression'
  ],
  bash: [
    'rm -rf',
    'chmod -R 777',
    'git reset --hard'
  ],
  zsh: [
    'rm -rf',
    'chmod -R 777', 
    'git reset --hard'
  ],
  cmd: [
    'del /s /q /f',
    'rd /s /q',
    'format'
  ]
}
```

### 2. 参数解析差异

#### PowerShell参数风格
- **命名参数**: `-Parameter Value`
- **布尔参数**: `-Force`（无值）
- **位置参数**: 较少使用

#### Unix参数风格
- **短参数**: `-r -f` 或 `-rf`
- **长参数**: `--recursive --force`
- **组合参数**: `-rf` 等效于 `-r -f`

### 3. 环境变量差异

#### 路径分隔符
- **Unix**: `/`
- **Windows**: `\`

#### 变量引用
- **Unix**: `$VAR` 或 `${VAR}`
- **PowerShell**: `$VAR` 或 `$env:VAR`
- **CMD**: `%VAR%`

## 用户界面设计需求

### 1. Shell选择界面

#### 效仿TerminalSettings设计
```typescript
export const ShellSpecificCheckpointSettings = ({
  shellSpecificCheckpoints,
  setCachedStateField
}) => {
  const [selectedShell, setSelectedShell] = useState("powershell")
  
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <label>Shell特定配置</label>
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
    </div>
  )
}
```

### 2. 命令示例展示

#### 基于Shell的命令示例
```typescript
const commandExamples = {
  powershell: [
    'Remove-Item -Recurse -Force C:\\temp',
    'Set-ExecutionPolicy Unrestricted',
    'Invoke-Expression "Get-Process"'
  ],
  bash: [
    'rm -rf /tmp/files',
    'chmod -R 777 /var/www',
    'git reset --hard HEAD~1'
  ],
  zsh: [
    'rm -rf ~/Downloads/*',
    'chown -R user:group /opt/app',
    'find . -name "*.tmp" -delete'
  ],
  cmd: [
    'del /s /q /f C:\\temp\\*',
    'rd /s /q C:\\old_directory',
    'format D: /q'
  ]
}
```

## 技术实现方案

### 1. Shell类型检测

#### 集成现有检测逻辑
```typescript
import { detectShellType } from '../../utils/shell'

export function getShellSpecificCheckpointSettings(
  command: string, 
  shellType: ShellType,
  settings: CheckpointSettings
): ShellCheckpointConfig {
  const shellConfig = settings.shellSpecificCheckpoints?.[shellType]
  return shellConfig || settings.defaultCheckpointConfig
}
```

### 2. 命令解析器

#### 多Shell命令解析
```typescript
export function parseCommandForCheckpoint(
  command: string, 
  shellType: ShellType
): ParsedCommand {
  switch (shellType) {
    case 'powershell':
      return parsePowerShellCommand(command)
    case 'bash':
    case 'zsh':
      return parseUnixCommand(command)
    case 'cmd':
      return parseCmdCommand(command)
    default:
      return parseGenericCommand(command)
  }
}
```

### 3. 风险评估引擎

#### Shell特定风险评估
```typescript
export function assessCommandRisk(
  command: string, 
  shellType: ShellType
): RiskLevel {
  const parsed = parseCommandForCheckpoint(command, shellType)
  
  // Shell特定的风险规则
  const shellRules = riskRules[shellType]
  const riskScore = calculateRiskScore(parsed, shellRules)
  
  return mapScoreToRiskLevel(riskScore)
}
```

## 配置存储方案

### 1. 设置结构设计

#### 效仿现有设置模式
```typescript
interface CheckpointSettings {
  checkpointEnabled?: boolean
  // ... 通用设置
  
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
  // Shell特定设置...
}
```

### 2. 默认配置

#### 基于Shell的默认设置
```typescript
const defaultShellConfigs = {
  powershell: {
    checkpointCommands: [
      'Remove-Item -Recurse -Force',
      'Set-ExecutionPolicy',
      'Invoke-Expression'
    ],
    checkpointBeforeHighRisk: true
  },
  bash: {
    checkpointCommands: [
      'rm -rf',
      'chmod -R',
      'git reset --hard'
    ],
    checkpointBeforeHighRisk: true
  },
  // ... 其他shell配置
}
```

## 总结

多Shell支持是检查点机制扩展的关键需求。不同Shell环境在命令语法、风险模式和用户习惯上存在显著差异。通过效仿现有的TerminalSettings组件设计，可以实现用户友好的Shell特定配置界面，确保检查点机制在各种Shell环境下都能提供有效的保护。