## 1. NativeToolCallParser.ts - 原生工具调用解析器

**处理格式**：OpenAI风格的函数调用（原生格式）

**核心特点**：
- **流式处理支持**：支持增量解析工具调用的JSON参数
- **MCP工具支持**：处理动态MCP工具（格式：`mcp--serverName--toolName`）
- **类型化参数**：为每个工具构建类型化的`nativeArgs`参数
- **工具别名解析**：将别名转换为规范名称

**关键方法**：
- `parseToolCall()` - 解析完整的工具调用，将JSON字符串转换为ToolUse对象
- `processStreamingChunk()` - 处理流式JSON块，使用`partial-json-parser`立即提取部分值
- `finalizeStreamingToolCall()` - 完成流式工具调用解析
- `processRawChunk()` - 处理API流中的原始工具调用块，转换为start/delta/end事件

**参数处理**：
```typescript
// 为每个工具构建类型化的nativeArgs
switch (resolvedName) {
  case "read_file":
    nativeArgs = { files: this.convertFileEntries(args.files) }
    break
  case "execute_command":
    nativeArgs = { command: args.command, cwd: args.cwd }
    break
  // ... 其他工具
}
```

## 2. parseAssistantMessage.ts (V1) - XML解析器（旧版）

**处理格式**：XML格式的工具调用（如 `<read_file><path>...</path></read_file>`）

**核心特点**：
- **字符逐个累加**：使用`accumulator`字符串逐个字符累积
- **状态机模式**：维护`currentTextContent`、`currentToolUse`、`currentParamName`状态
- **标签匹配**：使用`endsWith`方法检查标签结束

**解析流程**：
```typescript
for (let i = 0; i < assistantMessage.length; i++) {
  accumulator += char
  
  // 检查参数结束标签
  if (currentToolUse && currentParamName) {
    const paramClosingTag = `</${currentParamName}>`
    if (currentParamValue.endsWith(paramClosingTag)) {
      // 提取参数值
    }
  }
  
  // 检查工具开始标签
  const possibleToolUseOpeningTags = toolNames.map((name) => `<${name}>`)
  for (const tag of possibleToolUseOpeningTags) {
    if (accumulator.endsWith(tag)) {
      // 开始新工具
    }
  }
}
```

**特殊处理**：
- `write_to_file`工具的content参数（处理嵌套的closing tag）

## 3. parseAssistantMessageV2.ts (V2) - XML解析器（优化版）

**处理格式**：XML格式的工具调用（与V1相同）

**核心特点**：
- **索引遍历**：使用索引`i`遍历字符串，而不是字符累加
- **预计算标签Map**：`toolUseOpenTags`和`toolParamOpenTags`用于快速查找
- **切片提取**：只在块完成时才切片提取内容
- **性能优化**：避免V1中的字符串重复操作

**解析流程**：
```typescript
// 预计算标签Map
const toolUseOpenTags = new Map<string, ToolName>()
for (const name of toolNames) {
  toolUseOpenTags.set(`<${name}>`, name)
}

// 使用索引遍历
for (let i = 0; i < len; i++) {
  // 使用startsWith检查标签
  if (assistantMessage.startsWith(tag, currentCharIndex - tag.length + 1)) {
    // 匹配到标签
  }
  
  // 使用切片提取内容
  const value = assistantMessage.slice(
    currentParamValueStart,
    currentCharIndex - closeTag.length + 1
  )
}
```

**性能对比**：
- V1：每次迭代都进行字符串拼接（`accumulator += char`）
- V2：只在需要时切片提取内容，避免中间字符串创建

## 三者的主要区别

| 特性 | NativeToolCallParser | parseAssistantMessage (V1) | parseAssistantMessageV2 (V2) |
|------|---------------------|---------------------------|-----------------------------|
| **输入格式** | OpenAI函数调用（JSON） | XML标签格式 | XML标签格式 |
| **解析方式** | JSON解析 | 字符逐个累加 | 索引遍历 + 切片 |
| **流式支持** | ✅ 支持 | ❌ 不支持 | ❌ 不支持 |
| **MCP工具** | ✅ 支持 | ❌ 不支持 | ❌ 不支持 |
| **性能** | 高（JSON解析） | 低（字符操作） | 高（索引操作） |
| **类型安全** | ✅ 类型化nativeArgs | ❌ 字符串params | ❌ 字符串params |

## 使用场景

1. **NativeToolCallParser**：用于支持OpenAI、Google等原生函数调用的AI提供商
2. **parseAssistantMessage (V1)**：旧版XML格式解析（已弃用或兼容性保留）
3. **parseAssistantMessageV2 (V2)**：新版XML格式解析（当前使用，性能优化）

V2相比V1的主要改进是性能优化，通过避免字符串累加和预计算标签Map，显著提升了XML格式工具调用的解析速度。