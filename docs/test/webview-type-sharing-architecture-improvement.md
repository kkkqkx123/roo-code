# Webview前后端类型共享架构改进分析

## 目录
1. [现状分析](#现状分析)
2. [问题识别](#问题识别)
3. [架构改进方案](#架构改进方案)
4. [实施计划](#实施计划)
5. [风险评估](#风险评估)

---

## 现状分析

### 1. 当前架构概述

当前Roo-Code项目的类型共享架构如下：

```
Roo-Code/
├── src/
│   ├── shared/              # 前后端共享模块
│   │   ├── types/           # 类型定义
│   │   ├── schemas/         # Zod schema定义
│   │   ├── i18n/            # 国际化资源
│   │   └── utils/           # 工具函数
│   ├── core/                # 核心业务逻辑
│   ├── services/            # 后台服务
│   └── api/                 # API集成
└── webview-ui/              # 前端webview
```

### 2. Webview中的导入分析

#### 2.1 从@shared/types的导入

webview-ui中从@shared/types导入的类型包括：

- **消息类型**: `ClineMessage`, `ClineAsk`, `ToolProgressStatus`, `ToolGroup`, `ToolName`, `FileEntry`, `BrowserActionParams`
- **工具类型**: `ToolProtocol`, `ToolResponse`, `AskApproval`, `HandleError`, `PushToolResult`, `RemoveClosingTag`, `AskFinishSubTaskApproval`, `ToolDescription`, `ToolParamName`
- **配置类型**: `ModelInfo`, `ProviderSettings`, `VectorStorageConfig`, `CustomVectorStorageConfig`
- **实验类型**: `AssertEqual`, `Equals`, `Keys`, `Values`, `ExperimentId`, `Experiments`
- **其他类型**: `TokenUsage`, `ToolUsage`, `SECRET_STATE_KEYS`

#### 2.2 从core模块的导入

webview-ui中从core模块导入的模块包括：

| 模块路径 | 用途 | 是否应该移到shared |
|---------|------|------------------|
| `core/task/managers/api/message-utils.ts` | 合并API请求消息 | 是 |
| `core/task/managers/messaging/message-utils.ts` | 消息处理工具函数 | 是 |
| `core/task/managers/monitoring/metrics-utils.ts` | API指标计算 | 是 |
| `core/webview/browser-utils.ts` | 浏览器坐标缩放、按键格式化 | 是 |
| `core/task/managers/todo-utils.ts` | 获取最新待办事项 | 是 |
| `core/tools/command-parser.ts` | 命令行解析 | 是 |
| `core/tools/tool-utils.ts` | 工具协议配置 | 是 |
| `core/experiments/experiment-utils.ts` | 实验配置管理 | 是 |
| `core/constants/default-values.ts` | 默认值常量 | 是 |
| `core/providers/config-utils.ts` | 配置检查工具 | 是 |
| `core/prompts/support-prompt.ts` | 支持提示模板 | 否 |
| `core/tools/tool-config.ts` | 工具配置类型和常量 | 是 |

#### 2.3 从services模块的导入

webview-ui中从services模块导入的模块包括：

| 模块路径 | 用途 | 是否应该移到shared |
|---------|------|------------------|
| `services/mcp/mcp-types.ts` | MCP类型定义 | 是 |
| `services/code-index/config.ts` | 代码索引配置 | 是 |
| `services/code-index/embedding-models.ts` | 嵌入模型配置 | 是 |
| `services/code-index/vector-storage-presets.ts` | 向量存储预设 | 是 |

#### 2.4 从api模块的导入

webview-ui中从api模块导入的模块包括：

| 模块路径 | 用途 | 是否应该移到shared |
|---------|------|------------------|
| `api/api-utils.ts` | API工具函数 | 是 |

---

## 问题识别

### 1. 架构问题

#### 1.1 依赖关系混乱

- **问题**: webview直接从core、services、api等模块导入，导致前后端边界不清晰
- **影响**: 
  - 前端代码依赖后端模块结构
  - 增加了打包复杂度
  - 难以独立开发和测试前端

#### 1.2 shared模块位置不当

- **问题**: shared模块位于src目录下，暗示它是后端代码的一部分
- **影响**:
  - 概念上shared应该独立于前后端
  - 不利于未来可能的monorepo扩展
  - 增加了打包配置的复杂度

#### 1.3 类型定义分散

- **问题**: 类型定义分散在shared/types、core、services、api等多个位置
- **影响**:
  - 难以维护类型一致性
  - 容易出现类型定义重复
  - 增加了导入路径的复杂度

### 2. 打包问题

#### 2.1 构建配置复杂

当前webview的构建需要配置多个路径别名：

```typescript
// webview-ui/vite.config.ts
resolve: {
  alias: {
    "@shared": resolve(__dirname, "../src/shared"),
    "@shared/types": resolve(__dirname, "../src/shared/types"),
    "@shared/types/*": resolve(__dirname, "../src/shared/types/*"),
    "@shared/schemas": resolve(__dirname, "../src/shared/schemas"),
    "@shared/schemas/*": resolve(__dirname, "../src/shared/schemas/*"),
    "@shared/i18n": resolve(__dirname, "../src/shared/i18n"),
    "@shared/i18n/*": resolve(__dirname, "../src/shared/i18n/*"),
    "@shared/utils": resolve(__dirname, "../src/shared/utils"),
    "@shared/utils/*": resolve(__dirname, "../src/shared/utils/*"),
    // 还需要从core、services、api导入
  }
}
```

#### 2.2 类型检查不一致

- **问题**: webview和后端使用不同的TypeScript配置
- **影响**: 可能导致类型检查结果不一致

### 3. 开发体验问题

#### 3.1 导入路径复杂

```typescript
// 当前导入方式
import { combineApiRequests } from "../../core/task/managers/api/message-utils"
import { getApiMetrics } from "../../core/task/managers/monitoring/metrics-utils"
import { scaleCoordinate } from "../../core/webview/browser-utils"
import { parseCommand } from "../../core/tools/command-parser"
```

#### 3.2 模块职责不清

- **问题**: 一些工具函数既在前端使用，也在后端使用，但放在core或services目录下
- **影响**: 开发者难以确定应该在哪里添加新的共享功能

---

## 架构改进方案

### 方案一：将shared从src中拆分（推荐）

#### 1. 新的目录结构

```
Roo-Code/
├── shared/                    # 前后端共享模块（独立于src）
│   ├── types/                # 类型定义
│   │   ├── index.ts          # 统一导出所有类型
│   │   ├── api.ts            # API相关类型
│   │   ├── message.ts        # 消息类型
│   │   ├── tool.ts           # 工具类型
│   │   ├── config.ts         # 配置类型
│   │   └── ...
│   ├── schemas/              # Zod schema定义
│   │   ├── index.ts
│   │   ├── MessageTypes.ts
│   │   └── ...
│   ├── utils/                # 工具函数
│   │   ├── index.ts
│   │   ├── message-utils.ts  # 消息处理工具
│   │   ├── metrics-utils.ts  # 指标计算工具
│   │   ├── browser-utils.ts  # 浏览器工具
│   │   ├── command-parser.ts # 命令解析工具
│   │   ├── config-utils.ts   # 配置工具
│   │   └── ...
│   ├── constants/            # 常量定义
│   │   ├── index.ts
│   │   ├── default-values.ts
│   │   ├── tool-constants.ts
│   │   └── ...
│   ├── config/               # 配置定义
│   │   ├── index.ts
│   │   ├── experiment-config.ts
│   │   ├── embedding-models.ts
│   │   ├── vector-storage-presets.ts
│   │   └── ...
│   ├── i18n/                 # 国际化资源
│   │   └── ...
│   └── package.json          # 独立的package.json
├── src/
│   ├── core/                 # 核心业务逻辑（仅后端）
│   ├── services/             # 后台服务（仅后端）
│   └── api/                  # API集成（仅后端）
└── webview-ui/               # 前端webview
```

#### 2. 需要移动的模块

##### 从core移动到shared/utils

- `core/task/managers/api/message-utils.ts` → `shared/utils/message-utils.ts`
- `core/task/managers/messaging/message-utils.ts` → `shared/utils/message-utils.ts`（合并）
- `core/task/managers/monitoring/metrics-utils.ts` → `shared/utils/metrics-utils.ts`
- `core/webview/browser-utils.ts` → `shared/utils/browser-utils.ts`
- `core/task/managers/todo-utils.ts` → `shared/utils/todo-utils.ts`
- `core/tools/command-parser.ts` → `shared/utils/command-parser.ts`
- `core/tools/tool-utils.ts` → `shared/utils/tool-utils.ts`
- `core/providers/config-utils.ts` → `shared/utils/config-utils.ts`

##### 从core移动到shared/constants

- `core/constants/default-values.ts` → `shared/constants/default-values.ts`
- `core/tools/tool-config.ts` 中的常量 → `shared/constants/tool-constants.ts`

##### 从core移动到shared/config

- `core/experiments/experiment-utils.ts` → `shared/config/experiment-config.ts`
- `core/tools/tool-config.ts` 中的类型 → `shared/types/tool.ts`

##### 从services移动到shared

- `services/mcp/mcp-types.ts` → `shared/types/mcp.ts`
- `services/code-index/config.ts` → `shared/config/code-index-config.ts`
- `services/code-index/embedding-models.ts` → `shared/config/embedding-models.ts`
- `services/code-index/vector-storage-presets.ts` → `shared/config/vector-storage-presets.ts`

##### 从api移动到shared

- `api/api-utils.ts` → `shared/utils/api-utils.ts`

#### 3. shared/package.json

```json
{
  "name": "@roo-code/shared",
  "version": "1.0.0",
  "type": "module",
  "main": "./index.ts",
  "types": "./index.ts",
  "exports": {
    ".": "./index.ts",
    "./types": "./types/index.ts",
    "./types/*": "./types/*.ts",
    "./schemas": "./schemas/index.ts",
    "./schemas/*": "./schemas/*.ts",
    "./utils": "./utils/index.ts",
    "./utils/*": "./utils/*.ts",
    "./constants": "./constants/index.ts",
    "./constants/*": "./constants/*.ts",
    "./config": "./config/index.ts",
    "./config/*": "./config/*.ts",
    "./i18n": "./i18n/index.ts",
    "./i18n/*": "./i18n/*.ts"
  },
  "dependencies": {
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "typescript": "^5.3.3"
  }
}
```

#### 4. 更新webview-ui/vite.config.ts

```typescript
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../shared"),
      "@shared/types": path.resolve(__dirname, "../shared/types"),
      "@shared/types/*": path.resolve(__dirname, "../shared/types/*"),
      "@shared/schemas": path.resolve(__dirname, "../shared/schemas"),
      "@shared/schemas/*": path.resolve(__dirname, "../shared/schemas/*"),
      "@shared/utils": path.resolve(__dirname, "../shared/utils"),
      "@shared/utils/*": path.resolve(__dirname, "../shared/utils/*"),
      "@shared/constants": path.resolve(__dirname, "../shared/constants"),
      "@shared/constants/*": path.resolve(__dirname, "../shared/constants/*"),
      "@shared/config": path.resolve(__dirname, "../shared/config"),
      "@shared/config/*": path.resolve(__dirname, "../shared/config/*"),
      "@shared/i18n": path.resolve(__dirname, "../shared/i18n"),
      "@shared/i18n/*": path.resolve(__dirname, "../shared/i18n/*"),
    },
  },
})
```

#### 5. 更新src/tsconfig.json

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["../shared/*"],
      "@shared/types": ["../shared/types"],
      "@shared/types/*": ["../shared/types/*"],
      "@shared/schemas": ["../shared/schemas"],
      "@shared/schemas/*": ["../shared/schemas/*"],
      "@shared/utils": ["../shared/utils"],
      "@shared/utils/*": ["../shared/utils/*"],
      "@shared/constants": ["../shared/constants"],
      "@shared/constants/*": ["../shared/constants/*"],
      "@shared/config": ["../shared/config"],
      "@shared/config/*": ["../shared/config/*"],
      "@shared/i18n": ["../shared/i18n"],
      "@shared/i18n/*": ["../shared/i18n/*"]
    }
  }
}
```

#### 6. 更新src/esbuild.mjs

```javascript
import esbuild from "esbuild"
import { glob } from "glob"
import { copyFileSync, mkdirSync, existsSync } from "fs"
import path from "path"

const sharedDir = path.resolve(process.cwd(), "../shared")

// 复制shared目录到out目录
function copySharedDir() {
  const outSharedDir = path.resolve(process.cwd(), "out/shared")
  if (!existsSync(outSharedDir)) {
    mkdirSync(outSharedDir, { recursive: true })
  }
  
  // 复制shared目录下的所有文件
  const files = glob.sync("**/*", { cwd: sharedDir, nodir: true })
  for (const file of files) {
    const srcFile = path.join(sharedDir, file)
    const destFile = path.join(outSharedDir, file)
    const destDir = path.dirname(destFile)
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true })
    }
    copyFileSync(srcFile, destFile)
  }
}

// 在构建完成后调用
await build()
copySharedDir()
```

### 方案二：保持shared在src中，但优化导入（备选）

如果不想将shared从src中拆分，可以采用以下优化方案：

#### 1. 创建统一的导出入口

在`src/shared/index.ts`中统一导出所有需要在前端使用的模块：

```typescript
// src/shared/index.ts
export * from "./types"
export * from "./schemas"
export * from "./i18n"
export * from "./utils"

// 导出core中的共享工具
export { combineApiRequests } from "../core/task/managers/api/message-utils"
export { combineCommandSequences, isBlockingAsk, isNonBlockingAsk, isMutableAsk, isTerminalAsk } from "../core/task/managers/messaging/message-utils"
export { getApiMetrics, hasTokenUsageChanged, hasToolUsageChanged } from "../core/task/managers/monitoring/metrics-utils"
export { scaleCoordinate, prettyKey } from "../core/webview/browser-utils"
export { getLatestTodo } from "../core/task/managers/todo-utils"
export { parseCommand } from "../core/tools/command-parser"
export { isNativeProtocol, getEffectiveProtocol } from "../core/tools/tool-utils"
export { experiments, experimentDefault } from "../core/experiments/experiment-utils"
export { checkExistKey } from "../core/providers/config-utils"

// 导出services中的共享类型
export type { McpErrorEntry, McpServer, McpTool, McpResource, McpResourceTemplate, McpResourceResponse } from "../services/mcp/mcp-types"
export { EMBEDDING_MODEL_PROFILES, getModelDimension } from "../services/code-index/embedding-models"
export { VECTOR_STORAGE_PRESETS } from "../services/code-index/vector-storage-presets"

// 导出api中的共享工具
export { shouldUseReasoningBudget, shouldUseReasoningEffort } from "../api/api-utils"

// 导出常量
export { DEFAULT_WRITE_DELAY_MS, DEFAULT_TERMINAL_OUTPUT_CHARACTER_LIMIT, MIN_CHECKPOINT_TIMEOUT_SECONDS, MAX_CHECKPOINT_TIMEOUT_SECONDS, DEFAULT_CHECKPOINT_TIMEOUT_SECONDS, DEFAULT_CONSECUTIVE_MISTAKE_LIMIT } from "../core/constants/default-values"
export { TOOL_PROTOCOL, NATIVE_TOOL_DEFAULTS } from "../core/tools/tool-utils"
```

#### 2. 简化webview中的导入

```typescript
// 简化后的导入方式
import { 
  combineApiRequests, 
  getApiMetrics, 
  scaleCoordinate, 
  parseCommand 
} from "@shared"
```

---

## 实施计划

### 阶段一：准备阶段（1-2天）

1. **创建shared目录结构**
   - 创建`shared/`目录
   - 创建子目录：`types/`, `schemas/`, `utils/`, `constants/`, `config/`, `i18n/`

2. **创建shared/package.json**
   - 配置独立的package.json
   - 配置exports字段

3. **更新根package.json**
   - 添加workspace配置
   - 配置shared为workspace依赖

### 阶段二：迁移阶段（3-5天）

1. **迁移类型定义**
   - 移动`src/shared/types/` → `shared/types/`
   - 移动`src/shared/schemas/` → `shared/schemas/`
   - 移动`services/mcp/mcp-types.ts` → `shared/types/mcp.ts`

2. **迁移工具函数**
   - 移动`core/task/managers/api/message-utils.ts` → `shared/utils/message-utils.ts`
   - 移动`core/task/managers/messaging/message-utils.ts` → `shared/utils/message-utils.ts`（合并）
   - 移动`core/task/managers/monitoring/metrics-utils.ts` → `shared/utils/metrics-utils.ts`
   - 移动`core/webview/browser-utils.ts` → `shared/utils/browser-utils.ts`
   - 移动`core/task/managers/todo-utils.ts` → `shared/utils/todo-utils.ts`
   - 移动`core/tools/command-parser.ts` → `shared/utils/command-parser.ts`
   - 移动`core/tools/tool-utils.ts` → `shared/utils/tool-utils.ts`
   - 移动`core/providers/config-utils.ts` → `shared/utils/config-utils.ts`
   - 移动`api/api-utils.ts` → `shared/utils/api-utils.ts`

3. **迁移常量定义**
   - 移动`core/constants/default-values.ts` → `shared/constants/default-values.ts`
   - 提取`core/tools/tool-config.ts`中的常量 → `shared/constants/tool-constants.ts`

4. **迁移配置定义**
   - 移动`core/experiments/experiment-utils.ts` → `shared/config/experiment-config.ts`
   - 移动`services/code-index/config.ts` → `shared/config/code-index-config.ts`
   - 移动`services/code-index/embedding-models.ts` → `shared/config/embedding-models.ts`
   - 移动`services/code-index/vector-storage-presets.ts` → `shared/config/vector-storage-presets.ts`

5. **迁移国际化资源**
   - 移动`src/shared/i18n/` → `shared/i18n/`

### 阶段三：更新导入（2-3天）

1. **更新webview-ui中的导入**
   - 搜索所有从core、services、api导入的语句
   - 替换为从@shared导入

2. **更新src中的导入**
   - 搜索所有从src/shared导入的语句
   - 替换为从@shared导入

3. **更新配置文件**
   - 更新`webview-ui/vite.config.ts`
   - 更新`webview-ui/tsconfig.json`
   - 更新`src/tsconfig.json`
   - 更新`src/esbuild.mjs`

### 阶段四：测试阶段（2-3天）

1. **类型检查**
   - 运行`pnpm check-types`
   - 修复类型错误

2. **构建测试**
   - 运行`pnpm build`
   - 修复构建错误

3. **功能测试**
   - 运行`pnpm test`
   - 修复功能错误

4. **手动测试**
   - 启动VS Code扩展
   - 测试webview功能
   - 测试前后端通信

### 阶段五：清理阶段（1天）

1. **删除旧的shared目录**
   - 删除`src/shared/`目录

2. **更新文档**
   - 更新README.md
   - 更新开发文档

3. **提交代码**
   - 创建commit
   - 创建PR

---

## 风险评估

### 高风险

1. **大规模重构**
   - **风险**: 涉及大量文件的移动和导入更新
   - **缓解**: 分阶段实施，每个阶段都进行充分测试

2. **类型兼容性**
   - **风险**: 移动类型定义可能导致类型不兼容
   - **缓解**: 使用TypeScript的严格模式，及时发现类型错误

### 中风险

1. **构建配置错误**
   - **风险**: 更新构建配置可能导致构建失败
   - **缓解**: 在测试环境中充分测试构建配置

2. **导入路径错误**
   - **风险**: 更新导入路径可能导致运行时错误
   - **缓解**: 使用IDE的重构功能，减少手动修改

### 低风险

1. **性能影响**
   - **风险**: 新的架构可能影响构建性能
   - **缓解**: 使用缓存和增量构建

2. **开发体验**
   - **风险**: 新的导入方式可能影响开发体验
   - **缓解**: 提供清晰的文档和示例

---

## 总结

### 推荐方案

**推荐采用方案一：将shared从src中拆分**

### 理由

1. **清晰的架构边界**: shared独立于前后端，符合monorepo的最佳实践
2. **简化的依赖关系**: webview只依赖shared，不依赖core、services、api
3. **更好的可维护性**: 共享代码集中管理，易于维护和更新
4. **更好的扩展性**: 未来可以轻松添加新的workspace包

### 预期收益

1. **开发效率提升**: 导入路径简化，开发体验改善
2. **构建性能提升**: 减少不必要的依赖，构建速度提升
3. **代码质量提升**: 架构清晰，易于理解和维护
4. **测试覆盖率提升**: shared模块可以独立测试

### 实施建议

1. **分阶段实施**: 按照实施计划的阶段逐步推进
2. **充分测试**: 每个阶段都进行充分的测试
3. **文档更新**: 及时更新文档，帮助团队成员适应新的架构
4. **代码审查**: 严格进行代码审查，确保代码质量

---

## 附录

### A. 需要移动的文件清单

#### 从src/shared移动到shared

- `src/shared/types/` → `shared/types/`
- `src/shared/schemas/` → `shared/schemas/`
- `src/shared/i18n/` → `shared/i18n/`
- `src/shared/utils/` → `shared/utils/`

#### 从core移动到shared

- `src/core/task/managers/api/message-utils.ts` → `shared/utils/message-utils.ts`
- `src/core/task/managers/messaging/message-utils.ts` → `shared/utils/message-utils.ts`（合并）
- `src/core/task/managers/monitoring/metrics-utils.ts` → `shared/utils/metrics-utils.ts`
- `src/core/webview/browser-utils.ts` → `shared/utils/browser-utils.ts`
- `src/core/task/managers/todo-utils.ts` → `shared/utils/todo-utils.ts`
- `src/core/tools/command-parser.ts` → `shared/utils/command-parser.ts`
- `src/core/tools/tool-utils.ts` → `shared/utils/tool-utils.ts`
- `src/core/experiments/experiment-utils.ts` → `shared/config/experiment-config.ts`
- `src/core/constants/default-values.ts` → `shared/constants/default-values.ts`
- `src/core/providers/config-utils.ts` → `shared/utils/config-utils.ts`
- `src/core/tools/tool-config.ts` → 拆分到`shared/types/tool.ts`和`shared/constants/tool-constants.ts`

#### 从services移动到shared

- `src/services/mcp/mcp-types.ts` → `shared/types/mcp.ts`
- `src/services/code-index/config.ts` → `shared/config/code-index-config.ts`
- `src/services/code-index/embedding-models.ts` → `shared/config/embedding-models.ts`
- `src/services/code-index/vector-storage-presets.ts` → `shared/config/vector-storage-presets.ts`

#### 从api移动到shared

- `src/api/api-utils.ts` → `shared/utils/api-utils.ts`

### B. 需要更新的导入清单

#### webview-ui中的导入更新

```typescript
// 之前
import { combineApiRequests } from "../../core/task/managers/api/message-utils"
import { getApiMetrics } from "../../core/task/managers/monitoring/metrics-utils"
import { scaleCoordinate } from "../../core/webview/browser-utils"
import { parseCommand } from "../../core/tools/command-parser"
import type { McpServer } from "../../services/mcp/mcp-types"
import { EMBEDDING_MODEL_PROFILES } from "../../services/code-index/embedding-models"

// 之后
import { combineApiRequests } from "@shared/utils/message-utils"
import { getApiMetrics } from "@shared/utils/metrics-utils"
import { scaleCoordinate } from "@shared/utils/browser-utils"
import { parseCommand } from "@shared/utils/command-parser"
import type { McpServer } from "@shared/types/mcp"
import { EMBEDDING_MODEL_PROFILES } from "@shared/config/embedding-models"
```

#### src中的导入更新

```typescript
// 之前
import { ClineMessage } from "../shared/types"
import { safeJsonParse } from "../shared/safeJsonParse"

// 之后
import { ClineMessage } from "@shared/types"
import { safeJsonParse } from "@shared/utils/safeJsonParse"
```

### C. 配置文件更新示例

#### pnpm-workspace.yaml

```yaml
packages:
  - "shared"
  - "src"
  - "webview-ui"
```

#### package.json

```json
{
  "name": "roo-code",
  "private": true,
  "workspaces": [
    "shared",
    "src",
    "webview-ui"
  ],
  "scripts": {
    "build": "pnpm --filter \"./**\" build",
    "check-types": "pnpm --filter \"./**\" check-types",
    "test": "pnpm --filter \"./**\" test"
  }
}
```

---

**文档版本**: 1.0  
**最后更新**: 2025-01-23  
**作者**: Roo Code Team
