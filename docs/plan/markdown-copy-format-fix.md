# Markdown 复制格式问题分析与解决方案

## 问题描述

当用户直接从 UI 组件展示的输出信息复制文本（不是通过复制控件）时，复制出来的 Markdown 格式有问题，例如换行符丢失，无法直接复制出原始的 md 格式。

## 问题分析

### 根本原因

1. **渲染过程**：`MarkdownBlock.tsx` 使用 `react-markdown` 将 Markdown 源码转换为 HTML 元素：
   - `# 标题` → `<h1>标题</h1>`
   - `**粗体**` → `<strong>粗体</strong>`
   - `- 列表项` → `<ul><li>列表项</li></ul>`

2. **复制行为**：当用户直接选择渲染后的 HTML 文本并复制时，浏览器会复制**渲染后的纯文本**，而不是原始的 Markdown 源码。

3. **样式影响**：虽然 `MarkdownBlock.tsx:122` 中 `p` 标签使用了 `white-space: pre-wrap;`，但这只影响视觉渲染，不影响复制行为。

### 现有代码分析

- **MarkdownBlock 组件**：`webview-ui/src/components/common/MarkdownBlock.tsx`
  - 使用 `react-markdown` 渲染 Markdown
  - 使用 `styled-components` 定义样式
  - `p` 标签有 `white-space: pre-wrap;` 样式

- **Markdown 组件**：`webview-ui/src/components/chat/Markdown.tsx`
  - 包装了 `MarkdownBlock`
  - 提供了复制按钮，使用 `useCopyToClipboard` 复制原始 Markdown
  - 复制按钮只在鼠标悬停时显示

- **clipboard 工具**：`webview-ui/src/utils/clipboard.ts`
  - 提供 `copyToClipboard` 函数
  - 使用 `navigator.clipboard.writeText` 写入剪贴板

## 解决方案

### 方案选择

采用**方案 1：拦截复制事件，写入原始 Markdown**

**优点**：
- 用户体验最好，直接复制即可获得原始 Markdown
- 不需要修改 UI 结构
- 兼容性好，不影响现有的复制按钮功能

**缺点**：
- 需要处理选择范围，只复制用户选择的内容

### 实现思路

在 `MarkdownBlock` 组件中添加 `copy` 事件监听器：

1. 监听全局 `copy` 事件
2. 检查复制操作是否发生在 MarkdownBlock 容器内
3. 如果是，阻止默认复制行为
4. 将原始 Markdown 写入剪贴板

### 技术细节

1. **事件监听**：使用 `useEffect` 添加和移除事件监听器
2. **选择范围检测**：使用 `window.getSelection()` 获取用户选择的文本
3. **容器检测**：检查选择范围是否在 MarkdownBlock 容器内
4. **剪贴板操作**：使用 `navigator.clipboard.writeText()` 写入原始 Markdown

### 注意事项

1. **性能优化**：只在组件挂载时添加监听器，卸载时移除
2. **选择范围处理**：如果用户选择了部分内容，应该复制对应的 Markdown 片段
3. **兼容性**：确保不影响其他组件的复制功能
4. **测试覆盖**：需要测试各种 Markdown 格式的复制效果

## 实施计划

1. 修改 `MarkdownBlock.tsx` 组件
   - 添加 `copy` 事件处理函数
   - 使用 `useEffect` 管理事件监听器
   - 实现选择范围检测和原始 Markdown 复制

2. 测试验证
   - 测试各种 Markdown 格式的复制效果
   - 验证不影响其他组件的复制功能
   - 确保复制按钮功能正常

## 预期效果

- 用户可以直接选择渲染后的文本并复制，获得原始 Markdown 格式
- 换行符、列表、代码块等格式完整保留
- 现有的复制按钮功能不受影响
