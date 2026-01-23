# Roo Code E2E 测试模块架构设计

## 概述

本文档重新设计了 Roo Code 的 E2E 测试模块架构，确保测试代码不会被错误打包到 release 构建中。

## 当前构建配置分析

### 现有构建工具链

1. **esbuild** - 用于打包扩展代码
2. **vsce** - 用于打包 .vsix 文件
3. **.vscodeignore** - 控制打包内容
4. **tsconfig.json** - TypeScript 编译配置

### 当前打包流程

```
src/
├── extension.ts          → esbuild → dist/extension.js
├── workers/
│   └── countTokens.ts   → esbuild → dist/workers/
├── __tests__/           → Vitest (Mock 测试)
└── (其他源代码)
```

**关键发现：**
- esbuild 只打包 `extension.ts` 和 `workers/countTokens.ts`
- `.vscodeignore` 使用 `**` 排除所有文件，然后显式包含需要的文件
- `tsconfig.json` 的 `exclude` 只排除了 `node_modules`，未排除测试文件

### 潜在风险

1. **测试文件可能被误打包**：如果 esbuild 配置变更，可能意外打包测试文件
2. **测试依赖可能进入生产包**：测试专用的依赖可能被包含在 .vsix 中
3. **测试代码污染源代码**：测试代码与源代码混合，不利于维护

## E2E 测试模块架构设计

### 架构原则

1. **完全分离** - E2E 测试代码与源代码完全隔离
2. **零污染** - 测试代码不会进入生产构建
3. **独立构建** - E2E 测试有独立的构建流程
4. **清晰边界** - 明确的目录结构和命名约定

### 目录结构设计

```
Roo-Code/
├── src/                          # 扩展源代码（生产代码）
│   ├── extension.ts
│   ├── core/
│   ├── api/
│   ├── __tests__/                # 单元测试和集成测试（Vitest + Mock）
│   └── ...
├── e2e/                          # E2E 测试目录（独立模块）
│   ├── package.json              # E2E 测试专用依赖
│   ├── tsconfig.json             # E2E 测试专用 TypeScript 配置
│   ├── mocha.opts               # Mocha 配置
│   ├── runTest.ts               # 测试运行器
│   ├── suite/                   # 测试套件
│   │   ├── index.ts             # 测试套件入口
│   │   ├── extension.test.ts    # 扩展激活测试
│   │   ├── commands.test.ts     # 命令测试
│   │   ├── webview.test.ts      # Webview 测试
│   │   └── integration.test.ts  # 集成测试
│   ├── fixtures/                # 测试夹具
│   │   ├── test-workspace/     # 测试工作区
│   │   └── mock-data/         # 模拟数据
│   └── utils/                  # 测试工具函数
│       ├── setup.ts            # 测试设置
│       ├── teardown.ts         # 测试清理
│       └── helpers.ts         # 辅助函数
├── .vscodeignore               # VS Code 打包忽略规则
├── turbo.json                  # Turbo 构建配置
└── package.json               # 根 package.json
```

### 关键设计决策

#### 1. E2E 测试独立于 src 目录

**理由：**
- 完全隔离，避免任何打包混淆
- 清晰的代码边界
- 可以独立管理依赖

**实现：**
```bash
e2e/                    # E2E 测试根目录
├── package.json         # 独立的 package.json
├── tsconfig.json        # 独立的 TypeScript 配置
└── ...
```

#### 2. 独立的 package.json

**e2e/package.json:**
```json
{
  "name": "@roo-code/e2e-tests",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "mocha",
    "test:debug": "mocha --inspect-brk",
    "build": "tsc",
    "clean": "rimraf dist"
  },
  "devDependencies": {
    "@vscode/test-electron": "^2.5.2",
    "@vscode/test-cli": "^0.0.10",
    "@types/mocha": "^10.0.10",
    "@types/node": "^20.x",
    "mocha": "^10.8.2",
    "glob": "^11.0.0",
    "typescript": "^5.8.3"
  }
}
```

**优势：**
- E2E 测试依赖与生产依赖完全分离
- 避免测试依赖进入 .vsix 包
- 可以独立安装和更新测试依赖

#### 3. 独立的 TypeScript 配置

**e2e/tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "types": ["node", "mocha", "@vscode/test-electron"],
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["../src/shared/*"],
      "@core/*": ["../src/core/*"],
      "@api/*": ["../src/api/*"],
      "@utils/*": ["../src/utils/*"]
    }
  },
  "include": [
    "**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}
```

**关键点：**
- `outDir` 指向 `./dist`，不污染 `src/dist`
- 使用 `paths` 引用 `src/` 中的类型
- 只编译 `e2e/` 目录下的文件

#### 4. 测试运行器

**e2e/runTest.ts:**
```typescript
import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../src');
    const extensionTestsPath = path.resolve(__dirname, './dist/suite/index');

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
    });
  } catch (err) {
    console.error('Failed to run tests');
    process.exit(1);
  }
}

main();
```

**关键点：**
- `extensionDevelopmentPath` 指向 `../src`，指向扩展源代码
- `extensionTestsPath` 指向 `./dist/suite/index`，指向编译后的测试代码

#### 5. .vscodeignore 配置

**src/.vscodeignore:**
```
# Exclude everything
**

# Include README.md, CHANGELOG.md and LICENSE
!README.md
!CHANGELOG.md
!LICENSE

# Include package.json
!package.json
!package.nls.*

# Include the built extension
!dist

# Include the built webview
!**/*.map
!webview-ui/audio
!webview-ui/build/assets/*.js
!webview-ui/build/assets/*.ttf
!webview-ui/build/assets/*.css
!webview-ui/build/assets/fonts/*.woff
!webview-ui/build/assets/fonts/*.woff2
!webview-ui/build/assets/fonts/*.ttf

# Include default themes JSON files used in getTheme
!integrations/theme/default-themes/**

# Include icons and images
!assets/codicons/**
!assets/vscode-material-icons/**
!assets/icons/**
!assets/images/**

# Include .env file
!.env

# Explicitly exclude E2E tests (redundant but explicit)
e2e/
```

**关键点：**
- 使用 `**` 排除所有文件，然后显式包含需要的文件
- 显式排除 `e2e/` 目录（虽然 `**` 已经排除，但显式排除更清晰）

#### 6. 根 package.json 脚本

**package.json:**
```json
{
  "scripts": {
    "test": "turbo test --log-order grouped --output-logs new-only",
    "test:unit": "cd src && pnpm test",
    "test:e2e": "cd e2e && pnpm build && pnpm test",
    "test:e2e:debug": "cd e2e && pnpm build && pnpm test:debug",
    "test:all": "pnpm test:unit && pnpm test:e2e"
  }
}
```

**关键点：**
- `test:unit` - 运行单元测试（Vitest + Mock）
- `test:e2e` - 运行 E2E 测试（Mocha + @vscode/test-electron）
- `test:all` - 运行所有测试

## 构建流程设计

### 开发流程

```
1. 修改源代码 (src/)
   ↓
2. 运行单元测试 (pnpm test:unit)
   ↓
3. 运行 E2E 测试 (pnpm test:e2e)
   ↓
4. 打包扩展 (pnpm vsix)
```

### E2E 测试构建流程

```
e2e/
├── *.ts (源代码)
   ↓ tsc
├── dist/ (编译后的 JS)
   ↓ @vscode/test-electron
└── 运行测试
```

### Release 构建流程

```
src/
├── extension.ts
├── workers/
└── (其他源代码)
   ↓ esbuild
dist/
├── extension.js
└── workers/
   ↓ vsce (使用 .vscodeignore)
roo-cline-*.vsix
```

**关键点：**
- E2E 测试代码不参与 esbuild 打包
- E2E 测试代码不参与 vsce 打包
- E2E 测试代码独立编译和运行

## 避免打包的保障措施

### 1. 目录隔离

```
Roo-Code/
├── src/          # 生产代码
├── e2e/          # E2E 测试代码（独立）
└── ...
```

**保障：**
- esbuild 只处理 `src/` 目录
- vsce 只打包 `src/` 目录的内容
- E2E 测试代码完全在 `e2e/` 目录

### 2. .vscodeignore 配置

```bash
# Exclude everything
**

# Explicitly exclude E2E tests
e2e/

# Include only production files
!dist
!webview-ui/build
!assets
...
```

**保障：**
- 显式排除 `e2e/` 目录
- 使用白名单模式，只包含需要的文件

### 3. esbuild 配置

**src/esbuild.mjs:**
```javascript
const extensionConfig = {
  entryPoints: ["extension.ts"],
  outfile: "dist/extension.js",
  external: ["vscode"],
};

const workerConfig = {
  entryPoints: ["workers/countTokens.ts"],
  outdir: "dist/workers",
};
```

**保障：**
- 只打包 `extension.ts` 和 `workers/countTokens.ts`
- 不会打包任何测试文件

### 4. TypeScript 配置

**src/tsconfig.json:**
```json
{
  "include": ["."],
  "exclude": [
    "node_modules",
    "dist",
    "**/__tests__",
    "**/*.spec.ts",
    "**/*.test.ts"
  ]
}
```

**e2e/tsconfig.json:**
```json
{
  "include": ["**/*.ts"],
  "exclude": [
    "node_modules",
    "dist"
  ]
}
```

**保障：**
- `src/tsconfig.json` 排除测试文件
- `e2e/tsconfig.json` 只编译 `e2e/` 目录

### 5. 依赖隔离

**src/package.json:**
```json
{
  "devDependencies": {
    "vitest": "^3.2.3",
    "@vscode/test-electron": "^2.5.2"
  }
}
```

**e2e/package.json:**
```json
{
  "devDependencies": {
    "@vscode/test-electron": "^2.5.2",
    "@vscode/test-cli": "^0.0.10",
    "mocha": "^10.8.2",
    "glob": "^11.0.0"
  }
}
```

**保障：**
- E2E 测试依赖在 `e2e/package.json` 中
- vsce 打包时不会包含 `e2e/package.json`

## 实施步骤

### 步骤 1: 创建 E2E 测试目录结构

```bash
mkdir -p e2e/suite
mkdir -p e2e/fixtures/test-workspace
mkdir -p e2e/fixtures/mock-data
mkdir -p e2e/utils
```

### 步骤 2: 创建 E2E 测试配置文件

1. 创建 `e2e/package.json`
2. 创建 `e2e/tsconfig.json`
3. 创建 `e2e/mocha.opts`
4. 创建 `e2e/runTest.ts`

### 步骤 3: 创建测试套件

1. 创建 `e2e/suite/index.ts` - 测试套件入口
2. 创建 `e2e/suite/extension.test.ts` - 扩展激活测试
3. 创建 `e2e/suite/commands.test.ts` - 命令测试
4. 创建 `e2e/suite/integration.test.ts` - 集成测试

### 步骤 4: 更新根 package.json

添加 E2E 测试脚本：
```json
{
  "scripts": {
    "test:e2e": "cd e2e && pnpm build && pnpm test",
    "test:e2e:debug": "cd e2e && pnpm build && pnpm test:debug"
  }
}
```

### 步骤 5: 更新 .vscodeignore

显式排除 E2E 测试目录：
```
# Explicitly exclude E2E tests
e2e/
```

### 步骤 6: 更新 VS Code 调试配置

在 `.vscode/launch.json` 中添加：
```json
{
  "name": "Run E2E Tests",
  "type": "extensionHost",
  "request": "launch",
  "runtimeExecutable": "${execPath}",
  "args": [
    "--extensionDevelopmentPath=${workspaceFolder}/src",
    "--extensionTestsPath=${workspaceFolder}/e2e/dist/suite/index"
  ],
  "outFiles": [
    "${workspaceFolder}/e2e/dist/**/*.js"
  ],
  "preLaunchTask": "build:e2e"
}
```

### 步骤 7: 创建测试夹具

1. 创建测试工作区 `e2e/fixtures/test-workspace/`
2. 创建模拟数据 `e2e/fixtures/mock-data/`

### 步骤 8: 编写测试用例

按照测试场景编写测试用例：
- 扩展激活测试
- 命令注册和执行测试
- Webview 测试
- 文件操作测试
- 集成测试

## 验证措施

### 验证 1: 检查 .vsix 包内容

```bash
# 构建 .vsix 包
pnpm vsix

# 解压 .vsix 包查看内容
unzip -l bin/roo-cline-*.vsix | grep -i test
```

**预期结果：** 不应该包含任何测试文件

### 验证 2: 检查 dist 目录

```bash
# 检查 dist 目录内容
ls -la src/dist/
```

**预期结果：** 只包含 `extension.js` 和 `workers/`，不包含测试文件

### 验证 3: 运行 E2E 测试

```bash
# 运行 E2E 测试
pnpm test:e2e
```

**预期结果：** 测试应该正常运行

### 验证 4: 检查依赖

```bash
# 检查 .vsix 包中的依赖
unzip -p bin/roo-cline-*.vsix package.json | jq '.devDependencies'
```

**预期结果：** 不应该包含 E2E 测试的依赖

## 最佳实践

### 1. 测试命名约定

- 测试文件：`*.test.ts`
- 测试套件：使用 `suite()` 或 `describe()`
- 测试用例：使用 `test()` 或 `it()`

### 2. 测试隔离

每个测试应该是独立的：
```typescript
suite('Isolated Tests', () => {
  beforeEach(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('Test 1', async () => {
    // 测试逻辑
  });

  test('Test 2', async () => {
    // 测试逻辑，不依赖 Test 1
  });
});
```

### 3. 资源清理

在测试后清理资源：
```typescript
suite('Resource Cleanup', () => {
  const testFiles: vscode.Uri[] = [];

  afterEach(async () => {
    for (const file of testFiles) {
      try {
        await vscode.workspace.fs.delete(file);
      } catch (err) {
        // 忽略删除错误
      }
    }
    testFiles.length = 0;
  });

  test('Should create and cleanup file', async () => {
    const file = vscode.Uri.joinPath(
      vscode.workspace.workspaceFolders![0].uri,
      'test.ts'
    );
    testFiles.push(file);

    await vscode.workspace.fs.writeFile(file, Buffer.from('test'));
  });
});
```

### 4. 异步测试处理

正确处理异步操作：
```typescript
test('Async operation test', async () => {
  const result = await vscode.commands.executeCommand('someCommand');
  assert.ok(result, 'Command should return result');
});
```

### 5. 超时设置

为长时间运行的测试设置适当的超时：
```typescript
suite('Long Running Tests', function() {
  this.timeout(120000); // 2 分钟超时

  test('Should complete long operation', async () => {
    // 长时间运行的测试
  });
});
```

## CI/CD 集成

### GitHub Actions 配置

```yaml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node-version: [22.14.0]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 10.8.1

      - name: Install dependencies
        run: pnpm install

      - name: Build extension
        run: cd src && pnpm bundle

      - name: Build E2E tests
        run: cd e2e && pnpm install && pnpm build

      - name: Run E2E tests
        run: pnpm test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-test-results-${{ matrix.os }}
          path: e2e/test-results/
```

## 总结

通过重新设计 E2E 测试模块架构，我们实现了：

1. **完全隔离** - E2E 测试代码与源代码完全分离
2. **零污染** - 测试代码不会进入生产构建
3. **独立构建** - E2E 测试有独立的构建流程
4. **清晰边界** - 明确的目录结构和命名约定
5. **易于维护** - 清晰的代码组织和依赖管理

这种架构设计确保了 E2E 测试代码永远不会被错误打包到 release 构建中，同时保持了良好的可维护性和可扩展性。

## 参考资料

- [VS Code Extension Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [@vscode/test-electron Documentation](https://github.com/microsoft/vscode-test-electron)
- [Mocha Documentation](https://mochajs.org/)
- [VS Code API](https://code.visualstudio.com/api)
