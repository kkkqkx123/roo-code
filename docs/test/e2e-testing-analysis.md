# Roo Code E2E 测试分析文档

## 概述

本文档分析了 Roo Code 项目当前的测试架构，并提供了实现端到端（E2E）测试的详细方案和建议。

## 当前测试架构分析

### 现有测试框架

Roo Code 项目目前使用以下测试技术栈：

1. **Vitest** - 主要的单元测试和集成测试框架
2. **@vscode/test-electron** - VS Code 扩展测试依赖（已安装但未配置使用）
3. **Mock 测试** - 使用 Vitest 的 vi.mock() 进行模块模拟

### 当前测试结构

```
src/
├── __tests__/                    # 集成测试
│   ├── extension.spec.ts         # 扩展激活测试
│   ├── command-integration.spec.ts
│   └── ...
├── core/
│   ├── task/
│   │   └── __tests__/           # Task 模块单元测试
│   ├── webview/
│   │   └── __tests__/           # Webview 相关测试
│   └── ...
├── vitest.config.ts              # Vitest 配置
└── vitest.setup.ts               # 测试设置文件
```

### 测试配置分析

#### vitest.config.ts
```typescript
import { defineConfig } from "vitest/config"
import path from "path"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    watch: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
  resolve: {
    alias: {
      vscode: path.resolve(__dirname, "./__mocks__/vscode.js"),
    },
  },
})
```

**关键特点：**
- 使用 Mock 的 VS Code API（`__mocks__/vscode.js`）
- 测试超时设置为 20 秒
- 使用 TypeScript 路径别名

### 当前测试类型

1. **单元测试** - 测试单个函数和类的方法
2. **集成测试** - 测试模块间的交互（如 Task、ClineProvider）
3. **Mock 集成测试** - 使用模拟的 VS Code API 进行测试

**缺失的测试类型：**
- ❌ 真实的 E2E 测试（在真实的 VS Code 实例中运行）
- ❌ Webview UI 测试
- ❌ 命令执行测试
- ❌ 文件系统操作测试

## VS Code 扩展 E2E 测试最佳实践

根据 VS Code 官方文档，实现 E2E 测试需要以下组件：

### 1. 核心依赖

```bash
pnpm add -D @vscode/test-electron @vscode/test-cli
```

**说明：**
- `@vscode/test-electron` - 提供在真实 VS Code 实例中运行测试的能力
- `@vscode/test-cli` - 提供命令行测试工具

### 2. 测试运行器脚本

创建测试运行器 `src/test/runTest.ts`：

```typescript
import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

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

### 3. 测试套件入口

创建测试套件入口 `src/test/suite/index.ts`：

```typescript
import * as path from 'path';
import * as Mocha from 'mocha';
import * as glob from 'glob';

export function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 60000,
  });

  const testsRoot = path.resolve(__dirname, '..');

  return new Promise((c, e) => {
    glob('**/**.test.js', { cwd: testsRoot }, (err, files) => {
      if (err) {
        return e(err);
      }

      files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

      try {
        mocha.run(failures => {
          if (failures > 0) {
            e(new Error(`${failures} tests failed.`));
          } else {
            c();
          }
        });
      } catch (err) {
        console.error(err);
        e(err);
      }
    });
  });
}
```

### 4. E2E 测试示例

```typescript
import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('RooVeterinaryInc.coder'));
  });

  test('Extension should activate', async () => {
    const extension = vscode.extensions.getExtension('RooVeterinaryInc.coder');
    await extension?.activate();
    assert.strictEqual(extension?.isActive, true);
  });

  test('Should register commands', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('coder.plusButtonClicked'));
    assert.ok(commands.includes('coder.newTask'));
  });
});
```

## Roo Code E2E 测试实施方案

> **重要更新**：E2E 测试模块架构已重新设计，请参阅 [e2e-module-architecture.md](./e2e-module-architecture.md) 获取详细的架构设计说明。

### 方案架构

```
Roo-Code/
├── src/                         # 扩展源代码（生产代码）
│   ├── extension.ts
│   ├── core/
│   ├── api/
│   ├── __tests__/               # 单元测试和集成测试（Vitest + Mock）
│   └── ...
├── e2e/                         # E2E 测试目录（独立模块）
│   ├── package.json             # E2E 测试专用依赖
│   ├── tsconfig.json            # E2E 测试专用 TypeScript 配置
│   ├── mocha.opts              # Mocha 配置
│   ├── runTest.ts              # 测试运行器
│   ├── suite/                  # 测试套件
│   │   ├── index.ts            # 测试套件入口
│   │   ├── extension.test.ts   # 扩展激活测试
│   │   ├── commands.test.ts    # 命令测试
│   │   ├── webview.test.ts     # Webview 测试
│   │   └── integration.test.ts # 集成测试
│   ├── fixtures/               # 测试夹具
│   │   ├── test-workspace/    # 测试工作区
│   │   └── mock-data/        # 模拟数据
│   └── utils/                 # 测试工具函数
│       ├── setup.ts           # 测试设置
│       ├── teardown.ts        # 测试清理
│       └── helpers.ts        # 辅助函数
```

### 实施步骤

> **注意**：详细的实施步骤和配置请参阅 [e2e-module-architecture.md](./e2e-module-architecture.md) 文档。

#### 步骤 1: 创建 E2E 测试目录结构

```bash
mkdir -p e2e/suite
mkdir -p e2e/fixtures/test-workspace
mkdir -p e2e/fixtures/mock-data
mkdir -p e2e/utils
```

#### 步骤 2: 创建 E2E 测试配置文件

1. 创建 `e2e/package.json` - 独立的依赖管理
2. 创建 `e2e/tsconfig.json` - 独立的 TypeScript 配置
3. 创建 `e2e/mocha.opts` - Mocha 配置
4. 创建 `e2e/runTest.ts` - 测试运行器

#### 步骤 3: 创建测试套件

1. 创建 `e2e/suite/index.ts` - 测试套件入口
2. 创建 `e2e/suite/extension.test.ts` - 扩展激活测试
3. 创建 `e2e/suite/commands.test.ts` - 命令测试
4. 创建 `e2e/suite/integration.test.ts` - 集成测试

#### 步骤 4: 更新根 package.json

添加 E2E 测试脚本：
```json
{
  "scripts": {
    "test:e2e": "cd e2e && pnpm build && pnpm test",
    "test:e2e:debug": "cd e2e && pnpm build && pnpm test:debug"
  }
}
```

#### 步骤 5: 更新 .vscodeignore

显式排除 E2E 测试目录：
```
# Explicitly exclude E2E tests
e2e/
```

#### 步骤 6: 更新 VS Code 调试配置

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

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension Tests",
      "type": "extensionHost",
      "request": "launch",
      "runtimeExecutable": "${execPath}",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}/src",
        "--extensionTestsPath=${workspaceFolder}/src/dist/test/suite/index"
      ],
      "outFiles": [
        "${workspaceFolder}/src/dist/test/**/*.js"
      ],
      "preLaunchTask": "${defaultBuildTask}"
    }
  ]
}
```

### 测试场景设计

#### 1. 扩展激活测试

```typescript
import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Activation Tests', () => {
  test('Extension should be present', () => {
    const extension = vscode.extensions.getExtension('RooVeterinaryInc.coder');
    assert.ok(extension, 'Extension should be present');
  });

  test('Extension should activate', async () => {
    const extension = vscode.extensions.getExtension('RooVeterinaryInc.coder');
    await extension?.activate();
    assert.strictEqual(extension?.isActive, true, 'Extension should be active');
  });
});
```

#### 2. 命令注册测试

```typescript
suite('Command Registration Tests', () => {
  test('Should register all required commands', async () => {
    const commands = await vscode.commands.getCommands(true);
    const expectedCommands = [
      'coder.plusButtonClicked',
      'coder.newTask',
      'coder.explainCode',
      'coder.fixCode',
      'coder.improveCode',
      'coder.addToContext',
      'coder.toggleAutoApprove',
    ];

    for (const cmd of expectedCommands) {
      assert.ok(commands.includes(cmd), `Command ${cmd} should be registered`);
    }
  });
});
```

#### 3. Webview 测试

```typescript
suite('Webview Tests', () => {
  test('Should open sidebar webview', async () => {
    await vscode.commands.executeCommand('coder.plusButtonClicked');
    await new Promise(resolve => setTimeout(resolve, 1000));

    const activeTextEditor = vscode.window.activeTextEditor;
    assert.ok(activeTextEditor, 'Should have active editor');
  });
});
```

#### 4. 文件操作测试

```typescript
suite('File Operation Tests', () => {
  const testFile = vscode.Uri.joinPath(
    vscode.workspace.workspaceFolders![0].uri,
    'test-file.ts'
  );

  test('Should create file', async () => {
    const content = 'console.log("Hello, World!");';
    await vscode.workspace.fs.writeFile(testFile, Buffer.from(content));

    const fileExists = await vscode.workspace.fs.stat(testFile);
    assert.ok(fileExists, 'File should be created');
  });

  test('Should read file', async () => {
    const content = await vscode.workspace.fs.readFile(testFile);
    const text = Buffer.from(content).toString('utf8');
    assert.ok(text.includes('Hello, World!'), 'File content should match');
  });
});
```

### CI/CD 集成

在 GitHub Actions 中添加 E2E 测试：

```yaml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22.14.0'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 10.8.1

      - name: Install dependencies
        run: pnpm install

      - name: Build extension
        run: cd src && pnpm bundle

      - name: Run E2E tests
        run: cd src && pnpm test:e2e
```

## 测试最佳实践

### 1. 测试隔离

每个测试应该是独立的，不依赖于其他测试的状态：

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

### 2. 异步测试处理

正确处理异步操作：

```typescript
test('Async operation test', async () => {
  const result = await vscode.commands.executeCommand('someCommand');
  assert.ok(result, 'Command should return result');
});
```

### 3. 超时设置

为长时间运行的测试设置适当的超时：

```typescript
suite('Long Running Tests', () => {
  this.timeout(120000); // 2 分钟超时

  test('Should complete long operation', async () => {
    // 长时间运行的测试
  });
});
```

### 4. 清理资源

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

## 挑战与解决方案

### 挑战 1: Webview 测试困难

**问题：** Webview 是独立的 webview 环境，难以直接测试。

**解决方案：**
1. 使用消息传递测试：测试扩展和 webview 之间的消息传递
2. 使用 Playwright 或 Puppeteer 进行 UI 测试
3. 模拟 webview 消息处理

```typescript
test('Should handle webview messages', async () => {
  const message = {
    type: 'askQuestion',
    text: 'Test question'
  };

  await vscode.commands.executeCommand('coder.focusInput');
  // 模拟发送消息到 webview
});
```

### 挑战 2: AI API 依赖

**问题：** 测试依赖真实的 AI API 调用。

**解决方案：**
1. 使用 Mock 或 Nock 拦截 API 请求
2. 使用测试 API key
3. 实现测试模式，使用模拟响应

```typescript
import nock from 'nock';

beforeEach(() => {
  nock('https://api.anthropic.com')
    .post('/v1/messages')
    .reply(200, {
      content: [{ type: 'text', text: 'Mock response' }]
    });
});
```

### 挑战 3: 文件系统操作

**问题：** 测试可能影响真实的文件系统。

**解决方案：**
1. 使用临时工作区
2. 在测试前创建测试文件
3. 在测试后清理

```typescript
const tempWorkspace = vscode.Uri.parse(
  `untitled:${path.join(os.tmpdir(), 'test-workspace')}`
);

beforeEach(async () => {
  await vscode.workspace.fs.createDirectory(tempWorkspace);
});

afterEach(async () => {
  await vscode.workspace.fs.delete(tempWorkspace, { recursive: true });
});
```

## 实施计划

### 阶段 1: 基础设施搭建（1-2 周）

- [ ] 安装必要的依赖
- [ ] 创建测试运行器和套件结构
- [ ] 配置 VS Code 调试配置
- [ ] 编写基础扩展激活测试

### 阶段 2: 核心功能测试（2-3 周）

- [ ] 命令注册和执行测试
- [ ] 文件操作测试
- [ ] Webview 消息传递测试
- [ ] 配置管理测试

### 阶段 3: 集成测试（2-3 周）

- [ ] 端到端工作流测试
- [ ] 多文件操作测试
- [ ] 错误处理测试
- [ ] 性能测试

### 阶段 4: CI/CD 集成（1 周）

- [ ] 配置 GitHub Actions
- [ ] 设置测试报告
- [ ] 配置测试覆盖率

## 总结

Roo Code 项目已经具备了良好的单元测试和集成测试基础，但缺少真正的 E2E 测试。通过实施本文档提供的方案，可以：

1. **提高测试覆盖率** - 覆盖真实 VS Code 环境中的场景
2. **增强信心** - 确保扩展在实际使用中正常工作
3. **提前发现问题** - 在发布前发现集成问题
4. **改善用户体验** - 确保核心功能稳定可靠
5. **避免打包污染** - 通过独立的 E2E 测试模块架构，确保测试代码不会进入生产构建

实施 E2E 测试需要投入时间和资源，但对于一个复杂的 VS Code 扩展来说，这是确保质量和稳定性的重要投资。

## 避免测试代码打包到 Release

### 为什么需要避免打包？

1. **安全性** - 测试代码可能包含敏感的测试数据和配置
2. **包体积** - 测试代码会增加 .vsix 包的体积
3. **性能** - 不必要的代码会影响扩展加载性能
4. **专业性** - 生产包应该只包含必要的代码

### 架构设计保障

通过将 E2E 测试放在独立的 `e2e/` 目录中，我们实现了：

1. **目录隔离** - E2E 测试代码与源代码完全分离
2. **依赖隔离** - E2E 测试依赖在独立的 `e2e/package.json` 中
3. **构建隔离** - E2E 测试有独立的构建流程
4. **打包隔离** - `.vscodeignore` 显式排除 `e2e/` 目录

详细的架构设计和实施步骤请参阅 [e2e-module-architecture.md](./e2e-module-architecture.md)。

### 验证措施

在实施 E2E 测试后，应该验证以下几点：

1. **检查 .vsix 包内容**
   ```bash
   unzip -l bin/roo-cline-*.vsix | grep -i test
   ```
   预期结果：不应该包含任何测试文件

2. **检查 dist 目录**
   ```bash
   ls -la src/dist/
   ```
   预期结果：只包含 `extension.js` 和 `workers/`，不包含测试文件

3. **检查依赖**
   ```bash
   unzip -p bin/roo-cline-*.vsix package.json | jq '.devDependencies'
   ```
   预期结果：不应该包含 E2E 测试的依赖

4. **运行 E2E 测试**
   ```bash
   pnpm test:e2e
   ```
   预期结果：测试应该正常运行

## 参考资料

- [VS Code Extension Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [@vscode/test-electron Documentation](https://github.com/microsoft/vscode-test-electron)
- [Mocha Documentation](https://mochajs.org/)
- [VS Code API](https://code.visualstudio.com/api)
