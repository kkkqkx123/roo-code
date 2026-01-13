# VS Code Diagnostic API 详细说明文档

## 概述

VS Code 的诊断 API 提供了一套完整的机制来处理代码中的问题（如错误、警告等）。这些 API 允许扩展程序向编辑器添加诊断信息，并与内置的语言服务集成。

## 核心组件

### 1. Diagnostic 类

Diagnostic 类表示代码中的单个诊断问题。

#### 属性

- **range**: `vscode.Range`
  - 定义诊断适用的文本范围
  - 必需属性

- **message**: `string`
  - 诊断消息文本
  - 必需属性

- **severity**: `vscode.DiagnosticSeverity`
  - 诊断严重性级别
  - 默认值：`DiagnosticSeverity.Error`
  - 可选值：
    - `DiagnosticSeverity.Error` (0) - 错误
    - `DiagnosticSeverity.Warning` (1) - 警告
    - `DiagnosticSeverity.Information` (2) - 信息
    - `DiagnosticSeverity.Hint` (3) - 提示

- **source**: `string`
  - 诊断来源标识符（如 "typescript", "eslint"）
  - 可选属性

- **code**: `string | number | { value: string | number; target: vscode.Uri }`
  - 诊断代码，可以是字符串、数字或包含目标链接的对象
  - 可选属性

- **relatedInformation**: `vscode.DiagnosticRelatedInformation[]`
  - 相关信息数组，提供额外的上下文
  - 可选属性

- **tags**: `vscode.DiagnosticTag[]`
  - 诊断标签数组
  - 可选属性
  - 可选值：
    - `DiagnosticTag.Unnecessary` (1) - 不必要的代码
    - `DiagnosticTag.Deprecated` (2) - 已弃用的代码

- **data**: `any`
  - 附加数据，可用于存储自定义信息
  - 可选属性

#### 示例

```typescript
const diagnostic = new vscode.Diagnostic(
  new vscode.Range(0, 0, 0, 10),
  "Variable is never used",
  vscode.DiagnosticSeverity.Warning
);
diagnostic.source = "typescript";
diagnostic.code = 6133;
diagnostic.tags = [vscode.DiagnosticTag.Unnecessary];
```

### 2. DiagnosticRelatedInformation 类

提供与诊断相关的信息。

#### 属性

- **location**: `vscode.Location`
  - 相关位置信息

- **message**: `string`
  - 相关信息的消息文本

#### 示例

```typescript
const relatedInfo = new vscode.DiagnosticRelatedInformation(
  new vscode.Location(
    vscode.Uri.file("/path/to/file.ts"),
    new vscode.Range(5, 0, 5, 10)
  ),
  "This is where the variable was defined"
);
```

### 3. DiagnosticCollection 接口

DiagnosticCollection 用于管理一组诊断。

#### 属性

- **name**: `string`
  - 诊断集合的名称

- **readonly size**: `number`
  - 集合中诊断的数量

#### 方法

- **set(entries: [vscode.Uri, vscode.Diagnostic[]][] | null)**: `void`
  - 设置指定资源的诊断
  - 参数可以是URI和诊断数组的元组数组，或null（清空所有）

- **set(uri: vscode.Uri, diagnostics: vscode.Diagnostic[] | null)**: `void`
  - 为特定URI设置诊断

- **delete(uri: vscode.Uri)**: `void`
  - 删除指定资源的诊断

- **clear()**: `void`
  - 清空所有诊断

- **forEach(callback: (uri: vscode.Uri, diagnostics: vscode.Diagnostic[], collection: DiagnosticCollection) => any, thisArg?: any)**: `void`
  - 遍历集合中的每个元素

- **get(uri: vscode.Uri)**: `vscode.Diagnostic[] | undefined`
  - 获取指定资源的诊断

- **has(uri: vscode.Uri)**: `boolean`
  - 检查是否包含指定资源的诊断

- **dispose()**: `void`
  - 释放集合资源

#### 示例

```typescript
const collection = vscode.languages.createDiagnosticCollection('myExtension');

// 设置诊断
collection.set(
  vscode.Uri.file('/path/to/file.ts'),
  [
    new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 10),
      "Error message",
      vscode.DiagnosticSeverity.Error
    )
  ]
);

// 获取诊断
const diagnostics = collection.get(vscode.Uri.file('/path/to/file.ts'));

// 清除特定文件的诊断
collection.delete(vscode.Uri.file('/path/to/file.ts'));
```

## 主要函数

### 1. languages.createDiagnosticCollection(name?: string): DiagnosticCollection

创建一个新的诊断集合。

- **参数**:
  - `name`: `string` (可选) - 集合名称，用于标识和调试
- **返回**: `DiagnosticCollection` - 新创建的诊断集合

### 2. languages.getDiagnostics(resource?: vscode.Uri): Diagnostic[] | [vscode.Uri, Diagnostic[]][]

获取诊断信息。

- **参数**:
  - `resource`: `vscode.Uri` (可选) - 如果提供，则返回指定资源的诊断；否则返回所有诊断
- **返回**:
  - 如果指定了资源：`Diagnostic[]` - 该资源的诊断数组
  - 如果未指定资源：`[vscode.Uri, Diagnostic[]][]` - 所有资源的诊断数组

### 3. languages.registerCodeActionsProvider(selector: DocumentSelector, provider: CodeActionProvider, metadata?: CodeActionProviderMetadata): Disposable

注册代码操作提供者，通常与诊断一起使用。

## 事件

### languages.onDidChangeDiagnostics: Event<DiagnosticChangeEvent>

当全局诊断集发生变化时触发的事件。

#### DiagnosticChangeEvent 接口

- **uri**: `vscode.Uri` - 发生变化的文档URI
- **diagnosticCollectionName**: `string | undefined` - 诊断集合名称（如果适用）

#### 示例

```typescript
vscode.languages.onDidChangeDiagnostics(event => {
  console.log('Diagnostics changed for:', event.uris.map(u => u.toString()));
  
  // 获取更新后的诊断
  for (const uri of event.uris) {
    const diagnostics = vscode.languages.getDiagnostics(uri);
    console.log(`Diagnostics for ${uri}:`, diagnostics.length);
  }
});
```

## 诊断格式规范

### 诊断对象结构

```typescript
{
  range: {
    start: { line: number, character: number },
    end: { line: number, character: number }
  },
  message: string,
  severity: DiagnosticSeverity,
  source?: string,
  code?: string | number | {
    value: string | number,
    target: vscode.Uri
  },
  relatedInformation?: [{
    location: {
      uri: vscode.Uri,
      range: {
        start: { line: number, character: number },
        end: { line: number, character: number }
      }
    },
    message: string
  }],
  tags?: DiagnosticTag[]
}
```

### 诊断集合操作格式

#### 设置诊断

```typescript
// 为多个文件设置诊断
diagnosticCollection.set([
  [vscode.Uri.file('/file1.ts'), [diagnostic1, diagnostic2]],
  [vscode.Uri.file('/file2.ts'), [diagnostic3]]
]);

// 为单个文件设置诊断
diagnosticCollection.set(vscode.Uri.file('/file.ts'), [diagnostic1, diagnostic2]);
```

#### 批量操作

```typescript
// 清空所有诊断
diagnosticCollection.clear();

// 删除特定文件的诊断
diagnosticCollection.delete(vscode.Uri.file('/file.ts'));
```

## 最佳实践

### 1. 诊断集合管理

- 为每个扩展创建独立的诊断集合
- 合理命名诊断集合以便识别
- 在扩展停用时清理诊断集合

```typescript
export function activate(context: vscode.ExtensionContext) {
  const diagnosticCollection = vscode.languages.createDiagnosticCollection('myExtension');
  
  context.subscriptions.push(diagnosticCollection);
  
  // 其他初始化代码...
}
```

### 2. 诊断更新策略

- 使用增量更新而不是全量替换
- 合理控制诊断更新频率
- 考虑性能影响，避免过于频繁的更新

### 3. 诊断信息质量

- 提供清晰、准确的诊断消息
- 包含足够的上下文信息
- 使用适当的严重性级别
- 提供有用的诊断代码

### 4. 错误处理

- 妥善处理诊断获取失败的情况
- 提供有意义的错误信息
- 实现适当的重试机制

## 与其他API的集成

### 与 Code Action 的集成

诊断通常与代码操作结合使用，为用户提供修复建议：

```typescript
// 在代码操作提供者中检查诊断
provideCodeActions(document, range, context, token) {
  const diagnostics = context.diagnostics.filter(d => 
    d.source === 'myExtension'
  );
  
  // 基于诊断提供修复建议
}
```

### 与 Hover 的集成

可以基于诊断信息提供悬停提示：

```typescript
// 在悬停提供者中显示诊断详情
provideHover(document, position, token) {
  const diagnostics = vscode.languages.getDiagnostics(document.uri);
  const diagnostic = diagnostics.find(d => 
    d.range.contains(position)
  );
  
  if (diagnostic) {
    return new vscode.Hover(diagnostic.message);
  }
}
```

## 性能考虑

### 1. 内存管理

- 及时清理不再需要的诊断
- 避免存储过期的诊断信息
- 使用适当的数据结构管理大量诊断

### 2. 更新频率

- 避免过于频繁的诊断更新
- 考虑使用防抖机制
- 在适当的时候批量更新诊断

### 3. 数据传输

- 限制诊断数量以避免性能问题
- 只传输必要的诊断信息
- 考虑诊断信息的压缩和优化

## 常见使用场景

### 1. 语法检查

```typescript
// 实时语法检查
document.onDidChangeContent(() => {
  const diagnostics = performSyntaxCheck(document.getText());
  diagnosticCollection.set(document.uri, diagnostics);
});
```

### 2. 代码质量分析

```typescript
// 代码质量分析
async function analyzeCodeQuality(filePath: string) {
  const issues = await runLinter(filePath);
  const diagnostics = issues.map(issue => {
    return new vscode.Diagnostic(
      new vscode.Range(
        issue.line - 1, issue.column - 1,
        issue.endLine - 1, issue.endColumn - 1
      ),
      issue.message,
      convertSeverity(issue.severity)
    );
  });
  
  diagnosticCollection.set(vscode.Uri.file(filePath), diagnostics);
}
```

### 3. 类型检查

```typescript
// 类型检查
function performTypeChecking(sourceCode: string) {
  const typeErrors = typeChecker.check(sourceCode);
  return typeErrors.map(error => {
    return new vscode.Diagnostic(
      new vscode.Range(
        error.startLine, error.startColumn,
        error.endLine, error.endColumn
      ),
      error.message,
      vscode.DiagnosticSeverity.Error
    );
  });
}
```

## 总结

VS Code 的诊断 API 提供了一套强大而灵活的机制来处理代码中的问题。通过合理使用这些 API，扩展可以为用户提供高质量的错误检测、警告和建议功能。关键是要遵循最佳实践，注意性能优化，并确保诊断信息的准确性和有用性。