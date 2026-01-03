# 代码索引系统架构分析

## 概述

代码索引系统是 Roo Code 的核心功能之一，负责将工作区代码解析、分段、向量化并存储到向量数据库中，为代码搜索和 AI 辅助提供语义检索能力。

## 整体架构

代码索引系统主要由以下几个核心组件构成：

### 1. Orchestrator (orchestrator.ts)
负责编排整个索引流程，包括：
- 启动/停止文件监听器
- 协调扫描、解析、向量化等组件
- 管理索引状态（Standby、Indexing、Indexed、Error）
- 处理全量扫描和增量扫描
- 估算集合大小并请求用户确认

### 2. DirectoryScanner (scanner.ts)
负责扫描工作区文件并批量处理：
- 递归扫描目录（最多 50,000 个文件）
- 过滤支持的文件扩展名
- 并发解析文件（并发度 10）
- 批量处理代码块（默认每批 60 个段）
- 管理文件哈希缓存，避免重复处理

### 3. CodeParser (parser.ts)
核心解析器，负责将代码文件分割成代码块

### 4. CacheManager
管理文件哈希缓存，用于增量索引

### 5. VectorStore (QdrantClient)
向量数据库客户端，负责存储和检索代码向量

## Tree-sitter 分段逻辑详解

### 1. 语言解析器加载

系统使用 `languageParser.ts` 动态加载 tree-sitter WASM 解析器：

```typescript
// languageParser.ts:119-226
// 根据文件扩展名加载对应的语言解析器和查询
switch (ext) {
  case "js":
  case "jsx":
  case "json":
    language = await loadLanguage("javascript", sourceDirectory)
    query = new Query(language, javascriptQuery)
    break
  case "py":
    language = await loadLanguage("python", sourceDirectory)
    query = new Query(language, pythonQuery)
    break
  case "ts":
    language = await loadLanguage("typescript", sourceDirectory)
    query = new Query(language, typescriptQuery)
    break
  case "tsx":
    language = await loadLanguage("tsx", sourceDirectory)
    query = new Query(language, tsxQuery)
    break
  case "rs":
    language = await loadLanguage("rust", sourceDirectory)
    query = new Query(language, rustQuery)
    break
  case "go":
    language = await loadLanguage("go", sourceDirectory)
    query = new Query(language, goQuery)
    break
  // ... 其他语言
}
```

### 2. Tree-sitter 查询模式

每种语言都有专门的查询模式来捕获语义代码块。查询模式定义在 `src/services/tree-sitter/queries/` 目录下。

#### JavaScript 查询示例 (queries/javascript.ts)

```javascript
// 捕获类定义
(
  (comment)* @doc
  .
  [
    (class name: (_) @name)
    (class_declaration name: (_) @name)
  ] @definition.class
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @definition.class)
)

// 捕获方法定义
(
  (comment)* @doc
  .
  (method_definition
    name: (property_identifier) @name) @definition.method
  (#not-eq? @name "constructor")
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @definition.method)
)

// 捕获函数声明
(
  (comment)* @doc
  .
  [
    (function_declaration name: (identifier) @name)
    (generator_function_declaration name: (identifier) @name)
  ] @definition.function
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @definition.function)
)

// 捕获箭头函数
(
  (comment)* @doc
  .
  (lexical_declaration
    (variable_declarator
      name: (identifier) @name
      value: [(arrow_function) (function_expression)]) @definition.function)
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @definition.function)
)

// JSON 对象定义
(object) @object.definition

// JSON 数组定义
(array) @array.definition
```

#### Python 查询示例 (queries/python.ts)

```python
// 类定义（包括装饰器）
(class_definition
  name: (identifier) @name.definition.class) @definition.class

(decorated_definition
  definition: (class_definition
    name: (identifier) @name.definition.class)) @definition.class

// 函数和方法定义（包括 async 和装饰器）
(function_definition
  name: (identifier) @name.definition.function) @definition.function

(decorated_definition
  definition: (function_definition
    name: (identifier) @name.definition.function)) @definition.function

// Lambda 表达式
(expression_statement
  (assignment
    left: (identifier) @name.definition.lambda
    right: (parenthesized_expression
      (lambda)))) @definition.lambda

// 生成器函数
(function_definition
  name: (identifier) @name.definition.generator
  body: (block
    (expression_statement
      (yield)))) @definition.generator

// 推导式
(expression_statement
  (assignment
    left: (identifier) @name.definition.comprehension
    right: [
      (list_comprehension)
      (dictionary_comprehension)
      (set_comprehension)
    ])) @definition.comprehension
```

### 3. 核心分段算法

分段逻辑在 `parser.ts:95-247` 中实现：

#### 步骤 1: 使用 Tree-sitter 查询捕获节点

```typescript
// parser.ts:137-139
const tree = language.parser.parse(content)
const captures = tree ? language.query.captures(tree.rootNode) : []
```

#### 步骤 2: 处理捕获的节点

```typescript
// parser.ts:148-247
const queue: Node[] = Array.from(captures).map((capture) => capture.node)

while (queue.length > 0) {
  const currentNode = queue.shift()!
  
  // 检查节点是否满足最小字符要求
  if (currentNode.text.length >= MIN_BLOCK_CHARS) {
    // 如果超过最大字符限制，尝试拆分
    if (currentNode.text.length > MAX_BLOCK_CHARS * MAX_CHARS_TOLERANCE_FACTOR) {
      if (currentNode.children.filter((child) => child !== null).length > 0) {
        // 如果有子节点，处理子节点
        queue.push(...currentNode.children.filter((child) => child !== null))
      } else {
        // 如果是叶子节点，按行分割
        const chunkedBlocks = this._chunkLeafNodeByLines(
          currentNode,
          filePath,
          fileHash,
          seenSegmentHashes,
        )
        results.push(...chunkedBlocks)
      }
    } else {
      // 节点满足要求，创建代码块
      const identifier = currentNode.childForFieldName("name")?.text ||
                       currentNode.children.find((c) => c?.type === "identifier")?.text
      const type = currentNode.type
      const start_line = currentNode.startPosition.row + 1
      const end_line = currentNode.endPosition.row + 1
      
      results.push({
        file_path: filePath,
        identifier,
        type,
        start_line,
        end_line,
        content: currentNode.text,
        segmentHash,
        fileHash,
      })
    }
  }
}
```

### 4. 分段策略

#### 常量定义 (constants/index.ts)

```typescript
export const MAX_BLOCK_CHARS = 1000           // 最大块字符数
export const MIN_BLOCK_CHARS = 50              // 最小块字符数
export const MIN_CHUNK_REMAINDER_CHARS = 200   // 分割后剩余块最小字符数
export const MAX_CHARS_TOLERANCE_FACTOR = 1.15 // 15% 容差因子
```

#### 分段规则

1. **语义优先**：优先使用 tree-sitter 查询捕获的语义节点（类、函数、方法等）

2. **大小控制**：
   - 小于 50 字符的节点被忽略
   - 超过 1150 字符（1000 × 1.15）的节点需要拆分

3. **递归拆分**：
   - 如果节点有子节点，递归处理子节点
   - 如果是叶子节点（如长字符串、大数组），按行分割

4. **按行分割算法** (parser.ts:249-363)：

```typescript
private _chunkTextByLines(
  lines: string[],
  filePath: string,
  fileHash: string,
  chunkType: string,
  seenSegmentHashes: Set<string>,
  baseStartLine: number = 1,
): CodeBlock[] {
  const chunks: CodeBlock[] = []
  let currentChunkLines: string[] = []
  let currentChunkLength = 0
  let chunkStartLineIndex = 0
  const effectiveMaxChars = MAX_BLOCK_CHARS * MAX_CHARS_TOLERANCE_FACTOR

  const finalizeChunk = (endLineIndex: number) => {
    if (currentChunkLength >= MIN_BLOCK_CHARS && currentChunkLines.length > 0) {
      const chunkContent = currentChunkLines.join("\n")
      const startLine = baseStartLine + chunkStartLineIndex
      const endLine = baseStartLine + endLineIndex
      // ... 创建代码块
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineLength = line.length + (i < lines.length - 1 ? 1 : 0)

    // 处理超长行
    if (lineLength > effectiveMaxChars) {
      // 分割超长行
      let remainingLineContent = line
      let currentSegmentStartChar = 0
      while (remainingLineContent.length > 0) {
        const segment = remainingLineContent.substring(0, MAX_BLOCK_CHARS)
        remainingLineContent = remainingLineContent.substring(MAX_BLOCK_CHARS)
        // ... 创建段代码块
      }
      continue
    }

    // 处理正常大小的行
    if (currentChunkLength > 0 && currentChunkLength + lineLength > effectiveMaxChars) {
      // 重平衡逻辑：避免产生过小的剩余块
      let splitIndex = i - 1
      let remainderLength = 0
      for (let j = i; j < lines.length; j++) {
        remainderLength += lines[j].length + (j < lines.length - 1 ? 1 : 0)
      }

      if (
        currentChunkLength >= MIN_BLOCK_CHARS &&
        remainderLength < MIN_CHUNK_REMAINDER_CHARS &&
        currentChunkLines.length > 1
      ) {
        // 向前查找合适的分割点
        for (let k = i - 2; k >= chunkStartLineIndex; k--) {
          const potentialChunkLines = lines.slice(chunkStartLineIndex, k + 1)
          const potentialChunkLength = potentialChunkLines.join("\n").length + 1
          const potentialNextChunkLines = lines.slice(k + 1)
          const potentialNextChunkLength = potentialNextChunkLines.join("\n").length + 1

          if (
            potentialChunkLength >= MIN_BLOCK_CHARS &&
            potentialNextChunkLength >= MIN_CHUNK_REMAINDER_CHARS
          ) {
            splitIndex = k
            break
          }
        }
      }

      finalizeChunk(splitIndex)
    } else {
      currentChunkLines.push(line)
      currentChunkLength += lineLength
    }
  }

  // 处理最后剩余的块
  if (currentChunkLines.length > 0) {
    finalizeChunk(lines.length - 1)
  }

  return chunks
}
```

5. **Markdown 特殊处理** (parser.ts:437-537)：
   - 使用自定义 markdown 解析器
   - 按标题（header）分段
   - 提取标题级别和文本作为标识符
   - 处理标题前后的内容

6. **Fallback 机制** (supported-extensions.ts)：

```typescript
export const fallbackExtensions = [
  ".vb",    // Visual Basic .NET - 没有专用的 WASM 解析器
  ".scala", // Scala - 使用 fallback 分段而不是 Lua 查询变通方法
  ".swift", // Swift - 由于解析器不稳定使用 fallback 分段
]

export function shouldUseFallbackChunking(extension: string): boolean {
  return fallbackExtensions.includes(extension.toLowerCase())
}
```

   - 某些语言（如 .vb, .scala, .swift）使用 fallback 分段
   - 直接按行分割，不使用 tree-sitter

### 5. 代码块结构

每个代码块包含以下信息：

```typescript
// interfaces/file-processor.ts
interface CodeBlock {
  file_path: string      // 文件路径
  identifier: string | null  // 标识符（函数名、类名等）
  type: string           // 节点类型（function, class, method 等）
  start_line: number     // 起始行号
  end_line: number       // 结束行号
  content: string        // 代码内容
  segmentHash: string    // 段哈希（用于去重）
  fileHash: string       // 文件哈希（用于缓存）
}
```

### 6. 批量处理流程

在 `scanner.ts:95-378` 中：

1. **并发解析**：使用 `p-limit` 控制并发度为 10

```typescript
const parseLimiter = pLimit(PARSING_CONCURRENCY) // 并发度 10
const parsePromises = supportedPaths.map((filePath) =>
  parseLimiter(async () => {
    // 解析文件
    const blocks = await this.codeParser.parseFile(filePath, { content, fileHash: currentFileHash })
  })
)
```

2. **批量累积**：累积代码块直到达到阈值（默认 60 个）

```typescript
if (currentBatchBlocks.length >= this.batchSegmentThreshold) {
  // 等待待处理批次数量不超过最大值
  while (pendingBatchCount >= MAX_PENDING_BATCHES) {
    await Promise.race(activeBatchPromises)
  }

  // 复制当前批次数据并清空累加器
  const batchBlocks = [...currentBatchBlocks]
  const batchTexts = [...currentBatchTexts]
  const batchFileInfos = [...currentBatchFileInfos]
  currentBatchBlocks = []
  currentBatchTexts = []
  currentBatchFileInfos = []

  // 队列化批次处理
  const batchPromise = batchLimiter(() =>
    this.processBatch(batchBlocks, batchTexts, batchFileInfos, scanWorkspace, onError, onBlocksIndexed)
  )
  activeBatchPromises.add(batchPromise)
}
```

3. **批量向量化**：调用 embedder 创建 embeddings

```typescript
// 创建 embeddings
const { embeddings } = await this.embedder.createEmbeddings(batchTexts)

// 准备 Qdrant 点
const points = batchBlocks.map((block, index) => {
  const normalizedAbsolutePath = generateNormalizedAbsolutePath(block.file_path, scanWorkspace)
  const pointId = uuidv5(block.segmentHash, QDRANT_CODE_BLOCK_NAMESPACE)

  return {
    id: pointId,
    vector: embeddings[index],
    payload: {
      filePath: generateRelativeFilePath(normalizedAbsolutePath, scanWorkspace),
      codeChunk: block.content,
      startLine: block.start_line,
      endLine: block.end_line,
      segmentHash: block.segmentHash,
    },
  }
})
```

4. **批量插入**：将向量插入 Qdrant 向量数据库

```typescript
await this.qdrantClient.upsertPoints(points)
```

5. **缓存管理**：更新文件哈希缓存，避免重复处理

```typescript
for (const fileInfo of batchFileInfos) {
  await this.cacheManager.updateHash(fileInfo.filePath, fileInfo.fileHash)
}
```

6. **重试机制**：

```typescript
let attempts = 0
let success = false
let lastError: Error | null = null

while (attempts < MAX_BATCH_RETRIES && !success) {
  attempts++
  try {
    // 处理批次
    await this.qdrantClient.upsertPoints(points)
    success = true
  } catch (error) {
    lastError = error as Error
    if (attempts < MAX_BATCH_RETRIES) {
      const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempts - 1)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}
```

## 支持的文件类型

系统支持以下文件类型：

### 编程语言
- JavaScript (.js, .jsx)
- TypeScript (.ts, .tsx)
- Python (.py)
- Rust (.rs)
- Go (.go)
- C/C++ (.c, .h, .cpp, .hpp)
- C# (.cs)
- Ruby (.rb)
- Java (.java)
- PHP (.php)
- Swift (.swift)
- Kotlin (.kt, .kts)
- Scala (.scala)
- OCaml (.ml, .mli)
- Zig (.zig)
- Lua (.lua)
- Elixir (.ex, .exs)
- Emacs Lisp (.el)
- Solidity (.sol)

### 标记语言
- HTML (.html)
- CSS (.css)
- JSON (.json)
- TOML (.toml)
- Markdown (.md, .markdown)
- Vue (.vue)

### 模板语言
- EJS (.ejs)
- ERB (.erb)

### 其他
- SystemRDL (.rdl)
- TLA+ (.tla)

## 索引流程

### 1. 初始化阶段

1. **检查配置**：验证服务是否已配置
2. **估算大小**：使用 `TokenBasedSizeEstimator` 估算集合大小
3. **用户确认**：显示估算结果并请求用户确认
4. **初始化向量存储**：创建或连接到 Qdrant 集合

### 2. 扫描阶段

1. **全量扫描**：
   - 首次索引或集合不存在时执行
   - 扫描所有支持的文件
   - 解析并索引所有代码块

2. **增量扫描**：
   - 集合已存在且有数据时执行
   - 使用缓存跳过未更改的文件
   - 只索引新增或修改的文件

### 3. 处理阶段

1. **文件过滤**：
   - 按扩展名过滤
   - 应用 .gitignore 规则
   - 应用 .rooignore 规则
   - 排除忽略的目录

2. **文件解析**：
   - 读取文件内容
   - 计算文件哈希
   - 与缓存比较
   - 如果文件已更改，进行解析

3. **代码分段**：
   - 使用 tree-sitter 解析
   - 应用查询模式捕获节点
   - 按大小和语义分段
   - 生成代码块

4. **向量化**：
   - 批量创建 embeddings
   - 准备向量点
   - 插入向量数据库

### 4. 监听阶段

1. **启动文件监听器**：
   - 监听文件系统变化
   - 批量处理文件更改
   - 增量更新索引

2. **状态管理**：
   - 更新索引状态
   - 报告进度
   - 处理错误

## 性能优化

### 1. 并发控制

- **解析并发度**：10（`PARSING_CONCURRENCY`）
- **批次处理并发度**：10（`BATCH_PROCESSING_CONCURRENCY`）
- **最大待处理批次**：20（`MAX_PENDING_BATCHES`）

### 2. 批量处理

- **默认批次大小**：60 个代码块（`BATCH_SEGMENT_THRESHOLD`）
- **最大批次 Token 数**：100,000（`MAX_BATCH_TOKENS`）
- **最大单项 Token 数**：8,191（`MAX_ITEM_TOKENS`）

### 3. 缓存机制

- **文件哈希缓存**：避免重复处理未更改的文件
- **段哈希去重**：避免索引重复的代码段
- **增量索引**：只处理新增或修改的文件

### 4. 大小限制

- **最大文件大小**：1 MB（`MAX_FILE_SIZE_BYTES`）
- **最大扫描文件数**：50,000（`MAX_LIST_FILES_LIMIT_CODE_INDEX`）

## 错误处理

### 1. 批次重试

- **最大重试次数**：3（`MAX_BATCH_RETRIES`）
- **初始延迟**：500 ms（`INITIAL_RETRY_DELAY_MS`）
- **指数退避**：延迟时间按指数增长

### 2. 错误恢复

- **部分失败**：记录错误但继续处理
- **完全失败**：清理集合和缓存
- **连接失败**：保留缓存以便后续增量扫描

### 3. 状态管理

- **Standby**：待机状态
- **Indexing**：索引中
- **Indexed**：索引完成
- **Error**：错误状态

## 总结

代码索引系统的分段逻辑具有以下特点：

1. **语义感知**：利用 tree-sitter 捕获语言特定的语义结构
2. **智能分段**：基于代码结构而非简单的行数分割
3. **大小控制**：确保每个代码块在合理大小范围内（50-1150 字符）
4. **容错机制**：对不支持的语言使用 fallback 分段
5. **高效处理**：批量处理和并发控制提高性能
6. **去重缓存**：使用哈希机制避免重复处理相同内容
7. **增量索引**：只处理新增或修改的文件
8. **错误恢复**：完善的错误处理和重试机制

这种设计使得代码索引既能保持语义完整性，又能控制向量大小，提高检索效率，为代码搜索和 AI 辅助提供强大的语义检索能力。
