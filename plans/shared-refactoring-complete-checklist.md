# Shared 目录重构完整任务清单

> **目标**：将 `src/shared` 目录中的特定模块功能整合到相应模块内部，减少跨层依赖，避免循环依赖
> **创建时间**：2026-01-21
> **预计工期**：3-4 周（分阶段执行）

---

## 目录

- [一、重构原则](#一重构原则)
- [二、文件分类清单](#二文件分类清单)
- [三、阶段 0：准备工作](#三阶段-0准备工作)
- [四、阶段 1：类型与配置分离](#四阶段-1类型与配置分离)
- [五、阶段 2：高优先级模块迁移](#五阶段-2高优先级模块迁移)
- [六、阶段 3：中优先级模块迁移](#六阶段-3中优先级模块迁移)
- [七、阶段 4：低优先级模块迁移](#七阶段-4低优先级模块迁移)
- [八、阶段 5：清理与优化](#八阶段-5清理与优化)
- [九、迁移检查清单](#九迁移检查清单)
- [十、风险评估与应对](#十风险评估与应对)

---

## 一、重构原则

### 1.1 核心原则

- **`shared/types` 只包含纯类型定义**：不包含配置数据、常量、工具函数
- **类型与配置分离**：将配置数据和工具函数移到相应模块内部
- **避免循环依赖**：`shared` 层不依赖 `src/core` 或 `src/services` 层
- **保持向后兼容**：通过重新导出保持 API 稳定
- **渐进式迁移**：分阶段进行，每次迁移后充分测试

### 1.2 依赖规则

```
webview-ui (前端)
    ↓ 依赖
src/shared/* (共享层 - 纯类型 + 通用工具)
    ↓ 依赖
src/core/*, src/services/*, src/api/* (核心层)
```

**禁止**：
- `src/shared` 依赖 `src/core`
- `src/shared` 依赖 `src/services`
- `src/shared` 依赖 `src/api`

---

## 二、文件分类清单

### 2.1 保留在 shared 的文件（通用工具）

| 文件 | 原因 | 依赖情况 |
|------|------|----------|
| `shared/array.ts` | 通用数组工具函数 | 无特定模块依赖 |
| `shared/safeJsonParse.ts` | 通用 JSON 解析工具 | 无特定模块依赖 |
| `shared/language.ts` | 语言配置 | 无特定模块依赖 |
| `shared/globalFileNames.ts` | 全局文件名常量 | 无特定模块依赖 |
| `shared/types/*` | 纯类型定义 | 需要分离配置和函数 |

### 2.2 需要迁移的文件（特定模块功能）

#### 高优先级（立即执行）

| 原文件 | 目标位置 | 迁移内容 | 影响范围 |
|---------|----------|----------|----------|
| `shared/vsCodeSelectorUtils.ts` | `src/utils/vsCodeSelectorUtils.ts` | VS Code 选择器工具 | 小 |
| `shared/api.ts` | `src/api/api-utils.ts` | API 工具函数 | 中 |
| `shared/modes.ts` | `src/core/modes/mode-utils.ts` | Mode 工具函数 | 中 |
| `shared/mcp.ts` | `src/services/mcp/mcp-types.ts` | MCP 类型定义 | 中 |
| `shared/tools.ts` | `src/core/tools/tool-config.ts` | Tool 配置 | 中 |
| `shared/checkExistApiConfig.ts` | `src/core/providers/config-utils.ts` | API 配置检查 | 中 |

#### 中优先级（后续执行）

| 原文件 | 目标位置 | 迁移内容 | 影响范围 |
|---------|----------|----------|----------|
| `shared/combineApiRequests.ts` | `src/core/task/managers/api/message-utils.ts` | API 请求合并 | 中 |
| `shared/combineCommandSequences.ts` | `src/core/task/managers/messaging/message-utils.ts` | 命令序列合并 | 中 |
| `shared/getApiMetrics.ts` | `src/core/task/managers/monitoring/metrics-utils.ts` | API 指标计算 | 中 |
| `shared/support-prompt.ts` | `src/core/prompts/support-prompt.ts` | 支持提示词 | 中 |
| `shared/embeddingModels.ts` | `src/services/code-index/embedding-models.ts` | 嵌入模型配置 | 中 |
| `shared/context-mentions.ts` | `src/utils/context-mentions.ts` | 上下文提及 | 中 |

#### 低优先级（可选）

| 原文件 | 目标位置 | 迁移内容 | 影响范围 |
|---------|----------|----------|----------|
| `shared/experiments.ts` | `src/core/experiments/experiment-utils.ts` | 实验配置 | 低 |
| `shared/cost.ts` | `src/api/cost-utils.ts` | 成本计算 | 低 |
| `shared/browserUtils.ts` | `src/core/webview/browser-utils.ts` | 浏览器工具 | 低 |
| `shared/parse-command.ts` | `src/core/tools/command-parser.ts` | 命令解析 | 低 |
| `shared/todo.ts` | `src/core/task/managers/todo-utils.ts` | Todo 工具 | 低 |

### 2.3 需要分离的 types 文件

| 原文件 | 需要移出的内容 | 目标位置 |
|---------|----------------|----------|
| `types/mode.ts` | `DEFAULT_MODES` 常量 | `src/core/modes/default-modes.ts` |
| `types/tool.ts` | `isNativeProtocol()`, `getEffectiveProtocol()` 函数 | `src/core/tools/tool-utils.ts` |
| `types/codebase-index.ts` | `CODEBASE_INDEX_DEFAULTS`, `VECTOR_STORAGE_PRESETS`, `DEFAULT_VECTOR_STORAGE_CONFIG` | `src/services/code-index/config.ts` |
| `types/global-settings.ts` | `DEFAULT_WRITE_DELAY_MS`, `DEFAULT_TERMINAL_OUTPUT_CHARACTER_LIMIT` 等常量 | `src/core/constants/default-values.ts` |
| `types/message.ts` | `isBlockingAsk()`, `isNonBlockingAsk()`, `isMutableAsk()` 函数 | `src/core/task/managers/messaging/message-utils.ts` |

---

## 三、阶段 0：准备工作

### 3.1 创建新目录结构

```bash
# 创建新的目录
mkdir -p src/core/constants
mkdir -p src/core/modes
mkdir -p src/core/tools
mkdir -p src/core/experiments
mkdir -p src/utils
mkdir -p src/services/code-index
```

### 3.2 备份现有代码

```bash
# 创建备份分支
git checkout -b backup-before-refactoring

# 或者创建备份文件
cp -r src/shared src/shared.backup
```

### 3.3 更新 tsconfig 路径映射

在 `tsconfig.json` 中添加路径别名：

```json
{
  "compilerOptions": {
    "paths": {
      "@core/*": ["src/core/*"],
      "@services/*": ["src/services/*"],
      "@api/*": ["src/api/*"],
      "@utils/*": ["src/utils/*"]
    }
  }
}
```

### 3.4 准备测试环境

```bash
# 确保所有测试通过
pnpm test

# 确保类型检查通过
pnpm check-types

# 确保 lint 通过
pnpm lint
```

---

## 四、阶段 1：类型与配置分离

**目标**：将 `shared/types` 中的配置数据和工具函数分离到相应模块

### 4.1 分离 types/mode.ts

#### 任务 1.1.1：创建 src/core/modes/default-modes.ts

```typescript
import type { ModeConfig } from "@shared/types"

export const DEFAULT_MODES: readonly ModeConfig[] = [
  {
    slug: "architect",
    name: "🏗️ Architect",
    roleDefinition: "You are Roo, an experienced technical leader who is inquisitive and an excellent planner...",
    whenToUse: "Use this mode when you need to plan, design, or strategize before implementation...",
    description: "Plan and design before implementation",
    groups: ["read", ["edit", { fileRegex: "\\.md$", description: "Markdown files only" }], "browser", "mcp"],
    customInstructions: "1. Do some information gathering...",
  },
  {
    slug: "code",
    name: "💻 Code",
    roleDefinition: "You are Roo, a highly skilled software engineer...",
    whenToUse: "Use this mode when you need to write, modify, or refactor code...",
    description: "Write, modify, and refactor code",
    groups: ["read", "edit", "browser", "command", "mcp"],
  },
  {
    slug: "ask",
    name: "❓ Ask",
    roleDefinition: "You are Roo, a knowledgeable technical assistant...",
    whenToUse: "Use this mode when you need explanations, documentation, or answers...",
    description: "Get answers and explanations",
    groups: ["read", "browser", "mcp"],
    customInstructions: "You can analyze code, explain concepts...",
  },
  {
    slug: "debug",
    name: "🪲 Debug",
    roleDefinition: "You are Roo, an expert software debugger...",
    whenToUse: "Use this mode when you're troubleshooting issues...",
    description: "Diagnose and fix software issues",
    groups: ["read", "edit", "browser", "command", "mcp"],
    customInstructions: "Reflect on 5-7 different possible sources...",
  },
  {
    slug: "orchestrator",
    name: "🪃 Orchestrator",
    roleDefinition: "You are Roo, a strategic workflow orchestrator...",
    whenToUse: "Use this mode for complex, multi-step projects...",
    description: "Coordinate tasks across multiple modes",
    groups: ["coordinator"],
    customInstructions: "Your role is to coordinate complex workflows...",
  },
] as const
```

#### 任务 1.1.2：修改 shared/types/mode.ts

**移除**：
```typescript
export const DEFAULT_MODES: readonly ModeConfig[] = [...]
```

**保留**：
```typescript
export type ModeConfig = ...
export type PromptComponent = ...
export type CustomModePrompts = ...
export type CustomSupportPrompts = ...
export type CustomModesSettings = ...
```

#### 任务 1.1.3：更新 shared/modes.ts

**修改导入**：
```typescript
// 从 @shared/types 改为从本地导入
import { DEFAULT_MODES } from "../core/modes/default-modes"
import type { ModeConfig, PromptComponent, CustomModePrompts } from "@shared/types"
```

### 4.2 分离 types/tool.ts

#### 任务 1.2.1：创建 src/core/tools/tool-utils.ts

```typescript
import { TOOL_PROTOCOL, ToolProtocol } from "@shared/types"

export function isNativeProtocol(protocol: ToolProtocol): boolean {
  return protocol === TOOL_PROTOCOL.NATIVE
}

export function getEffectiveProtocol(toolProtocol?: ToolProtocol): ToolProtocol {
  return toolProtocol || TOOL_PROTOCOL.XML
}
```

#### 任务 1.2.2：修改 shared/types/tool.ts

**移除**：
```typescript
export function isNativeProtocol(protocol: ToolProtocol): boolean {
  return protocol === TOOL_PROTOCOL.NATIVE
}

export function getEffectiveProtocol(toolProtocol?: ToolProtocol): ToolProtocol {
  return toolProtocol || TOOL_PROTOCOL.XML
}
```

**保留**：
```typescript
export type ToolName = ...
export type ToolUsage = ...
export const TOOL_PROTOCOL = ...
export const toolGroups = ...
export const toolNames = ...
```

#### 任务 1.2.3：更新所有使用这些函数的文件

**需要更新的文件**：
- `src/core/tools/simpleReadFileTool.ts`
- `src/core/tools/validateToolUse.ts`
- `src/core/tools/helpers/toolResultFormatting.ts`
- `src/integrations/editor/DiffViewProvider.ts`
- `src/core/task/managers/context/ContextManager.ts`

**修改导入**：
```typescript
// 从 @shared/types 改为从工具模块导入
import { isNativeProtocol, getEffectiveProtocol } from "@core/tools/tool-utils"
```

### 4.3 分离 types/codebase-index.ts

#### 任务 1.3.1：创建 src/services/code-index/config.ts

```typescript
export const CODEBASE_INDEX_DEFAULTS = {
  MIN_SEARCH_RESULTS: 10,
  MAX_SEARCH_RESULTS: 200,
  DEFAULT_SEARCH_RESULTS: 50,
  SEARCH_RESULTS_STEP: 10,
  MIN_SEARCH_SCORE: 0,
  MAX_SEARCH_SCORE: 1,
  DEFAULT_SEARCH_MIN_SCORE: 0.4,
  SEARCH_SCORE_STEP: 0.05,
} as const

export const VECTOR_STORAGE_PRESETS: Record<string, VectorStorageConfig> = {
  tiny: {
    mode: "preset",
    preset: "tiny",
    customConfig: {
      vectors: { on_disk: true },
      wal: { capacity_mb: 16, segments: 1 },
    },
  },
  small: {
    mode: "preset",
    preset: "small",
    customConfig: {
      hnsw: { m: 16, ef_construct: 128, on_disk: true },
      vectors: { on_disk: true },
      wal: { capacity_mb: 32, segments: 2 },
    },
  },
  medium: {
    mode: "preset",
    preset: "medium",
    customConfig: {
      hnsw: { m: 24, ef_construct: 256, on_disk: true },
      vectors: { on_disk: true },
      wal: { capacity_mb: 64, segments: 4 },
    },
  },
  large: {
    mode: "preset",
    preset: "large",
    customConfig: {
      hnsw: { m: 32, ef_construct: 256, on_disk: true },
      vectors: {
        on_disk: true,
        quantization: { enabled: true, type: "scalar", bits: 8 },
      },
      wal: { capacity_mb: 128, segments: 8 },
    },
  },
}

export const DEFAULT_VECTOR_STORAGE_CONFIG: VectorStorageConfig = {
  mode: "auto",
  thresholds: {
    tiny: 2000,
    small: 10000,
    medium: 100000,
    large: 1000000,
  },
}
```

#### 任务 1.3.2：修改 shared/types/codebase-index.ts

**移除**：
```typescript
export const CODEBASE_INDEX_DEFAULTS = {...}
export const VECTOR_STORAGE_PRESETS = {...}
export const DEFAULT_VECTOR_STORAGE_CONFIG = {...}
```

**保留**：
```typescript
export type VectorStorageConfig = ...
export type CodebaseIndexConfig = ...
export type CodebaseIndexModels = ...
export type CodebaseIndexProvider = ...
```

### 4.4 分离 types/global-settings.ts

#### 任务 1.4.1：创建 src/core/constants/default-values.ts

```typescript
export const DEFAULT_WRITE_DELAY_MS = 1000

export const DEFAULT_TERMINAL_OUTPUT_CHARACTER_LIMIT = 50_000

export const MIN_CHECKPOINT_TIMEOUT_SECONDS = 10

export const MAX_CHECKPOINT_TIMEOUT_SECONDS = 60

export const DEFAULT_CHECKPOINT_TIMEOUT_SECONDS = 15

export const DEFAULT_CONSECUTIVE_MISTAKE_LIMIT = 3
```

#### 任务 1.4.2：修改 shared/types/global-settings.ts

**移除**：
```typescript
export const DEFAULT_WRITE_DELAY_MS = 1000
export const DEFAULT_TERMINAL_OUTPUT_CHARACTER_LIMIT = 50_000
export const MIN_CHECKPOINT_TIMEOUT_SECONDS = 10
export const MAX_CHECKPOINT_TIMEOUT_SECONDS = 60
export const DEFAULT_CHECKPOINT_TIMEOUT_SECONDS = 15
```

**保留**：
```typescript
export type RooCodeSettings = ...
export const globalSettingsSchema = ...
```

#### 任务 1.4.3：更新所有使用这些常量的文件

**需要更新的文件**：
- `src/core/tools/WriteToFileTool.ts`
- `src/core/tools/SearchReplaceTool.ts`
- `src/core/tools/SearchAndReplaceTool.ts`
- `src/core/tools/EditFileTool.ts`
- `src/core/tools/ApplyDiffTool.ts`
- `src/core/tools/ApplyPatchTool.ts`
- `src/core/tools/ExecuteCommandTool.ts`
- `src/core/environment/getEnvironmentDetails.ts`
- `src/integrations/editor/DiffViewProvider.ts`

**修改导入**：
```typescript
// 从 @shared/types 改为从常量模块导入
import { DEFAULT_WRITE_DELAY_MS } from "@core/constants/default-values"
```

### 4.5 分离 types/message.ts

#### 任务 1.5.1：创建 src/core/task/managers/messaging/message-utils.ts

```typescript
import type { ClineAsk, BlockingAsk, NonBlockingAsk, MutableAsk } from "@shared/types"

export const blockingAsks = [
  "followup",
  "command",
  "tool",
  "browser_action_launch",
  "use_mcp_server",
] as const satisfies readonly ClineAsk[]

export type BlockingAsk = (typeof blockingAsks)[number]

export function isBlockingAsk(ask: ClineAsk): ask is BlockingAsk {
  return (blockingAsks as readonly ClineAsk[]).includes(ask)
}

export const nonBlockingAsks = [
  "command_output",
] as const satisfies readonly ClineAsk[]

export type NonBlockingAsk = (typeof nonBlockingAsks)[number]

export function isNonBlockingAsk(ask: ClineAsk): ask is NonBlockingAsk {
  return (nonBlockingAsks as readonly ClineAsk[]).includes(ask)
}

export const mutableAsks = ["resume_task"] as const satisfies readonly ClineAsk[]

export type MutableAsk = (typeof mutableAsks)[number]

export function isMutableAsk(ask: ClineAsk): ask is MutableAsk {
  return (mutableAsks as readonly ClineAsk[]).includes(ask)
}
```

#### 任务 1.5.2：修改 shared/types/message.ts

**移除**：
```typescript
export const blockingAsks = [...]
export type BlockingAsk = ...
export function isBlockingAsk(ask: ClineAsk): ask is BlockingAsk {...}
export const nonBlockingAsks = [...]
export type NonBlockingAsk = ...
export function isNonBlockingAsk(ask: ClineAsk): ask is NonBlockingAsk {...}
export const mutableAsks = [...]
export type MutableAsk = ...
export function isMutableAsk(ask: ClineAsk): ask is MutableAsk {...}
```

**保留**：
```typescript
export type ClineAsk = ...
export const clineAsks = ...
export const clineAskSchema = ...
```

### 4.6 阶段 1 验证

```bash
# 运行测试
pnpm test

# 运行类型检查
pnpm check-types

# 运行 lint
pnpm lint

# 提交代码
git add .
git commit -m "feat: separate types from configurations in shared/types"
```

---

## 五、阶段 2：高优先级模块迁移

**目标**：迁移高优先级的特定模块功能到相应位置

### 5.1 迁移 vsCodeSelectorUtils.ts

#### 任务 2.1.1：移动文件

```bash
mv src/shared/vsCodeSelectorUtils.ts src/utils/vsCodeSelectorUtils.ts
```

#### 任务 2.1.2：更新导入路径

**需要更新的文件**：
- 搜索所有使用 `@shared/vsCodeSelectorUtils` 的文件

**修改导入**：
```typescript
// 从
import { stringifyVsCodeLmModelSelector } from "@shared/vsCodeSelectorUtils"

// 改为
import { stringifyVsCodeLmModelSelector } from "@utils/vsCodeSelectorUtils"
```

#### 任务 2.1.3：删除原文件

```bash
rm src/shared/vsCodeSelectorUtils.ts
```

### 5.2 迁移 api.ts

#### 任务 2.2.1：移动文件

```bash
mv src/shared/api.ts src/api/api-utils.ts
```

#### 任务 2.2.2：更新导入路径

**需要更新的文件**：
- 搜索所有使用 `@shared/api` 的文件

**修改导入**：
```typescript
// 从
import { shouldUseReasoningBudget, getModelMaxOutputTokens } from "@shared/api"

// 改为
import { shouldUseReasoningBudget, getModelMaxOutputTokens } from "@api/api-utils"
```

#### 任务 2.2.3：删除原文件

```bash
rm src/shared/api.ts
```

### 5.3 迁移 modes.ts

#### 任务 2.3.1：移动文件

```bash
mv src/shared/modes.ts src/core/modes/mode-utils.ts
```

#### 任务 2.3.2：更新导入路径

**需要更新的文件**：
- `webview-ui/src/context/ExtensionStateContext.tsx`
- `webview-ui/src/components/modes/ModesView.tsx`
- `webview-ui/src/components/modes/__tests__/ModesView.import-switch.spec.tsx`
- `src/core/prompts/sections/modes.ts`

**修改导入**：
```typescript
// 从
import { modes, defaultModeSlug, defaultPrompts } from "@shared/modes"

// 改为
import { modes, defaultModeSlug, defaultPrompts } from "@core/modes/mode-utils"
```

#### 任务 2.3.3：删除原文件

```bash
rm src/shared/modes.ts
```

### 5.4 迁移 mcp.ts

#### 任务 2.4.1：移动文件

```bash
mv src/shared/mcp.ts src/services/mcp/mcp-types.ts
```

#### 任务 2.4.2：更新导入路径

**需要更新的文件**：
- `webview-ui/src/utils/mcp.ts`
- `webview-ui/src/context/ExtensionStateContext.tsx`
- `webview-ui/src/components/mcp/McpView.tsx`
- `webview-ui/src/components/mcp/McpToolRow.tsx`
- `webview-ui/src/components/mcp/McpErrorRow.tsx`
- `webview-ui/src/components/mcp/McpResourceRow.tsx`

**修改导入**：
```typescript
// 从
import { McpServer, McpTool, McpResource } from "@shared/mcp"

// 改为
import { McpServer, McpTool, McpResource } from "@services/mcp/mcp-types"
```

#### 任务 2.4.3：删除原文件

```bash
rm src/shared/mcp.ts
```

### 5.5 迁移 tools.ts

#### 任务 2.5.1：移动文件

```bash
mv src/shared/tools.ts src/core/tools/tool-config.ts
```

#### 任务 2.5.2：更新导入路径

**需要更新的文件**：
- `webview-ui/src/components/modes/ToolDetails.tsx`
- `webview-ui/src/components/modes/ModesView.tsx`
- `src/core/modes/mode-utils.ts`
- `src/core/prompts/tools/index.ts`

**修改导入**：
```typescript
// 从
import { TOOL_GROUPS, ALWAYS_AVAILABLE_TOOLS } from "@shared/tools"

// 改为
import { TOOL_GROUPS, ALWAYS_AVAILABLE_TOOLS } from "@core/tools/tool-config"
```

#### 任务 2.5.3：删除原文件

```bash
rm src/shared/tools.ts
```

### 5.6 迁移 checkExistApiConfig.ts

#### 任务 2.6.1：移动文件

```bash
mv src/shared/checkExistApiConfig.ts src/core/providers/config-utils.ts
```

#### 任务 2.6.2：更新导入路径

**需要更新的文件**：
- `webview-ui/src/context/ExtensionStateContext.tsx`

**修改导入**：
```typescript
// 从
import { checkExistKey } from "@shared/checkExistApiConfig"

// 改为
import { checkExistKey } from "@core/providers/config-utils"
```

#### 任务 2.6.3：删除原文件

```bash
rm src/shared/checkExistApiConfig.ts
```

### 5.7 阶段 2 验证

```bash
# 运行测试
pnpm test

# 运行类型检查
pnpm check-types

# 运行 lint
pnpm lint

# 提交代码
git add .
git commit -m "refactor: migrate high-priority modules from shared to core"
```

---

## 六、阶段 3：中优先级模块迁移

**目标**：迁移中优先级的特定模块功能到相应位置

### 6.1 迁移 combineApiRequests.ts

#### 任务 3.1.1：移动文件

```bash
mv src/shared/combineApiRequests.ts src/core/task/managers/api/message-utils.ts
```

#### 任务 3.1.2：更新导入路径

**需要更新的文件**：
- `src/core/task/managers/monitoring/UsageTracker.ts`

**修改导入**：
```typescript
// 从
import { combineApiRequests } from "@shared/combineApiRequests"

// 改为
import { combineApiRequests } from "@core/task/managers/api/message-utils"
```

#### 任务 3.1.3：删除原文件

```bash
rm src/shared/combineApiRequests.ts
```

### 6.2 迁移 combineCommandSequences.ts

#### 任务 3.2.1：移动文件

```bash
mv src/shared/combineCommandSequences.ts src/core/task/managers/messaging/message-utils.ts
```

#### 任务 3.2.2：更新导入路径

**需要更新的文件**：
- `src/core/task/managers/monitoring/UsageTracker.ts`

**修改导入**：
```typescript
// 从
import { combineCommandSequences } from "@shared/combineCommandSequences"

// 改为
import { combineCommandSequences } from "@core/task/managers/messaging/message-utils"
```

#### 任务 3.2.3：删除原文件

```bash
rm src/shared/combineCommandSequences.ts
```

### 6.3 迁移 getApiMetrics.ts

#### 任务 3.3.1：移动文件

```bash
mv src/shared/getApiMetrics.ts src/core/task/managers/monitoring/metrics-utils.ts
```

#### 任务 3.3.2：更新导入路径

**需要更新的文件**：
- `src/core/task/managers/monitoring/UsageTracker.ts`

**修改导入**：
```typescript
// 从
import { getApiMetrics, hasTokenUsageChanged, hasToolUsageChanged } from "@shared/getApiMetrics"

// 改为
import { getApiMetrics, hasTokenUsageChanged, hasToolUsageChanged } from "@core/task/managers/monitoring/metrics-utils"
```

#### 任务 3.3.3：删除原文件

```bash
rm src/shared/getApiMetrics.ts
```

### 6.4 迁移 support-prompt.ts

#### 任务 3.4.1：移动文件

```bash
mv src/shared/support-prompt.ts src/core/prompts/support-prompt.ts
```

#### 任务 3.4.2：更新导入路径

**需要更新的文件**：
- `webview-ui/src/context/ExtensionStateContext.tsx`
- `webview-ui/src/components/settings/PromptsSettings.tsx`
- `src/core/webview/messageEnhancer.ts`

**修改导入**：
```typescript
// 从
import { supportPrompt, SupportPromptType } from "@shared/support-prompt"

// 改为
import { supportPrompt, SupportPromptType } from "@core/prompts/support-prompt"
```

#### 任务 3.4.3：删除原文件

```bash
rm src/shared/support-prompt.ts
```

### 6.5 迁移 embeddingModels.ts

#### 任务 3.5.1：移动文件

```bash
mv src/shared/embeddingModels.ts src/services/code-index/embedding-models.ts
```

#### 任务 3.5.2：更新导入路径

**需要更新的文件**：
- 搜索所有使用 `@shared/embeddingModels` 的文件

**修改导入**：
```typescript
// 从
import { getModelDimension, getModelScoreThreshold } from "@shared/embeddingModels"

// 改为
import { getModelDimension, getModelScoreThreshold } from "@services/code-index/embedding-models"
```

#### 任务 3.5.3：删除原文件

```bash
rm src/shared/embeddingModels.ts
```

### 6.6 迁移 context-mentions.ts

#### 任务 3.6.1：移动文件

```bash
mv src/shared/context-mentions.ts src/utils/context-mentions.ts
```

#### 任务 3.6.2：更新导入路径

**需要更新的文件**：
- `webview-ui/src/utils/context-mentions.ts`

**修改导入**：
```typescript
// 从
import { mentionRegex, mentionRegexGlobal } from "@shared/context-mentions"

// 改为
import { mentionRegex, mentionRegexGlobal } from "@utils/context-mentions"
```

#### 任务 3.6.3：删除原文件

```bash
rm src/shared/context-mentions.ts
```

### 6.7 阶段 3 验证

```bash
# 运行测试
pnpm test

# 运行类型检查
pnpm check-types

# 运行 lint
pnpm lint

# 提交代码
git add .
git commit -m "refactor: migrate medium-priority modules from shared"
```

---

## 七、阶段 4：低优先级模块迁移

**目标**：迁移低优先级的特定模块功能到相应位置（可选）

### 7.1 迁移 experiments.ts

#### 任务 4.1.1：移动文件

```bash
mv src/shared/experiments.ts src/core/experiments/experiment-utils.ts
```

#### 任务 4.1.2：更新导入路径

**需要更新的文件**：
- `webview-ui/src/context/ExtensionStateContext.tsx`
- `webview-ui/src/components/settings/ExperimentalSettings.tsx`
- `src/core/environment/getEnvironmentDetails.ts`

**修改导入**：
```typescript
// 从
import { EXPERIMENT_IDS, experimentConfigsMap, experimentDefault } from "@shared/experiments"

// 改为
import { EXPERIMENT_IDS, experimentConfigsMap, experimentDefault } from "@core/experiments/experiment-utils"
```

#### 任务 4.1.3：删除原文件

```bash
rm src/shared/experiments.ts
```

### 7.2 迁移 cost.ts

#### 任务 4.2.1：移动文件

```bash
mv src/shared/cost.ts src/api/cost-utils.ts
```

#### 任务 4.2.2：更新导入路径

**需要更新的文件**：
- 搜索所有使用 `@shared/cost` 的文件

**修改导入**：
```typescript
// 从
import { calculateApiCostAnthropic, calculateApiCostOpenAI } from "@shared/cost"

// 改为
import { calculateApiCostAnthropic, calculateApiCostOpenAI } from "@api/cost-utils"
```

#### 任务 4.2.3：删除原文件

```bash
rm src/shared/cost.ts
```

### 7.3 迁移 browserUtils.ts

#### 任务 4.3.1：移动文件

```bash
mv src/shared/browserUtils.ts src/core/webview/browser-utils.ts
```

#### 任务 4.3.2：更新导入路径

**需要更新的文件**：
- 搜索所有使用 `@shared/browserUtils` 的文件

**修改导入**：
```typescript
// 从
import { scaleCoordinate, prettyKey } from "@shared/browserUtils"

// 改为
import { scaleCoordinate, prettyKey } from "@core/webview/browser-utils"
```

#### 任务 4.3.3：删除原文件

```bash
rm src/shared/browserUtils.ts
```

### 7.4 迁移 parse-command.ts

#### 任务 4.4.1：移动文件

```bash
mv src/shared/parse-command.ts src/core/tools/command-parser.ts
```

#### 任务 4.4.2：更新导入路径

**需要更新的文件**：
- 搜索所有使用 `@shared/parse-command` 的文件

**修改导入**：
```typescript
// 从
import { parseCommand } from "@shared/parse-command"

// 改为
import { parseCommand } from "@core/tools/command-parser"
```

#### 任务 4.4.3：删除原文件

```bash
rm src/shared/parse-command.ts
```

### 7.5 迁移 todo.ts

#### 任务 4.5.1：移动文件

```bash
mv src/shared/todo.ts src/core/task/managers/todo-utils.ts
```

#### 任务 4.5.2：更新导入路径

**需要更新的文件**：
- 搜索所有使用 `@shared/todo` 的文件

**修改导入**：
```typescript
// 从
import { getTodosFromMessages } from "@shared/todo"

// 改为
import { getTodosFromMessages } from "@core/task/managers/todo-utils"
```

#### 任务 4.5.3：删除原文件

```bash
rm src/shared/todo.ts
```

### 7.6 阶段 4 验证

```bash
# 运行测试
pnpm test

# 运行类型检查
pnpm check-types

# 运行 lint
pnpm lint

# 提交代码
git add .
git commit -m "refactor: migrate low-priority modules from shared"
```

---

## 八、阶段 5：清理与优化

**目标**：清理残留文件，优化导入路径，更新文档

### 8.1 清理测试文件

#### 任务 5.1.1：移动测试文件

```bash
# 移动 shared/__tests__ 中的测试文件到相应位置
mv src/shared/__tests__/modes.spec.ts src/core/modes/__tests__/mode-utils.spec.ts
mv src/shared/__tests__/api.spec.ts src/api/__tests__/api-utils.spec.ts
mv src/shared/__tests__/getApiMetrics.spec.ts src/core/task/managers/monitoring/__tests__/metrics-utils.spec.ts
mv src/shared/__tests__/combineApiRequests.spec.ts src/core/task/managers/api/__tests__/message-utils.spec.ts
mv src/shared/__tests__/combineCommandSequences.spec.ts src/core/task/managers/messaging/__tests__/message-utils.spec.ts
mv src/shared/__tests__/experiments.spec.ts src/core/experiments/__tests__/experiment-utils.spec.ts
mv src/shared/__tests__/support-prompts.spec.ts src/core/prompts/__tests__/support-prompt.spec.ts
mv src/shared/__tests__/language.spec.ts src/shared/__tests__/language.spec.ts
mv src/shared/__tests__/vsCodeSelectorUtils.spec.ts src/utils/__tests__/vsCodeSelectorUtils.spec.ts
mv src/shared/__tests__/checkExistApiConfig.spec.ts src/core/providers/__tests__/config-utils.spec.ts
mv src/shared/__tests__/context-mentions.spec.ts src/utils/__tests__/context-mentions.spec.ts
```

#### 任务 5.1.2：更新测试文件中的导入路径

**需要更新的文件**：所有移动的测试文件

**修改导入**：
```typescript
// 根据文件位置更新导入路径
import { modes } from "../mode-utils"
import { combineApiRequests } from "../message-utils"
// ... 等等
```

#### 任务 5.1.3：删除原测试目录

```bash
rm -rf src/shared/__tests__
```

### 8.2 更新 shared/index.ts

#### 任务 5.2.1：添加重新导出（保持向后兼容）

```typescript
// src/shared/index.ts
export * from "./types"
export * from "./array"
export * from "./safeJsonParse"
export * from "./language"
export * from "./globalFileNames"

// 重新导出移动后的模块，保持向后兼容
export { modes, defaultModeSlug, defaultPrompts } from "../core/modes/mode-utils"
export { TOOL_GROUPS, ALWAYS_AVAILABLE_TOOLS } from "../core/tools/tool-config"
export { DEFAULT_MODES } from "../core/modes/default-modes"
export { checkExistKey } from "../core/providers/config-utils"
export { combineApiRequests } from "../core/task/managers/api/message-utils"
export { combineCommandSequences } from "../core/task/managers/messaging/message-utils"
export { getApiMetrics, hasTokenUsageChanged, hasToolUsageChanged } from "../core/task/managers/monitoring/metrics-utils"
export { supportPrompt, SupportPromptType } from "../core/prompts/support-prompt"
export { getModelDimension, getModelScoreThreshold } from "../services/code-index/embedding-models"
export { EXPERIMENT_IDS, experimentConfigsMap, experimentDefault } from "../core/experiments/experiment-utils"
export { calculateApiCostAnthropic, calculateApiCostOpenAI } from "../api/cost-utils"
export { scaleCoordinate, prettyKey } from "../core/webview/browser-utils"
export { parseCommand } from "../core/tools/command-parser"
export { getTodosFromMessages } from "../core/task/managers/todo-utils"
export { mentionRegex, mentionRegexGlobal } from "../utils/context-mentions"
export { stringifyVsCodeLmModelSelector } from "../utils/vsCodeSelectorUtils"
```

### 8.3 更新文档

#### 任务 5.3.1：更新 README

在项目 README 中更新目录结构说明：

```markdown
## 项目结构

```
src/
├── shared/              # 共享类型定义和通用工具
│   ├── types/          # 纯类型定义（无配置、无函数）
│   ├── array.ts        # 通用数组工具
│   ├── safeJsonParse.ts # 通用 JSON 解析工具
│   ├── language.ts     # 语言配置
│   └── globalFileNames.ts # 全局文件名常量
│
├── core/               # 核心功能模块
│   ├── constants/      # 全局常量
│   ├── modes/         # Mode 管理
│   ├── tools/         # Tool 管理
│   ├── experiments/    # 实验管理
│   ├── task/          # 任务管理
│   ├── webview/       # Webview 管理
│   └── ...
│
├── services/          # 服务模块
│   ├── code-index/    # 代码索引服务
│   ├── mcp/          # MCP 服务
│   └── ...
│
└── api/               # API 模块
    ├── providers/      # AI 提供商
    ├── transform/      # 数据转换
    └── ...
```
```

#### 任务 5.3.2：更新迁移指南

创建 `docs/refactoring/shared-refactoring-guide.md`：

```markdown
# Shared 目录重构指南

本文档记录了 shared 目录重构的过程和最佳实践。

## 重构目标

1. 将特定模块功能整合到相应模块内部
2. 减少跨层依赖
3. 避免循环依赖
4. 保持向后兼容

## 重构原则

- `shared/types` 只包含纯类型定义
- 类型与配置分离
- 避免循环依赖
- 保持向后兼容
- 渐进式迁移

## 迁移步骤

详见 [完整任务清单](../../plans/shared-refactoring-complete-checklist.md)
```

### 8.4 阶段 5 验证

```bash
# 运行所有测试
pnpm test

# 运行类型检查
pnpm check-types

# 运行 lint
pnpm lint

# 构建项目
pnpm build

# 提交代码
git add .
git commit -m "refactor: complete shared directory refactoring"
```

---

## 九、迁移检查清单

### 9.1 阶段 0：准备工作检查清单

- [ ] 创建新目录结构
  - [ ] `src/core/constants`
  - [ ] `src/core/modes`
  - [ ] `src/core/tools`
  - [ ] `src/core/experiments`
  - [ ] `src/utils`
  - [ ] `src/services/code-index`
- [ ] 备份现有代码
  - [ ] 创建备份分支或备份文件
- [ ] 更新 tsconfig 路径映射
  - [ ] 添加 `@core/*` 路径别名
  - [ ] 添加 `@services/*` 路径别名
  - [ ] 添加 `@api/*` 路径别名
  - [ ] 添加 `@utils/*` 路径别名
- [ ] 准备测试环境
  - [ ] 所有测试通过
  - [ ] 类型检查通过
  - [ ] lint 通过

### 9.2 阶段 1：类型与配置分离检查清单

- [ ] 分离 types/mode.ts
  - [ ] 创建 `src/core/modes/default-modes.ts`
  - [ ] 修改 `shared/types/mode.ts`（移除 DEFAULT_MODES）
  - [ ] 更新 `shared/modes.ts` 导入路径
- [ ] 分离 types/tool.ts
  - [ ] 创建 `src/core/tools/tool-utils.ts`
  - [ ] 修改 `shared/types/tool.ts`（移除工具函数）
  - [ ] 更新所有使用工具函数的文件
- [ ] 分离 types/codebase-index.ts
  - [ ] 创建 `src/services/code-index/config.ts`
  - [ ] 修改 `shared/types/codebase-index.ts`（移除配置）
- [ ] 分离 types/global-settings.ts
  - [ ] 创建 `src/core/constants/default-values.ts`
  - [ ] 修改 `shared/types/global-settings.ts`（移除常量）
  - [ ] 更新所有使用常量的文件
- [ ] 分离 types/message.ts
  - [ ] 创建 `src/core/task/managers/messaging/message-utils.ts`
  - [ ] 修改 `shared/types/message.ts`（移除工具函数）
- [ ] 验证阶段 1
  - [ ] 所有测试通过
  - [ ] 类型检查通过
  - [ ] lint 通过
  - [ ] 提交代码

### 9.3 阶段 2：高优先级模块迁移检查清单

- [ ] 迁移 vsCodeSelectorUtils.ts
  - [ ] 移动文件到 `src/utils/vsCodeSelectorUtils.ts`
  - [ ] 更新所有导入路径
  - [ ] 删除原文件
- [ ] 迁移 api.ts
  - [ ] 移动文件到 `src/api/api-utils.ts`
  - [ ] 更新所有导入路径
  - [ ] 删除原文件
- [ ] 迁移 modes.ts
  - [ ] 移动文件到 `src/core/modes/mode-utils.ts`
  - [ ] 更新所有导入路径
  - [ ] 删除原文件
- [ ] 迁移 mcp.ts
  - [ ] 移动文件到 `src/services/mcp/mcp-types.ts`
  - [ ] 更新所有导入路径
  - [ ] 删除原文件
- [ ] 迁移 tools.ts
  - [ ] 移动文件到 `src/core/tools/tool-config.ts`
  - [ ] 更新所有导入路径
  - [ ] 删除原文件
- [ ] 迁移 checkExistApiConfig.ts
  - [ ] 移动文件到 `src/core/providers/config-utils.ts`
  - [ ] 更新所有导入路径
  - [ ] 删除原文件
- [ ] 验证阶段 2
  - [ ] 所有测试通过
  - [ ] 类型检查通过
  - [ ] lint 通过
  - [ ] 提交代码

### 9.4 阶段 3：中优先级模块迁移检查清单

- [ ] 迁移 combineApiRequests.ts
  - [ ] 移动文件到 `src/core/task/managers/api/message-utils.ts`
  - [ ] 更新所有导入路径
  - [ ] 删除原文件
- [ ] 迁移 combineCommandSequences.ts
  - [ ] 移动文件到 `src/core/task/managers/messaging/message-utils.ts`
  - [ ] 更新所有导入路径
  - [ ] 删除原文件
- [ ] 迁移 getApiMetrics.ts
  - [ ] 移动文件到 `src/core/task/managers/monitoring/metrics-utils.ts`
  - [ ] 更新所有导入路径
  - [ ] 删除原文件
- [ ] 迁移 support-prompt.ts
  - [ ] 移动文件到 `src/core/prompts/support-prompt.ts`
  - [ ] 更新所有导入路径
  - [ ] 删除原文件
- [ ] 迁移 embeddingModels.ts
  - [ ] 移动文件到 `src/services/code-index/embedding-models.ts`
  - [ ] 更新所有导入路径
  - [ ] 删除原文件
- [ ] 迁移 context-mentions.ts
  - [ ] 移动文件到 `src/utils/context-mentions.ts`
  - [ ] 更新所有导入路径
  - [ ] 删除原文件
- [ ] 验证阶段 3
  - [ ] 所有测试通过
  - [ ] 类型检查通过
  - [ ] lint 通过
  - [ ] 提交代码

### 9.5 阶段 4：低优先级模块迁移检查清单

- [ ] 迁移 experiments.ts
  - [ ] 移动文件到 `src/core/experiments/experiment-utils.ts`
  - [ ] 更新所有导入路径
  - [ ] 删除原文件
- [ ] 迁移 cost.ts
  - [ ] 移动文件到 `src/api/cost-utils.ts`
  - [ ] 更新所有导入路径
  - [ ] 删除原文件
- [ ] 迁移 browserUtils.ts
  - [ ] 移动文件到 `src/core/webview/browser-utils.ts`
  - [ ] 更新所有导入路径
  - [ ] 删除原文件
- [ ] 迁移 parse-command.ts
  - [ ] 移动文件到 `src/core/tools/command-parser.ts`
  - [ ] 更新所有导入路径
  - [ ] 删除原文件
- [ ] 迁移 todo.ts
  - [ ] 移动文件到 `src/core/task/managers/todo-utils.ts`
  - [ ] 更新所有导入路径
  - [ ] 删除原文件
- [ ] 验证阶段 4
  - [ ] 所有测试通过
  - [ ] 类型检查通过
  - [ ] lint 通过
  - [ ] 提交代码

### 9.6 阶段 5：清理与优化检查清单

- [ ] 清理测试文件
  - [ ] 移动所有测试文件到相应位置
  - [ ] 更新测试文件中的导入路径
  - [ ] 删除原测试目录
- [ ] 更新 shared/index.ts
  - [ ] 添加重新导出（保持向后兼容）
- [ ] 更新文档
  - [ ] 更新 README
  - [ ] 创建迁移指南文档
- [ ] 验证阶段 5
  - [ ] 所有测试通过
  - [ ] 类型检查通过
  - [ ] lint 通过
  - [ ] 构建成功
  - [ ] 提交代码

---

## 十、风险评估与应对

### 10.1 风险识别

| 风险 | 可能性 | 影响 | 应对措施 |
|------|--------|------|----------|
| 循环依赖 | 高 | 高 | 严格遵循类型与配置分离原则 |
| 测试失败 | 中 | 中 | 每个阶段后充分测试 |
| 导入路径错误 | 高 | 中 | 使用全局替换工具 |
| 向后兼容性破坏 | 中 | 高 | 通过重新导出保持兼容 |
| webview-ui 兼容性问题 | 中 | 高 | 确保 webview-ui 仍可访问所需模块 |
| 构建失败 | 低 | 高 | 每个阶段后运行构建 |

### 10.2 应对策略

#### 策略 1：渐进式迁移

- 每个阶段独立完成
- 每个阶段后充分测试
- 遇到问题及时回滚

#### 策略 2：保持向后兼容

- 在 `shared/index.ts` 中重新导出
- 逐步废弃旧的导入路径
- 提供迁移指南

#### 策略 3：充分测试

- 每个阶段后运行所有测试
- 运行类型检查和 lint
- 手动测试关键功能

#### 策略 4：文档更新

- 及时更新相关文档
- 标记已废弃的导入路径
- 提供迁移示例

### 10.3 回滚计划

如果遇到严重问题，可以按以下步骤回滚：

```bash
# 切换到备份分支
git checkout backup-before-refactoring

# 或者恢复备份文件
rm -rf src/shared
cp -r src/shared.backup src/shared
```

---

## 十一、时间估算

| 阶段 | 预计时间 | 说明 |
|------|----------|------|
| 阶段 0：准备工作 | 0.5 天 | 创建目录、备份、配置 |
| 阶段 1：类型与配置分离 | 2-3 天 | 分离 5 个 types 文件 |
| 阶段 2：高优先级模块迁移 | 2-3 天 | 迁移 6 个文件 |
| 阶段 3：中优先级模块迁移 | 2-3 天 | 迁移 6 个文件 |
| 阶段 4：低优先级模块迁移 | 1-2 天 | 迁移 5 个文件（可选） |
| 阶段 5：清理与优化 | 1 天 | 清理、更新文档 |
| **总计** | **8.5-12.5 天** | 约 2-3 周 |

---

## 十二、成功标准

### 12.1 技术标准

- [ ] 所有测试通过
- [ ] 类型检查通过
- [ ] lint 通过
- [ ] 构建成功
- [ ] 无循环依赖
- [ ] webview-ui 正常工作

### 12.2 代码质量标准

- [ ] 代码符合项目规范
- [ ] 导入路径清晰
- [ ] 模块职责明确
- [ ] 文档完整

### 12.3 可维护性标准

- [ ] 新增功能易于添加
- [ ] 修改影响范围小
- [ ] 测试覆盖充分
- [ ] 文档清晰易懂

---

## 十三、后续优化建议

### 13.1 短期优化（1-2 个月）

1. **进一步模块化**：考虑将 `shared/types` 按功能域进一步拆分
2. **优化导入路径**：使用路径别名简化导入
3. **增强测试**：为移动的模块添加更多测试

### 13.2 长期优化（3-6 个月）

1. **考虑 monorepo**：如果项目继续增长，考虑拆分为多个包
2. **依赖分析**：定期分析依赖关系，优化模块结构
3. **性能优化**：分析模块加载性能，优化依赖关系

---

## 附录

### A. 相关文档

- [核心模块重构计划](./core-directory-refactoring-plan.md)
- [Task Managers 核心分析](./task-managers-core-analysis.md)
- [项目规则](../.trae/rules/project_rules.md)

### B. 参考资料

- [TypeScript 模块解析](https://www.typescriptlang.org/docs/handbook/module-resolution.html)
- [循环依赖检测](https://madge.petersanchez.com/)

### C. 联系方式

如有问题，请联系项目维护者或在项目中创建 issue。

---

**文档版本**：1.0
**最后更新**：2026-01-21
**维护者**：Roo Code Team
