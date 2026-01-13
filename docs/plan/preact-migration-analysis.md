# Roo-Code VSCode 插件项目中 React 使用情况分析及 Preact 替换可行性报告

## 1. 项目中 React 使用情况分析

通过分析 `webview-ui` 目录下的代码，发现该项目广泛使用了 React 的核心功能：

### React 核心功能使用统计：
- **Hooks**: useState, useEffect, useCallback, useMemo, useRef, useImperativeHandle, useContext 等大量使用
- **高级功能**: React.memo, React.forwardRef, React.cloneElement, React.Children 等
- **Context API**: 自定义 Context（ExtensionStateContext）和 useContext Hook
- **Class Components**: ErrorBoundary 继承自 React.Component
- **ForwardRef**: 大量 UI 组件使用 forwardRef
- **Memoization**: 多个组件使用 React.memo 进行性能优化

### 具体使用场景：
- UI 组件库（buttons, inputs, dialogs, dropdowns, etc.）
- 状态管理（ExtensionStateContext）
- 表单处理和自动调整大小文本框
- 对话框和模态窗口
- 历史记录和设置视图
- 聊天界面和消息处理

## 2. React 功能与 Preact 兼容性对比

| React 功能 | Preact Core 支持 | Preact/Compat 支持 | 项目中使用情况 |
|------------|------------------|--------------------|----------------|
| useState | ✅ | ✅ | 广泛使用 |
| useEffect | ✅ | ✅ | 广泛使用 |
| useCallback | ✅ | ✅ | 广泛使用 |
| useMemo | ✅ | ✅ | 广泛使用 |
| useRef | ✅ | ✅ | 广泛使用 |
| useContext | ✅ | ✅ | 广泛使用 |
| React.memo | ❌ | ✅ | 大量使用 |
| React.forwardRef | ❌ | ✅ | 大量使用 |
| React.Children | ❌ | ✅ | 有使用 |
| React.cloneElement | ❌ | ✅ | 有使用 |
| React.createContext | ❌ | ✅ | 有使用 |
| React.useImperativeHandle | ❌ | ✅ | 有使用 |
| Class Components | ❌ | ✅ | ErrorBoundary 使用 |

## 3. 迁移可行性分析

### ✅ 可行性：高

Preact/Compat 层提供了对所有项目所需 React 功能的完整支持：
- 所有 Hooks 都受支持
- forwardRef、memo、createContext 等高级 API 都可通过 `preact/compat` 使用
- Class Components 完全支持
- Context API 完全支持

## 4. 迁移计划

### 步骤 1: 修改依赖
```json
// webview-ui/package.json
{
  "dependencies": {
    "react": "^18.3.1",           // 移除
    "react-dom": "^18.3.1",       // 移除
    "preact": "^10.25.3",         // 添加
    "@preact/preset-vite": "^2.8.2"  // 添加 Vite 插件
  }
}
```

### 步骤 2: 修改 Vite 配置
```typescript
// webview-ui/vite.config.ts
import { defineConfig } from "vite"
import preact from "@preact/preset-vite"  // 替换 @vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [preact(), tailwindcss()],  // 替换 react() 插件
  // ... 其他配置保持不变
})
```

### 步骤 3: 创建别名配置
```typescript
// tsconfig.json 或 vite.config.ts 中添加别名
resolve: {
  alias: {
    "react": "preact/compat",
    "react-dom": "preact/compat",
    "react/jsx-runtime": "preact/jsx-runtime"
  }
}
```

### 步骤 4: 测试和验证
- 运行构建确保无错误
- 运行测试套件验证功能完整性
- 手动测试关键功能路径

## 5. 潜在风险和注意事项

1. **第三方库兼容性**: 某些依赖 React 特定行为的库可能需要额外适配
2. **DevTools**: 需要使用 Preact DevTools 而非 React DevTools
3. **Type Definitions**: 可能需要安装 `@types/preact/compat` 以获得正确的类型定义

## 6. 预期收益

- **包体积减少**: 从 ~40KB (React + ReactDOM) 到 ~4KB (Preact)
- **性能提升**: 更快的渲染和更少的内存占用
- **功能完整性**: 保持所有现有功能

## 结论

**可以安全地将 React 替换为 Preact**。通过使用 `preact/compat`，项目可以保持完全的 API 兼容性，同时获得显著的性能和体积优势。迁移过程相对简单，主要是依赖替换和构建配置调整。