# i18n 国际化翻译系统

本目录包含 Roo Code Webview UI 的国际化翻译系统。

## 目录结构

```
i18n/
├── locales/              # 翻译文件目录
│   ├── en/             # 英文翻译（源语言）
│   │   ├── chat.json
│   │   ├── common.json
│   │   ├── history.json
│   │   ├── humanRelay.json
│   │   ├── mcp.json
│   │   ├── prompts.json
│   │   ├── settings.json
│   │   └── welcome.json
│   └── zh-CN/          # 中文翻译
│       ├── chat.json
│       ├── common.json
│       ├── history.json
│       ├── humanRelay.json
│       ├── mcp.json
│       ├── prompts.json
│       ├── settings.json
│       └── welcome.json
├── generate-types.js    # 类型定义生成脚本
├── types.generated.ts   # 自动生成的类型定义
├── TranslationContext.tsx  # React 翻译上下文
├── setup.ts            # i18n 配置
├── __tests__/         # 测试文件
└── __mocks__/         # 测试模拟
```

## 类型生成逻辑

### 工作原理

`generate-types.js` 脚本通过以下步骤自动生成 TypeScript 类型定义：

1. **扫描英文翻译文件**：从 `locales/en/` 目录读取所有 JSON 文件
2. **提取翻译键**：递归遍历每个 JSON 文件，提取所有翻译键（如 `common:answers.yes`）
3. **检测参数占位符**：使用正则表达式 `/\{\{(\w+)\}\}/g` 检测翻译字符串中的参数（如 `{{message}}`）
4. **生成类型定义**：为每个翻译键生成对应的 TypeScript 类型

### 参数检测规则

- 使用 `{{paramName}}` 语法的占位符会被识别为参数
- 所有参数类型默认为 `string`
- 如果翻译字符串不包含参数，类型为 `Record<string, never>`

### 示例

**翻译文件 (common.json):**
```json
{
  "answers": {
    "yes": "Yes",
    "no": "No"
  },
  "notifications": {
    "error": "Error: {{message}}"
  }
}
```

**生成的类型定义:**
```typescript
export interface commonParams {
  'common:answers.yes': Record<string, never>
  'common:answers.no': Record<string, never>
  'common:notifications.error': { message: string }
}
```

## 如何修改翻译

### 添加新的翻译键

1. 在 `locales/en/` 对应的 JSON 文件中添加新的翻译键
2. 在其他语言（如 `locales/zh-CN/`）的对应文件中添加翻译
3. 运行类型生成脚本

**示例：**

在 `locales/en/chat.json` 中添加：
```json
{
  "newFeature": {
    "title": "New Feature",
    "description": "This is a {{type}} feature"
  }
}
```

在 `locales/zh-CN/chat.json` 中添加：
```json
{
  "newFeature": {
    "title": "新功能",
    "description": "这是一个{{type}}功能"
  }
}
```

### 重新生成类型定义

```bash
cd webview-ui/src/i18n
node generate-types.js
```

脚本会输出：
```
Generated type definitions at: D:\项目\agent\Roo-Code\webview-ui\src\i18n\types.generated.ts
Namespaces: chat, common, history, humanRelay, mcp, prompts, settings, welcome
```

### 在组件中使用翻译

```typescript
import { useAppTranslation } from "@/i18n/TranslationContext"

function MyComponent() {
  const { t, tDynamic } = useAppTranslation()

  // 使用类型安全的翻译函数
  const title = t("chat:newFeature.title")
  const description = t("chat:newFeature.description", { type: "awesome" })

  // 使用动态翻译键（用于动态构建的键）
  const dynamicKey = `chat:${featureType}.title`
  const dynamicTitle = tDynamic(dynamicKey)

  return (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  )
}
```

## 翻译函数说明

### `t(key, options?)`

类型安全的翻译函数，参数类型由自动生成的类型定义提供。

- **参数**：
  - `key`: 翻译键，类型为 `TranslationKey`
  - `options`: 可选的参数对象，类型根据翻译键自动推断

- **返回值**: `string`

- **使用场景**: 已知的、静态的翻译键

### `tDynamic(key, options?)`

动态翻译函数，接受任意字符串作为键。

- **参数**：
  - `key`: 任意字符串
  - `options`: 可选的参数对象

- **返回值**: `string`

- **使用场景**: 动态构建的翻译键，如 `tDynamic(\`prompts:tools.toolNames.${group}\`)`

## 命名空间

每个 JSON 文件对应一个命名空间：

| 文件 | 命名空间 | 用途 |
|------|---------|------|
| chat.json | chat | 聊天界面相关翻译 |
| common.json | common | 通用翻译（按钮、确认对话框等） |
| history.json | history | 历史记录相关翻译 |
| humanRelay.json | humanRelay | 人工中继相关翻译 |
| mcp.json | mcp | MCP (Model Context Protocol) 相关翻译 |
| prompts.json | prompts | 提示词相关翻译 |
| settings.json | settings | 设置页面相关翻译 |
| welcome.json | welcome | 欢迎页面相关翻译 |

## 翻译键命名规范

- 使用小写字母和下划线
- 使用点号分隔层级
- 参数使用 `{{paramName}}` 语法

**好的示例：**
```json
{
  "autoApprove": {
    "title": "Auto-Approve",
    "description": "Auto-approve {{count}} items"
  }
}
```

**不好的示例：**
```json
{
  "AutoApprove": "Auto-Approve",
  "auto-approve-description": "Auto-approve items"
}
```

## 常见问题

### Q: 为什么 TypeScript 报错说翻译键不存在？

A: 这通常是因为：
1. 添加了新的翻译键但没有重新生成类型定义
2. 翻译键拼写错误
3. 使用了错误的命名空间前缀

**解决方法：** 运行 `node generate-types.js` 重新生成类型定义。

### Q: 如何处理复数形式？

A: 使用参数传递数量，在翻译字符串中处理：

```json
{
  "items": "{{count}} item(s)"
}
```

或者使用不同的键：
```json
{
  "items_one": "1 item",
  "items_other": "{{count}} items"
}
```

### Q: 如何添加新的语言支持？

A: 1. 在 `locales/` 下创建新的语言目录（如 `ja/`）
2. 复制 `en/` 目录中的所有 JSON 文件
3. 翻译所有字符串
4. 更新 `setup.ts` 中的语言配置

### Q: `types.generated.ts` 可以手动编辑吗？

A: **不可以**。`types.generated.ts` 是自动生成的文件，任何手动修改都会在下次运行 `generate-types.js` 时被覆盖。

## 开发工作流

1. 在 `locales/en/` 中添加或修改翻译
2. 在其他语言文件中添加对应的翻译
3. 运行 `node generate-types.js` 生成类型定义
4. 在组件中使用 `t()` 或 `tDynamic()` 函数
5. 运行 TypeScript 类型检查确保没有类型错误

## 相关文件

- [TranslationContext.tsx](./TranslationContext.tsx) - React 翻译上下文实现
- [setup.ts](./setup.ts) - i18n 配置和初始化
- [types.generated.ts](./types.generated.ts) - 自动生成的类型定义（不要手动编辑）
