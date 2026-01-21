# Shared 目录重构分阶段执行方案

> **目标**：按照完整的任务清单，分阶段执行 shared 目录重构
> **创建时间**：2026-01-21
> **预计工期**：3-4 周（分 5 个阶段执行）

---

## 目录

- [一、执行概览](#一执行概览)
- [二、阶段 0：准备工作（第 1 天）](#二阶段-0准备工作第-1-天)
- [三、阶段 1：类型与配置分离（第 2-4 天）](#三阶段-1类型与配置分离第-2-4-天)
- [四、阶段 2：高优先级模块迁移（第 5-7 天）](#四阶段-2高优先级模块迁移第-5-7-天)
- [五、阶段 3：中优先级模块迁移（第 8-10 天）](#五阶段-3中优先级模块迁移第-8-10-天)
- [六、阶段 4：低优先级模块迁移（第 11-12 天，可选）](#六阶段-4低优先级模块迁移第-11-12-天可选)
- [七、阶段 5：清理与优化（第 13 天）](#七阶段-5清理与优化第-13-天)
- [八、每日执行检查清单](#八每日执行检查清单)

---

## 一、执行概览

### 1.1 阶段划分

| 阶段 | 名称 | 预计天数 | 优先级 | 风险等级 |
|------|------|----------|--------|----------|
| 阶段 0 | 准备工作 | 0.5 | 高 | 低 |
| 阶段 1 | 类型与配置分离 | 2-3 | 高 | 中 |
| 阶段 2 | 高优先级模块迁移 | 2-3 | 高 | 中 |
| 阶段 3 | 中优先级模块迁移 | 2-3 | 中 | 中 |
| 阶段 4 | 低优先级模块迁移 | 1-2 | 低 | 低 |
| 阶段 5 | 清理与优化 | 1 | 高 | 低 |

### 1.2 执行顺序

```
阶段 0（准备工作）
    ↓
阶段 1（类型与配置分离）← 关键阶段，必须先完成
    ↓
阶段 2（高优先级模块迁移）
    ↓
阶段 3（中优先级模块迁移）
    ↓
阶段 4（低优先级模块迁移，可选）
    ↓
阶段 5（清理与优化）
```

### 1.3 关键里程碑

- **里程碑 1**（第 1 天）：完成准备工作
- **里程碑 2**（第 4 天）：完成类型与配置分离
- **里程碑 3**（第 7 天）：完成高优先级模块迁移
- **里程碑 4**（第 10 天）：完成中优先级模块迁移
- **里程碑 5**（第 13 天）：完成所有迁移和清理

---

## 二、阶段 0：准备工作（第 1 天）

**目标**：创建必要的目录结构，备份代码，配置环境

### 2.1 上午任务（2 小时）

#### 任务 0.1：创建新目录结构（30 分钟）

```bash
# 切换到项目根目录
cd d:\项目\agent\Roo-Code

# 创建新的目录
mkdir -p src/core/constants
mkdir -p src/core/modes
mkdir -p src/core/tools
mkdir -p src/core/experiments
mkdir -p src/utils
mkdir -p src/services/code-index

# 验证目录创建成功
ls -la src/core/
ls -la src/utils/
ls -la src/services/
```

**验证标准**：
- [ ] 所有目录创建成功
- [ ] 目录结构符合预期

#### 任务 0.2：备份现有代码（30 分钟）

```bash
# 创建备份分支
git checkout -b backup-before-refactoring

# 或者创建备份文件（如果不想创建分支）
# cp -r src/shared src/shared.backup

# 验证备份
ls -la src/shared.backup/
```

**验证标准**：
- [ ] 备份创建成功
- [ ] 可以随时回滚

#### 任务 0.3：更新 tsconfig 路径映射（1 小时）

编辑 `tsconfig.json`，添加路径别名：

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"],
      "@core/*": ["src/core/*"],
      "@services/*": ["src/services/*"],
      "@api/*": ["src/api/*"],
      "@utils/*": ["src/utils/*"],
      "@webview-ui/*": ["webview-ui/src/*"]
    }
  }
}
```

**验证标准**：
- [ ] 路径映射添加成功
- [ ] TypeScript 可以识别新路径

### 2.2 下午任务（2 小时）

#### 任务 0.4：准备测试环境（1 小时）

```bash
# 确保所有测试通过
pnpm test

# 确保类型检查通过
pnpm check-types

# 确保 lint 通过
pnpm lint

# 记录基准测试结果
pnpm test > test-results-baseline.txt
```

**验证标准**：
- [ ] 所有测试通过
- [ ] 类型检查通过
- [ ] lint 通过
- [ ] 基准测试结果已记录

#### 任务 0.5：创建执行日志（1 小时）

创建 `refactoring-log.md`：

```markdown
# Shared 目录重构执行日志

## 执行信息

- **开始时间**：2026-01-21
- **执行者**：[你的名字]
- **预计完成时间**：2026-02-03

## 阶段进度

- [ ] 阶段 0：准备工作
- [ ] 阶段 1：类型与配置分离
- [ ] 阶段 2：高优先级模块迁移
- [ ] 阶段 3：中优先级模块迁移
- [ ] 阶段 4：低优先级模块迁移
- [ ] 阶段 5：清理与优化

## 每日记录

### 第 1 天（2026-01-21）
- 完成任务：
- 遇到的问题：
- 解决方案：
```

**验证标准**：
- [ ] 执行日志创建成功
- [ ] 可以追踪每日进度

### 2.3 阶段 0 验证

```bash
# 运行完整测试套件
pnpm test

# 提交准备工作
git add .
git commit -m "chore: prepare for shared directory refactoring"
```

**验证标准**：
- [ ] 所有测试通过
- [ ] 准备工作已提交
- [ ] 可以开始阶段 1

---

## 三、阶段 1：类型与配置分离（第 2-4 天）

**目标**：将 `shared/types` 中的配置数据和工具函数分离到相应模块

### 3.1 第 2 天：分离 mode.ts 和 tool.ts

#### 上午任务（4 小时）

##### 任务 1.1：分离 types/mode.ts（2 小时）

**步骤 1.1.1**：创建 `src/core/modes/default-modes.ts`（30 分钟）

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
  // ... 其他 mode 配置
] as const
```

**步骤 1.1.2**：修改 `shared/types/mode.ts`（30 分钟）

移除 `DEFAULT_MODES` 常量，只保留类型定义。

**步骤 1.1.3**：更新 `shared/modes.ts`（1 小时）

修改导入路径：

```typescript
// 从
import { DEFAULT_MODES } from "@shared/types"

// 改为
import { DEFAULT_MODES } from "../core/modes/default-modes"
```

**验证标准**：
- [ ] `default-modes.ts` 创建成功
- [ ] `types/mode.ts` 只包含类型定义
- [ ] `modes.ts` 导入路径更新成功
- [ ] 相关测试通过

##### 任务 1.2：分离 types/tool.ts（2 小时）

**步骤 1.2.1**：创建 `src/core/tools/tool-utils.ts`（30 分钟）

```typescript
import { TOOL_PROTOCOL, ToolProtocol } from "@shared/types"

export function isNativeProtocol(protocol: ToolProtocol): boolean {
  return protocol === TOOL_PROTOCOL.NATIVE
}

export function getEffectiveProtocol(toolProtocol?: ToolProtocol): ToolProtocol {
  return toolProtocol || TOOL_PROTOCOL.XML
}
```

**步骤 1.2.2**：修改 `shared/types/tool.ts`（30 分钟）

移除 `isNativeProtocol` 和 `getEffectiveProtocol` 函数。

**步骤 1.2.3**：更新所有使用这些函数的文件（1 小时）

使用全局搜索替换：

```bash
# 搜索所有使用 isNativeProtocol 的文件
grep -r "isNativeProtocol" src/

# 逐个更新导入路径
```

**验证标准**：
- [ ] `tool-utils.ts` 创建成功
- [ ] `types/tool.ts` 只包含类型定义
- [ ] 所有使用这些函数的文件已更新
- [ ] 相关测试通过

#### 下午任务（4 小时）

##### 任务 1.3：运行测试和修复（4 小时）

```bash
# 运行测试
pnpm test

# 如果有失败，修复问题
# 重新运行测试
pnpm test

# 运行类型检查
pnpm check-types

# 运行 lint
pnpm lint
```

**验证标准**：
- [ ] 所有测试通过
- [ ] 类型检查通过
- [ ] lint 通过

### 3.2 第 3 天：分离 codebase-index.ts 和 global-settings.ts

#### 上午任务（4 小时）

##### 任务 1.4：分离 types/codebase-index.ts（2 小时）

**步骤 1.4.1**：创建 `src/services/code-index/config.ts`（1 小时）

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
  // ... 配置数据
}

export const DEFAULT_VECTOR_STORAGE_CONFIG: VectorStorageConfig = {
  // ... 配置数据
}
```

**步骤 1.4.2**：修改 `shared/types/codebase-index.ts`（1 小时）

移除配置数据，只保留类型定义。

**验证标准**：
- [ ] `config.ts` 创建成功
- [ ] `types/codebase-index.ts` 只包含类型定义
- [ ] 相关测试通过

##### 任务 1.5：分离 types/global-settings.ts（2 小时）

**步骤 1.5.1**：创建 `src/core/constants/default-values.ts`（30 分钟）

```typescript
export const DEFAULT_WRITE_DELAY_MS = 1000

export const DEFAULT_TERMINAL_OUTPUT_CHARACTER_LIMIT = 50_000

export const MIN_CHECKPOINT_TIMEOUT_SECONDS = 10

export const MAX_CHECKPOINT_TIMEOUT_SECONDS = 60

export const DEFAULT_CHECKPOINT_TIMEOUT_SECONDS = 15

export const DEFAULT_CONSECUTIVE_MISTAKE_LIMIT = 3
```

**步骤 1.5.2**：修改 `shared/types/global-settings.ts`（30 分钟）

移除常量定义，只保留类型定义。

**步骤 1.5.3**：更新所有使用这些常量的文件（1 小时）

使用全局搜索替换：

```bash
# 搜索所有使用 DEFAULT_WRITE_DELAY_MS 的文件
grep -r "DEFAULT_WRITE_DELAY_MS" src/

# 逐个更新导入路径
```

**验证标准**：
- [ ] `default-values.ts` 创建成功
- [ ] `types/global-settings.ts` 只包含类型定义
- [ ] 所有使用这些常量的文件已更新
- [ ] 相关测试通过

#### 下午任务（4 小时）

##### 任务 1.6：分离 types/message.ts（2 小时）

**步骤 1.6.1**：创建 `src/core/task/managers/messaging/message-utils.ts`（1 小时）

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

// ... 其他工具函数
```

**步骤 1.6.2**：修改 `shared/types/message.ts`（1 小时）

移除工具函数，只保留类型定义。

**验证标准**：
- [ ] `message-utils.ts` 创建成功
- [ ] `types/message.ts` 只包含类型定义
- [ ] 相关测试通过

##### 任务 1.7：运行测试和修复（2 小时）

```bash
# 运行测试
pnpm test

# 修复问题
# 重新运行测试
pnpm test

# 运行类型检查
pnpm check-types

# 运行 lint
pnpm lint
```

**验证标准**：
- [ ] 所有测试通过
- [ ] 类型检查通过
- [ ] lint 通过

### 3.3 第 4 天：阶段 1 验证和提交

#### 全天任务（8 小时）

##### 任务 1.8：完整验证（4 小时）

```bash
# 运行完整测试套件
pnpm test

# 运行类型检查
pnpm check-types

# 运行 lint
pnpm lint

# 构建项目
pnpm build

# 手动测试关键功能
# 1. 启动 VS Code 扩展
# 2. 测试 mode 切换
# 3. 测试 tool 使用
# 4. 测试 API 调用
```

**验证标准**：
- [ ] 所有测试通过
- [ ] 类型检查通过
- [ ] lint 通过
- [ ] 构建成功
- [ ] 手动测试通过

##### 任务 1.9：提交代码（2 小时）

```bash
# 添加所有更改
git add .

# 提交代码
git commit -m "feat: separate types from configurations in shared/types

- Move DEFAULT_MODES to src/core/modes/default-modes.ts
- Move tool utility functions to src/core/tools/tool-utils.ts
- Move codebase-index configs to src/services/code-index/config.ts
- Move global constants to src/core/constants/default-values.ts
- Move message utility functions to src/core/task/managers/messaging/message-utils.ts

This ensures shared/types only contains pure type definitions,
avoiding circular dependencies."

# 推送到远程（如果需要）
git push origin backup-before-refactoring
```

**验证标准**：
- [ ] 代码已提交
- [ ] 提交信息清晰
- [ ] 可以开始阶段 2

##### 任务 1.10：更新执行日志（2 小时）

在 `refactoring-log.md` 中记录阶段 1 的完成情况。

**验证标准**：
- [ ] 执行日志已更新
- [ ] 可以追踪进度

---

## 四、阶段 2：高优先级模块迁移（第 5-7 天）

**目标**：迁移高优先级的特定模块功能到相应位置

### 4.1 第 5 天：迁移 vsCodeSelectorUtils.ts 和 api.ts

#### 上午任务（4 小时）

##### 任务 2.1：迁移 vsCodeSelectorUtils.ts（2 小时）

**步骤 2.1.1**：移动文件（30 分钟）

```bash
mv src/shared/vsCodeSelectorUtils.ts src/utils/vsCodeSelectorUtils.ts
```

**步骤 2.1.2**：更新导入路径（1 小时）

搜索所有使用 `@shared/vsCodeSelectorUtils` 的文件并更新：

```typescript
// 从
import { stringifyVsCodeLmModelSelector } from "@shared/vsCodeSelectorUtils"

// 改为
import { stringifyVsCodeLmModelSelector } from "@utils/vsCodeSelectorUtils"
```

**步骤 2.1.3**：删除原文件（30 分钟）

```bash
rm src/shared/vsCodeSelectorUtils.ts
```

**验证标准**：
- [ ] 文件移动成功
- [ ] 所有导入路径已更新
- [ ] 原文件已删除
- [ ] 相关测试通过

##### 任务 2.2：迁移 api.ts（2 小时）

**步骤 2.2.1**：移动文件（30 分钟）

```bash
mv src/shared/api.ts src/api/api-utils.ts
```

**步骤 2.2.2**：更新导入路径（1 小时）

搜索所有使用 `@shared/api` 的文件并更新：

```typescript
// 从
import { shouldUseReasoningBudget, getModelMaxOutputTokens } from "@shared/api"

// 改为
import { shouldUseReasoningBudget, getModelMaxOutputTokens } from "@api/api-utils"
```

**步骤 2.2.3**：删除原文件（30 分钟）

```bash
rm src/shared/api.ts
```

**验证标准**：
- [ ] 文件移动成功
- [ ] 所有导入路径已更新
- [ ] 原文件已删除
- [ ] 相关测试通过

#### 下午任务（4 小时）

##### 任务 2.3：运行测试和修复（4 小时）

```bash
# 运行测试
pnpm test

# 修复问题
# 重新运行测试
pnpm test

# 运行类型检查
pnpm check-types

# 运行 lint
pnpm lint
```

**验证标准**：
- [ ] 所有测试通过
- [ ] 类型检查通过
- [ ] lint 通过

### 4.2 第 6 天：迁移 modes.ts 和 mcp.ts

#### 上午任务（4 小时）

##### 任务 2.4：迁移 modes.ts（2 小时）

**步骤 2.4.1**：移动文件（30 分钟）

```bash
mv src/shared/modes.ts src/core/modes/mode-utils.ts
```

**步骤 2.4.2**：更新导入路径（1 小时）

搜索所有使用 `@shared/modes` 的文件并更新：

```typescript
// 从
import { modes, defaultModeSlug, defaultPrompts } from "@shared/modes"

// 改为
import { modes, defaultModeSlug, defaultPrompts } from "@core/modes/mode-utils"
```

**步骤 2.4.3**：删除原文件（30 分钟）

```bash
rm src/shared/modes.ts
```

**验证标准**：
- [ ] 文件移动成功
- [ ] 所有导入路径已更新
- [ ] 原文件已删除
- [ ] 相关测试通过

##### 任务 2.5：迁移 mcp.ts（2 小时）

**步骤 2.5.1**：移动文件（30 分钟）

```bash
mv src/shared/mcp.ts src/services/mcp/mcp-types.ts
```

**步骤 2.5.2**：更新导入路径（1 小时）

搜索所有使用 `@shared/mcp` 的文件并更新：

```typescript
// 从
import { McpServer, McpTool, McpResource } from "@shared/mcp"

// 改为
import { McpServer, McpTool, McpResource } from "@services/mcp/mcp-types"
```

**步骤 2.5.3**：删除原文件（30 分钟）

```bash
rm src/shared/mcp.ts
```

**验证标准**：
- [ ] 文件移动成功
- [ ] 所有导入路径已更新
- [ ] 原文件已删除
- [ ] 相关测试通过

#### 下午任务（4 小时）

##### 任务 2.6：运行测试和修复（4 小时）

```bash
# 运行测试
pnpm test

# 修复问题
# 重新运行测试
pnpm test

# 运行类型检查
pnpm check-types

# 运行 lint
pnpm lint
```

**验证标准**：
- [ ] 所有测试通过
- [ ] 类型检查通过
- [ ] lint 通过

### 4.3 第 7 天：迁移 tools.ts 和 checkExistApiConfig.ts，阶段 2 验证

#### 上午任务（4 小时）

##### 任务 2.7：迁移 tools.ts（2 小时）

**步骤 2.7.1**：移动文件（30 分钟）

```bash
mv src/shared/tools.ts src/core/tools/tool-config.ts
```

**步骤 2.7.2**：更新导入路径（1 小时）

搜索所有使用 `@shared/tools` 的文件并更新：

```typescript
// 从
import { TOOL_GROUPS, ALWAYS_AVAILABLE_TOOLS } from "@shared/tools"

// 改为
import { TOOL_GROUPS, ALWAYS_AVAILABLE_TOOLS } from "@core/tools/tool-config"
```

**步骤 2.7.3**：删除原文件（30 分钟）

```bash
rm src/shared/tools.ts
```

**验证标准**：
- [ ] 文件移动成功
- [ ] 所有导入路径已更新
- [ ] 原文件已删除
- [ ] 相关测试通过

##### 任务 2.8：迁移 checkExistApiConfig.ts（2 小时）

**步骤 2.8.1**：移动文件（30 分钟）

```bash
mv src/shared/checkExistApiConfig.ts src/core/providers/config-utils.ts
```

**步骤 2.8.2**：更新导入路径（1 小时）

搜索所有使用 `@shared/checkExistApiConfig` 的文件并更新：

```typescript
// 从
import { checkExistKey } from "@shared/checkExistApiConfig"

// 改为
import { checkExistKey } from "@core/providers/config-utils"
```

**步骤 2.8.3**：删除原文件（30 分钟）

```bash
rm src/shared/checkExistApiConfig.ts
```

**验证标准**：
- [ ] 文件移动成功
- [ ] 所有导入路径已更新
- [ ] 原文件已删除
- [ ] 相关测试通过

#### 下午任务（4 小时）

##### 任务 2.9：完整验证（4 小时）

```bash
# 运行完整测试套件
pnpm test

# 运行类型检查
pnpm check-types

# 运行 lint
pnpm lint

# 构建项目
pnpm build

# 手动测试关键功能
# 1. 启动 VS Code 扩展
# 2. 测试 mode 切换
# 3. 测试 tool 使用
# 4. 测试 MCP 功能
# 5. 测试 API 配置
```

**验证标准**：
- [ ] 所有测试通过
- [ ] 类型检查通过
- [ ] lint 通过
- [ ] 构建成功
- [ ] 手动测试通过

##### 任务 2.10：提交代码（2 小时）

```bash
# 添加所有更改
git add .

# 提交代码
git commit -m "refactor: migrate high-priority modules from shared to core

- Move vsCodeSelectorUtils.ts to src/utils/vsCodeSelectorUtils.ts
- Move api.ts to src/api/api-utils.ts
- Move modes.ts to src/core/modes/mode-utils.ts
- Move mcp.ts to src/services/mcp/mcp-types.ts
- Move tools.ts to src/core/tools/tool-config.ts
- Move checkExistApiConfig.ts to src/core/providers/config-utils.ts

This reduces cross-layer dependencies and improves module organization."

# 推送到远程（如果需要）
git push origin backup-before-refactoring
```

**验证标准**：
- [ ] 代码已提交
- [ ] 提交信息清晰
- [ ] 可以开始阶段 3

##### 任务 2.11：更新执行日志（2 小时）

在 `refactoring-log.md` 中记录阶段 2 的完成情况。

**验证标准**：
- [ ] 执行日志已更新
- [ ] 可以追踪进度

---

## 五、阶段 3：中优先级模块迁移（第 8-10 天）

**目标**：迁移中优先级的特定模块功能到相应位置

### 5.1 第 8 天：迁移 combineApiRequests.ts 和 combineCommandSequences.ts

#### 上午任务（4 小时）

##### 任务 3.1：迁移 combineApiRequests.ts（2 小时）

**步骤 3.1.1**：移动文件（30 分钟）

```bash
mv src/shared/combineApiRequests.ts src/core/task/managers/api/message-utils.ts
```

**步骤 3.1.2**：更新导入路径（1 小时）

搜索所有使用 `@shared/combineApiRequests` 的文件并更新：

```typescript
// 从
import { combineApiRequests } from "@shared/combineApiRequests"

// 改为
import { combineApiRequests } from "@core/task/managers/api/message-utils"
```

**步骤 3.1.3**：删除原文件（30 分钟）

```bash
rm src/shared/combineApiRequests.ts
```

**验证标准**：
- [ ] 文件移动成功
- [ ] 所有导入路径已更新
- [ ] 原文件已删除
- [ ] 相关测试通过

##### 任务 3.2：迁移 combineCommandSequences.ts（2 小时）

**步骤 3.2.1**：移动文件（30 分钟）

```bash
mv src/shared/combineCommandSequences.ts src/core/task/managers/messaging/message-utils.ts
```

**步骤 3.2.2**：更新导入路径（1 小时）

搜索所有使用 `@shared/combineCommandSequences` 的文件并更新：

```typescript
// 从
import { combineCommandSequences } from "@shared/combineCommandSequences"

// 改为
import { combineCommandSequences } from "@core/task/managers/messaging/message-utils"
```

**步骤 3.2.3**：删除原文件（30 分钟）

```bash
rm src/shared/combineCommandSequences.ts
```

**验证标准**：
- [ ] 文件移动成功
- [ ] 所有导入路径已更新
- [ ] 原文件已删除
- [ ] 相关测试通过

#### 下午任务（4 小时）

##### 任务 3.3：运行测试和修复（4 小时）

```bash
# 运行测试
pnpm test

# 修复问题
# 重新运行测试
pnpm test

# 运行类型检查
pnpm check-types

# 运行 lint
pnpm lint
```

**验证标准**：
- [ ] 所有测试通过
- [ ] 类型检查通过
- [ ] lint 通过

### 5.2 第 9 天：迁移 getApiMetrics.ts 和 support-prompt.ts

#### 上午任务（4 小时）

##### 任务 3.4：迁移 getApiMetrics.ts（2 小时）

**步骤 3.4.1**：移动文件（30 分钟）

```bash
mv src/shared/getApiMetrics.ts src/core/task/managers/monitoring/metrics-utils.ts
```

**步骤 3.4.2**：更新导入路径（1 小时）

搜索所有使用 `@shared/getApiMetrics` 的文件并更新：

```typescript
// 从
import { getApiMetrics, hasTokenUsageChanged, hasToolUsageChanged } from "@shared/getApiMetrics"

// 改为
import { getApiMetrics, hasTokenUsageChanged, hasToolUsageChanged } from "@core/task/managers/monitoring/metrics-utils"
```

**步骤 3.4.3**：删除原文件（30 分钟）

```bash
rm src/shared/getApiMetrics.ts
```

**验证标准**：
- [ ] 文件移动成功
- [ ] 所有导入路径已更新
- [ ] 原文件已删除
- [ ] 相关测试通过

##### 任务 3.5：迁移 support-prompt.ts（2 小时）

**步骤 3.5.1**：移动文件（30 分钟）

```bash
mv src/shared/support-prompt.ts src/core/prompts/support-prompt.ts
```

**步骤 3.5.2**：更新导入路径（1 小时）

搜索所有使用 `@shared/support-prompt` 的文件并更新：

```typescript
// 从
import { supportPrompt, SupportPromptType } from "@shared/support-prompt"

// 改为
import { supportPrompt, SupportPromptType } from "@core/prompts/support-prompt"
```

**步骤 3.5.3**：删除原文件（30 分钟）

```bash
rm src/shared/support-prompt.ts
```

**验证标准**：
- [ ] 文件移动成功
- [ ] 所有导入路径已更新
- [ ] 原文件已删除
- [ ] 相关测试通过

#### 下午任务（4 小时）

##### 任务 3.6：运行测试和修复（4 小时）

```bash
# 运行测试
pnpm test

# 修复问题
# 重新运行测试
pnpm test

# 运行类型检查
pnpm check-types

# 运行 lint
pnpm lint
```

**验证标准**：
- [ ] 所有测试通过
- [ ] 类型检查通过
- [ ] lint 通过

### 5.3 第 10 天：迁移 embeddingModels.ts 和 context-mentions.ts，阶段 3 验证

#### 上午任务（4 小时）

##### 任务 3.7：迁移 embeddingModels.ts（2 小时）

**步骤 3.7.1**：移动文件（30 分钟）

```bash
mv src/shared/embeddingModels.ts src/services/code-index/embedding-models.ts
```

**步骤 3.7.2**：更新导入路径（1 小时）

搜索所有使用 `@shared/embeddingModels` 的文件并更新：

```typescript
// 从
import { getModelDimension, getModelScoreThreshold } from "@shared/embeddingModels"

// 改为
import { getModelDimension, getModelScoreThreshold } from "@services/code-index/embedding-models"
```

**步骤 3.7.3**：删除原文件（30 分钟）

```bash
rm src/shared/embeddingModels.ts
```

**验证标准**：
- [ ] 文件移动成功
- [ ] 所有导入路径已更新
- [ ] 原文件已删除
- [ ] 相关测试通过

##### 任务 3.8：迁移 context-mentions.ts（2 小时）

**步骤 3.8.1**：移动文件（30 分钟）

```bash
mv src/shared/context-mentions.ts src/utils/context-mentions.ts
```

**步骤 3.8.2**：更新导入路径（1 小时）

搜索所有使用 `@shared/context-mentions` 的文件并更新：

```typescript
// 从
import { mentionRegex, mentionRegexGlobal } from "@shared/context-mentions"

// 改为
import { mentionRegex, mentionRegexGlobal } from "@utils/context-mentions"
```

**步骤 3.8.3**：删除原文件（30 分钟）

```bash
rm src/shared/context-mentions.ts
```

**验证标准**：
- [ ] 文件移动成功
- [ ] 所有导入路径已更新
- [ ] 原文件已删除
- [ ] 相关测试通过

#### 下午任务（4 小时）

##### 任务 3.9：完整验证（4 小时）

```bash
# 运行完整测试套件
pnpm test

# 运行类型检查
pnpm check-types

# 运行 lint
pnpm lint

# 构建项目
pnpm build

# 手动测试关键功能
# 1. 启动 VS Code 扩展
# 2. 测试 API 指标
# 3. 测试支持提示词
# 4. 测试代码索引
# 5. 测试上下文提及
```

**验证标准**：
- [ ] 所有测试通过
- [ ] 类型检查通过
- [ ] lint 通过
- [ ] 构建成功
- [ ] 手动测试通过

##### 任务 3.10：提交代码（2 小时）

```bash
# 添加所有更改
git add .

# 提交代码
git commit -m "refactor: migrate medium-priority modules from shared

- Move combineApiRequests.ts to src/core/task/managers/api/message-utils.ts
- Move combineCommandSequences.ts to src/core/task/managers/messaging/message-utils.ts
- Move getApiMetrics.ts to src/core/task/managers/monitoring/metrics-utils.ts
- Move support-prompt.ts to src/core/prompts/support-prompt.ts
- Move embeddingModels.ts to src/services/code-index/embedding-models.ts
- Move context-mentions.ts to src/utils/context-mentions.ts

This further reduces cross-layer dependencies and improves module organization."

# 推送到远程（如果需要）
git push origin backup-before-refactoring
```

**验证标准**：
- [ ] 代码已提交
- [ ] 提交信息清晰
- [ ] 可以开始阶段 4

##### 任务 3.11：更新执行日志（2 小时）

在 `refactoring-log.md` 中记录阶段 3 的完成情况。

**验证标准**：
- [ ] 执行日志已更新
- [ ] 可以追踪进度

---

## 六、阶段 4：低优先级模块迁移（第 11-12 天，可选）

**目标**：迁移低优先级的特定模块功能到相应位置（可选）

### 6.1 第 11 天：迁移 experiments.ts 和 cost.ts

#### 上午任务（4 小时）

##### 任务 4.1：迁移 experiments.ts（2 小时）

**步骤 4.1.1**：移动文件（30 分钟）

```bash
mv src/shared/experiments.ts src/core/experiments/experiment-utils.ts
```

**步骤 4.1.2**：更新导入路径（1 小时）

搜索所有使用 `@shared/experiments` 的文件并更新：

```typescript
// 从
import { EXPERIMENT_IDS, experimentConfigsMap, experimentDefault } from "@shared/experiments"

// 改为
import { EXPERIMENT_IDS, experimentConfigsMap, experimentDefault } from "@core/experiments/experiment-utils"
```

**步骤 4.1.3**：删除原文件（30 分钟）

```bash
rm src/shared/experiments.ts
```

**验证标准**：
- [ ] 文件移动成功
- [ ] 所有导入路径已更新
- [ ] 原文件已删除
- [ ] 相关测试通过

##### 任务 4.2：迁移 cost.ts（2 小时）

**步骤 4.2.1**：移动文件（30 分钟）

```bash
mv src/shared/cost.ts src/api/cost-utils.ts
```

**步骤 4.2.2**：更新导入路径（1 小时）

搜索所有使用 `@shared/cost` 的文件并更新：

```typescript
// 从
import { calculateApiCostAnthropic, calculateApiCostOpenAI } from "@shared/cost"

// 改为
import { calculateApiCostAnthropic, calculateApiCostOpenAI } from "@api/cost-utils"
```

**步骤 4.2.3**：删除原文件（30 分钟）

```bash
rm src/shared/cost.ts
```

**验证标准**：
- [ ] 文件移动成功
- [ ] 所有导入路径已更新
- [ ] 原文件已删除
- [ ] 相关测试通过

#### 下午任务（4 小时）

##### 任务 4.3：运行测试和修复（4 小时）

```bash
# 运行测试
pnpm test

# 修复问题
# 重新运行测试
pnpm test

# 运行类型检查
pnpm check-types

# 运行 lint
pnpm lint
```

**验证标准**：
- [ ] 所有测试通过
- [ ] 类型检查通过
- [ ] lint 通过

### 6.2 第 12 天：迁移 browserUtils.ts、parse-command.ts 和 todo.ts

#### 上午任务（4 小时）

##### 任务 4.4：迁移 browserUtils.ts（1.5 小时）

**步骤 4.4.1**：移动文件（30 分钟）

```bash
mv src/shared/browserUtils.ts src/core/webview/browser-utils.ts
```

**步骤 4.4.2**：更新导入路径（1 小时）

搜索所有使用 `@shared/browserUtils` 的文件并更新：

```typescript
// 从
import { scaleCoordinate, prettyKey } from "@shared/browserUtils"

// 改为
import { scaleCoordinate, prettyKey } from "@core/webview/browser-utils"
```

**步骤 4.4.3**：删除原文件（30 分钟）

```bash
rm src/shared/browserUtils.ts
```

**验证标准**：
- [ ] 文件移动成功
- [ ] 所有导入路径已更新
- [ ] 原文件已删除
- [ ] 相关测试通过

##### 任务 4.5：迁移 parse-command.ts（1.5 小时）

**步骤 4.5.1**：移动文件（30 分钟）

```bash
mv src/shared/parse-command.ts src/core/tools/command-parser.ts
```

**步骤 4.5.2**：更新导入路径（1 小时）

搜索所有使用 `@shared/parse-command` 的文件并更新：

```typescript
// 从
import { parseCommand } from "@shared/parse-command"

// 改为
import { parseCommand } from "@core/tools/command-parser"
```

**步骤 4.5.3**：删除原文件（30 分钟）

```bash
rm src/shared/parse-command.ts
```

**验证标准**：
- [ ] 文件移动成功
- [ ] 所有导入路径已更新
- [ ] 原文件已删除
- [ ] 相关测试通过

#### 下午任务（4 小时）

##### 任务 4.6：迁移 todo.ts（2 小时）

**步骤 4.6.1**：移动文件（30 分钟）

```bash
mv src/shared/todo.ts src/core/task/managers/todo-utils.ts
```

**步骤 4.6.2**：更新导入路径（1 小时）

搜索所有使用 `@shared/todo` 的文件并更新：

```typescript
// 从
import { getTodosFromMessages } from "@shared/todo"

// 改为
import { getTodosFromMessages } from "@core/task/managers/todo-utils"
```

**步骤 4.6.3**：删除原文件（30 分钟）

```bash
rm src/shared/todo.ts
```

**验证标准**：
- [ ] 文件移动成功
- [ ] 所有导入路径已更新
- [ ] 原文件已删除
- [ ] 相关测试通过

##### 任务 4.7：运行测试和修复（2 小时）

```bash
# 运行测试
pnpm test

# 修复问题
# 重新运行测试
pnpm test

# 运行类型检查
pnpm check-types

# 运行 lint
pnpm lint
```

**验证标准**：
- [ ] 所有测试通过
- [ ] 类型检查通过
- [ ] lint 通过

---

## 七、阶段 5：清理与优化（第 13 天）

**目标**：清理残留文件，优化导入路径，更新文档

### 7.1 上午任务（4 小时）

#### 任务 5.1：清理测试文件（2 小时）

**步骤 5.1.1**：移动测试文件（1.5 小时）

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

**步骤 5.1.2**：更新测试文件中的导入路径（30 分钟）

逐个更新移动的测试文件中的导入路径。

**验证标准**：
- [ ] 所有测试文件已移动
- [ ] 导入路径已更新
- [ ] 测试可以运行

#### 任务 5.2：删除原测试目录（2 小时）

```bash
# 删除原测试目录
rm -rf src/shared/__tests__

# 验证删除成功
ls -la src/shared/
```

**验证标准**：
- [ ] 原测试目录已删除
- [ ] shared 目录结构清晰

### 7.2 下午任务（4 小时）

#### 任务 5.3：更新 shared/index.ts（2 小时）

添加重新导出（保持向后兼容）：

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
export { calculateApiCostAnthropic, calculateApiCostOpenAI } from "@api/cost-utils"
export { scaleCoordinate, prettyKey } from "../core/webview/browser-utils"
export { parseCommand } from "../core/tools/command-parser"
export { getTodosFromMessages } from "../core/task/managers/todo-utils"
export { mentionRegex, mentionRegexGlobal } from "../utils/context-mentions"
export { stringifyVsCodeLmModelSelector } from "../utils/vsCodeSelectorUtils"
```

**验证标准**：
- [ ] 重新导出已添加
- [ ] 向后兼容性保持
- [ ] 导入路径正确

#### 任务 5.4：更新文档（2 小时）

**步骤 5.4.1**：更新 README（1 小时）

在项目 README 中更新目录结构说明。

**步骤 5.4.2**：创建迁移指南（1 小时）

创建 `docs/refactoring/shared-refactoring-guide.md`。

**验证标准**：
- [ ] README 已更新
- [ ] 迁移指南已创建
- [ ] 文档清晰易懂

### 7.3 阶段 5 验证（4 小时）

#### 任务 5.5：完整验证（4 小时）

```bash
# 运行所有测试
pnpm test

# 运行类型检查
pnpm check-types

# 运行 lint
pnpm lint

# 构建项目
pnpm build

# 手动测试所有关键功能
# 1. 启动 VS Code 扩展
# 2. 测试所有 mode
# 3. 测试所有 tool
# 4. 测试 MCP 功能
# 5. 测试 API 配置
# 6. 测试代码索引
# 7. 测试实验功能
# 8. 测试浏览器功能
# 9. 测试命令解析
# 10. 测试 todo 功能
```

**验证标准**：
- [ ] 所有测试通过
- [ ] 类型检查通过
- [ ] lint 通过
- [ ] 构建成功
- [ ] 所有手动测试通过

#### 任务 5.6：提交代码（2 小时）

```bash
# 添加所有更改
git add .

# 提交代码
git commit -m "refactor: complete shared directory refactoring

- Move all test files to appropriate locations
- Update shared/index.ts with re-exports for backward compatibility
- Update README and documentation
- Clean up shared/__tests__ directory

This completes the shared directory refactoring, reducing cross-layer
dependencies and improving module organization."

# 推送到远程（如果需要）
git push origin backup-before-refactoring

# 合并到主分支（如果需要）
git checkout main
git merge backup-before-refactoring
git push origin main
```

**验证标准**：
- [ ] 代码已提交
- [ ] 提交信息清晰
- [ ] 已合并到主分支

#### 任务 5.7：更新执行日志（2 小时）

在 `refactoring-log.md` 中记录阶段 5 的完成情况和总结。

**验证标准**：
- [ ] 执行日志已更新
- [ ] 重构完成总结已记录

---

## 八、每日执行检查清单

### 8.1 每日开始前

- [ ] 检查当前阶段和任务
- [ ] 确认昨日工作已完成
- [ ] 查看执行日志，了解进度
- [ ] 准备今日工作计划

### 8.2 每日工作中

- [ ] 按照任务清单执行
- [ ] 每完成一个任务，验证一次
- [ ] 遇到问题及时记录
- [ ] 遇到问题及时解决

### 8.3 每日工作结束前

- [ ] 运行测试
- [ ] 运行类型检查
- [ ] 运行 lint
- [ ] 提交代码（如果完成阶段）
- [ ] 更新执行日志

### 8.4 每阶段完成时

- [ ] 完整验证
- [ ] 手动测试关键功能
- [ ] 提交代码
- [ ] 更新执行日志
- [ ] 准备下一阶段

---

## 附录

### A. 紧急联系人

如有问题，请联系项目维护者或在项目中创建 issue。

### B. 回滚计划

如果遇到严重问题，可以按以下步骤回滚：

```bash
# 切换到备份分支
git checkout backup-before-refactoring

# 或者恢复备份文件
rm -rf src/shared
cp -r src/shared.backup src/shared
```

### C. 相关文档

- [完整任务清单](./shared-refactoring-complete-checklist.md)
- [项目规则](../.trae/rules/project_rules.md)

---

**文档版本**：1.0
**最后更新**：2026-01-21
**维护者**：Roo Code Team
