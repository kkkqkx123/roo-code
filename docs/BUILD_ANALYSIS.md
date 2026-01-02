# Roo-Code 项目构建分析

## 1. 项目概述

Roo-Code 是一个基于 VSCode 的 AI 编程助手扩展项目，采用 monorepo 结构，使用 pnpm 作为包管理器，turbo 作为构建编排工具，esbuild 作为主要构建工具。

## 2. 项目结构

```
Roo-Code/
├── apps/                      # 应用层
│   ├── vscode-e2e/           # VSCode E2E 测试
│   ├── vscode-nightly/       # VSCode 扩展构建（ nightly 版本）
│   ├── web-evals/            # Web 评估应用
│   └── web-roo-code/         # Web 主站
├── packages/                  # 共享包
│   ├── build/                # 构建工具库（ esbuild 封装）
│   ├── config-eslint/        # ESLint 配置
│   ├── config-typescript/    # TypeScript 配置
│   ├── docs/                 # 文档
│   ├── evals/                # 评估系统
│   ├── ipc/                  # IPC 通信
│   └── types/                # 共享类型定义
├── src/                      # 主扩展源码
├── scripts/                  # 构建脚本
└── pnpm-workspace.yaml       # pnpm 工作区配置
```

## 3. 核心技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| pnpm | 10.8.1 | 包管理器 |
| turbo | 2.5.6 | 构建编排（任务调度、增量构建） |
| esbuild | 0.25.0 | 代码打包/压缩 |
| typescript | 5.4.5 | 类型检查 |
| tsup | 8.3.5 | TypeScript 打包（用于 types 包） |
| vsce | 3.3.2 | VSCode 扩展打包 |

## 4. 构建命令

### 4.1 根目录脚本

```json
{
  "build": "turbo build",              // 构建所有包
  "bundle": "turbo bundle",            // 打包 VSCode 扩展
  "bundle:nightly": "turbo bundle:nightly", // 打包 nightly 版本
  "vsix": "turbo vsix",                // 生成 VSIX 安装包
  "vsix:nightly": "turbo vsix:nightly", // 生成 nightly VSIX
  "check-types": "turbo check-types",  // 类型检查
  "lint": "turbo lint",                // 代码检查
  "test": "turbo test",                // 运行测试
  "clean": "turbo clean",              // 清理构建产物
  "install:all": "node scripts/bootstrap.mjs" // 安装所有依赖
}
```

### 4.2 构建流程

1. **依赖安装**：运行 `pnpm install`，自动执行 `scripts/bootstrap.mjs`
2. **类型构建**：`turbo build` 触发 `@roo-code/types` 包的构建
3. **扩展打包**：`turbo bundle` 调用 `esbuild.mjs` 进行打包
4. **生成 VSIX**：`turbo vsix` 使用 `vsce` 打包为 VSIX 文件

## 5. 构建系统详解

### 5.1 Turbo 配置 (`turbo.json`)

```json
{
  "tasks": {
    "build": {
      "outputs": ["dist/**"],
      "inputs": ["src/**", "package.json", "tsconfig.json", "tsup.config.ts", "vite.config.ts"]
    },
    "test": {
      "dependsOn": ["@roo-code/types#build"]
    }
  }
}
```

- **增量构建**：turbo 根据 inputs 监控文件变化，仅重新构建变化的包
- **依赖管理**：test 任务依赖于 `@roo-code/types` 的构建

### 5.2 构建工具包 (`@roo-code/build`)

位置：`packages/build/src/`

提供以下功能：

| 功能 | 文件 | 描述 |
|------|------|------|
| ESBuild 封装 | `esbuild.ts` | 复制资源、生成 package.json |
| Git 操作 | `git.ts` | 获取 Git SHA |
| 类型定义 | `types.ts` | VSCode contributes Schema 验证 |

### 5.3 主要构建函数

```typescript
// 复制资源文件
copyPaths(copyPaths: [string, string][], srcDir: string, dstDir: string)

// 复制 WASM 文件
copyWasms(srcDir: string, distDir: string)

// 复制本地化文件
copyLocales(srcDir: string, distDir: string)

// 生成 package.json
generatePackageJson({ packageJson, overrideJson, substitution })
```

### 5.4 扩展打包流程 (`esbuild.mjs`)

1. **初始化构建选项**
   ```javascript
   const buildOptions = {
     bundle: true,
     minify: production,
     sourcemap: !production,
     format: "cjs",
     platform: "node",
     external: ["vscode"]
   }
   ```

2. **注册插件**
   - `copyPaths`：复制 README、CHANGELOG、LICENSE、assets、integrations 等
   - `generatePackageJson`：生成修改后的 package.json
   - `copyWasms`：复制 tiktoken、tree-sitter 等 WASM 文件
   - `copyLocales`：复制 i18n 本地化文件

3. **并行构建**
   - 主扩展入口：`src/extension.ts` → `dist/extension.js`
   - Worker 入口：`src/workers/countTokens.ts` → `dist/workers/`

## 6. TypeScript 配置

### 6.1 基础配置 (`@roo-code/config-typescript`)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist"
  }
}
```

### 6.2 特殊包配置

| 包 | 构建工具 | 输出格式 |
|----|----------|----------|
| `@roo-code/types` | tsup | CJS + ESM + 类型声明 |
| `@roo-code/build` | tsc | JavaScript + 类型声明 |
| `@roo-code/vscode-nightly` | esbuild | 单文件 CJS |

## 7. 构建产物

### 7.1 VSCode 扩展结构

```
build/
├── package.json           # 生成的扩展配置
├── package.nls.json       # 本地化资源
├── README.md
├── CHANGELOG.md
├── LICENSE
├── .vscodeignore
├── assets/                # 图标资源
├── integrations/          # 集成配置
└── dist/
    ├── extension.js       # 主入口（打包后）
    ├── extension.js.map   # Source Map
    ├── workers/           # Web Worker
    │   ├── countTokens.js
    │   └── countTokens.js.map
    ├── i18n/locales/      # 本地化文件
    └── *.wasm             # WebAssembly 文件
```

### 7.2 NPM 包结构 (`@roo-code/types`)

```
dist/
├── index.cjs              # CommonJS 格式
├── index.d.cts            # CommonJS 类型声明
└── npm/
    └── dist/              # 发布到 NPM 的产物
```

## 8. 环境变量

### 8.1 构建时定义

```javascript
{
  "process.env.PKG_NAME": '"roo-code"',
  "process.env.PKG_VERSION": '"x.y.z"',
  "process.env.PKG_OUTPUT_CHANNEL": '"Roo-Code"',
  "process.env.PKG_SHA": '"git-sha"'  // 可选
}
```

### 8.2 引导脚本

- `BOOTSTRAP_IN_PROGRESS`：防止重复引导
- 自动检测并安装 pnpm（如果未安装）

## 9. 依赖管理

### 9.1 pnpm workspace 配置

```yaml
packages:
  - "src"
  - "webview-ui"
  - "apps/*"
  - "packages/*"
```

### 9.2 依赖覆盖

```json
{
  "pnpm": {
    "overrides": {
      "tar-fs": ">=3.1.1",
      "esbuild": ">=0.25.0",
      "undici": ">=5.29.0",
      "glob": ">=11.1.0"
    }
  }
}
```

## 10. 构建最佳实践

### 10.1 本地开发

```bash
# 安装依赖
pnpm install:all

# 开发模式（监听构建）
pnpm turbo run build --watch

# 运行测试
pnpm test

# 类型检查
pnpm check-types
```

### 10.2 发布构建

```bash
# 构建 nightly 版本
pnpm bundle:nightly && pnpm vsix:nightly

# 生成 VSIX（输出到 bin/ 目录）
pnpm vsix
```

### 10.3 清理

```bash
pnpm clean
```

## 11. 关键文件位置

| 文件 | 位置 | 说明 |
|------|------|------|
| 构建入口 | `apps/vscode-nightly/esbuild.mjs` | ESBuild 主配置 |
| 构建工具 | `packages/build/src/` | 构建函数封装 |
| 类型包配置 | `packages/types/tsup.config.ts` | NPM 包构建配置 |
| Turbo 配置 | `turbo.json` | 构建任务编排 |
| 工作区配置 | `pnpm-workspace.yaml` | 包目录结构 |
| 引导脚本 | `scripts/bootstrap.mjs` | 依赖安装引导 |

## 12. 常见问题

### 12.1 构建缓存

- Turbo 使用 `.turbo/` 目录缓存构建产物
- `pnpm clean` 会清理缓存

### 12.2 WASM 文件

- Tiktoken 用于快速 token 计数
- Tree-sitter 用于代码解析
- 需要从 `node_modules/` 复制到构建目录

### 12.3 本地化

- 使用 VSCode NLS 系统
- `package.nls.json` 定义本地化键值
- `package.nls.*.json` 定义语言变体
