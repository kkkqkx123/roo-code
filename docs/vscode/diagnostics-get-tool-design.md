# Roo Code 诊断获取工具设计方案（独立版本）

## 概述

本方案旨在设计一个独立的诊断获取工具，用于针对一个或多个文件夹或文件调用 VSCode 的诊断 API，获取详细的诊断结果。该工具独立于文件修改操作，专门用于诊断信息查询。

## 设计目标

1. **独立的诊断查询功能**：不依赖于文件修改操作，可独立调用
2. **灵活的诊断目标选择**：支持针对单个文件、多个文件或整个文件夹获取诊断信息
3. **精确的诊断过滤**：支持按严重程度、诊断来源、诊断代码等条件过滤
4. **高效的诊断聚合**：能够聚合和格式化诊断信息，便于 LLM 理解和处理
5. **与现有系统兼容**：与现有的诊断模块保持一致的格式和功能

## 工具设计

### 1. 工具名称：`get_workspace_diagnostics`

### 2. 工具参数设计

```typescript
interface GetWorkspaceDiagnosticsParams {
  /**
   * 要获取诊断的目标路径
   * 可以是文件路径、文件夹路径或 glob 模式
   * 如果为空，则获取整个工作区的诊断
   */
  targets?: string[]
  
  /**
   * 诊断严重程度过滤
   * 默认：["error", "warning"]
   */
  severity?: ("error" | "warning" | "information" | "hint")[]
  
  /**
   * 诊断来源过滤
   * 例如：["typescript", "eslint", "pylint"] 
   */
  sources?: string[]
  
  /**
   * 诊断代码过滤
   * 例如：["TS2532", "no-unused-vars"]
   */
  codes?: (string | number)[]
  
  /**
   * 最大诊断数量限制
   * 默认：100
   */
  maxResults?: number
  
  /**
   * 是否包含相关诊断信息
   * 默认：false
   */
  includeRelatedInformation?: boolean
  
  /**
   * 是否包含诊断标签
   * 默认：false
   */
  includeTags?: boolean
  
  /**
   * 排序方式
   * 默认："severity" (按严重程度排序)
   */
  sortBy?: "severity" | "file" | "line" | "source"
  
  /**
   * 是否只返回摘要信息
   * 默认：false
   */
  summaryOnly?: boolean
}
```

### 3. 工具实现逻辑

```typescript
class GetWorkspaceDiagnosticsTool extends BaseTool<"get_workspace_diagnostics"> {
  async execute(params: GetWorkspaceDiagnosticsParams, task: Task, callbacks: ToolCallbacks) {
    // 1. 解析目标路径，如果未指定则获取整个工作区
    const uris = await this.resolveTargetUris(params.targets, task.cwd)
    
    // 2. 获取所有诊断信息
    const allDiagnostics = vscode.languages.getDiagnostics()
    
    // 3. 过滤到目标路径的诊断
    const filteredByPath = this.filterByPath(allDiagnostics, uris)
    
    // 4. 应用过滤条件
    const filteredDiagnostics = this.filterDiagnostics(filteredByPath, params)
    
    // 5. 应用排序
    const sortedDiagnostics = this.sortDiagnostics(filteredDiagnostics, params.sortBy)
    
    // 6. 限制结果数量
    const limitedDiagnostics = sortedDiagnostics.slice(0, params.maxResults ?? 100)
    
    // 7. 格式化输出
    const result = params.summaryOnly 
      ? this.formatSummary(limitedDiagnostics, params)
      : this.formatDetailed(limitedDiagnostics, params)
    
    callbacks.pushToolResult(result)
  }
}
```

### 4. 核心功能实现

#### 4.1 路径解析
```typescript
private async resolveTargetUris(targets?: string[], cwd: string): Promise<Set<string>> {
  const uris = new Set<string>()
  
  if (!targets || targets.length === 0) {
    // 如果没有指定目标，返回空集合，表示获取整个工作区
    return uris
  }
  
  for (const target of targets) {
    const absolutePath = path.resolve(cwd, target)
    
    if (fs.statSync(absolutePath).isDirectory()) {
      // 文件夹：递归获取所有文件
      const files = await this.getAllFilesInDirectory(absolutePath)
      files.forEach(f => uris.add(vscode.Uri.file(f).toString()))
    } else if (target.includes('*')) {
      // Glob 模式
      const matchedFiles = await glob(target, { cwd })
      matchedFiles.forEach(f => uris.add(vscode.Uri.file(path.resolve(cwd, f)).toString()))
    } else {
      // 单个文件
      uris.add(vscode.Uri.file(absolutePath).toString())
    }
  }
  
  return uris
}
```

#### 4.2 路径过滤
```typescript
private filterByPath(
  diagnostics: [vscode.Uri, vscode.Diagnostic[]][],
  targetUris: Set<string>
): [vscode.Uri, vscode.Diagnostic[]][] {
  if (targetUris.size === 0) {
    // 如果没有指定目标，返回所有诊断
    return diagnostics
  }
  
  return diagnostics.filter(([uri, _]) => targetUris.has(uri.toString()))
}
```

#### 4.3 诊断过滤
```typescript
private filterDiagnostics(
  diagnostics: [vscode.Uri, vscode.Diagnostic[]][],
  params: GetWorkspaceDiagnosticsParams
): [vscode.Uri, vscode.Diagnostic[]][] {
  return diagnostics.map(([uri, diags]) => {
    const filtered = diags.filter(diag => {
      // 严重程度过滤
      if (params.severity && !this.matchesSeverity(diag.severity, params.severity)) {
        return false
      }
      
      // 来源过滤
      if (params.sources && !params.sources.includes(diag.source || '')) {
        return false
      }
      
      // 代码过滤
      if (params.codes) {
        const codeStr = typeof diag.code === 'object' ? String(diag.code?.value) : String(diag.code)
        if (codeStr && !params.codes.some(code => String(code) === codeStr)) {
          return false
        }
      }
      
      return true
    })
    
    return [uri, filtered]
  }).filter(([_, diags]) => diags.length > 0)
}
```

## 工具描述设计

### 1. XML 格式工具描述

```typescript
export function getGetWorkspaceDiagnosticsDescription(args: ToolArgs): string {
  const maxResults = args.settings?.maxDiagnosticMessages ?? 100
  
  return `## get_workspace_diagnostics
Description: Request diagnostic information for specific files, folders, or the entire workspace. This tool queries VSCode's diagnostic API to retrieve error, warning, and other diagnostic information for the specified targets. It provides detailed diagnostic data including severity, source, code, and location information.

Parameters:
- targets: (optional) Array of file paths, folder paths, or glob patterns to get diagnostics for. If not provided, gets diagnostics for the entire workspace.
- severity: (optional) Array of diagnostic severities to include. Options: ["error", "warning", "information", "hint"]. Default: ["error", "warning"]
- sources: (optional) Array of diagnostic sources to filter by (e.g., "typescript", "eslint"). Default: all sources
- codes: (optional) Array of diagnostic codes to filter by (e.g., "TS2532", "no-unused-vars"). Default: all codes
- maxResults: (optional) Maximum number of diagnostic results to return. Default: ${maxResults}
- includeRelatedInformation: (optional) Whether to include related diagnostic information. Default: false
- includeTags: (optional) Whether to include diagnostic tags. Default: false
- sortBy: (optional) Sort order for results. Options: ["severity", "file", "line", "source"]. Default: "severity"
- summaryOnly: (optional) Whether to return only summary information. Default: false

Usage:
<get_workspace_diagnostics>
<args>
  <targets>
    <target>src/</target>
    <target>tests/*.ts</target>
  </targets>
  <severity>
    <level>error</level>
    <level>warning</level>
  </severity>
  <sources>
    <source>typescript</source>
  </sources>
  <maxResults>50</maxResults>
  <summaryOnly>false</summaryOnly>
</args>
</get_workspace_diagnostics>

Examples:

1. Get diagnostics for entire workspace:
<get_workspace_diagnostics>
<args>
</args>
</get_workspace_diagnostics>

2. Get error diagnostics for specific folder:
<get_workspace_diagnostics>
<args>
  <targets>
    <target>src/components/</target>
  </targets>
  <severity>
    <level>error</level>
  </severity>
</args>
</get_workspace_diagnostics>

3. Get diagnostics with specific sources and codes:
<get_workspace_diagnostics>
<args>
  <targets>
    <target>src/main.ts</target>
  </targets>
  <sources>
    <source>typescript</source>
    <source>eslint</source>
  </sources>
  <codes>
    <code>TS2532</code>
    <code>no-unused-vars</code>
  </codes>
  <maxResults>20</maxResults>
</args>
</get_workspace_diagnostics>

4. Get summary diagnostics for multiple files:
<get_workspace_diagnostics>
<args>
  <targets>
    <target>src/file1.ts</target>
    <target>src/file2.ts</target>
  </targets>
  <summaryOnly>true</summaryOnly>
</args>
</get_workspace_diagnostics>

IMPORTANT: You MUST use this diagnostic query strategy:
- Use specific targets to focus on relevant areas of code
- Filter by severity to focus on most critical issues first
- Use maxResults to prevent overwhelming diagnostic output
- Use summaryOnly for high-level diagnostic overview
- Combine with other tools like read_file to get context for diagnostic issues`
}
```

### 2. Native 工具格式描述

```typescript
import type OpenAI from "openai"

const GET_WORKSPACE_DIAGNOSTICS_BASE_DESCRIPTION = `Query diagnostic information for specific files, folders, or the entire workspace. Returns detailed diagnostic data including severity, source, code, and location information.`

export function createGetWorkspaceDiagnosticsTool(): OpenAI.Chat.ChatCompletionTool {
  const description = GET_WORKSPACE_DIAGNOSTICS_BASE_DESCRIPTION + 
    ` Structure: { targets?: string[], severity?: ("error"|"warning"|"information"|"hint")[], sources?: string[], codes?: (string|number)[], maxResults?: number, includeRelatedInformation?: boolean, includeTags?: boolean, sortBy?: ("severity"|"file"|"line"|"source"), summaryOnly?: boolean }. ` +
    `Example: { targets: ["src/"], severity: ["error", "warning"], maxResults: 50 }`

  return {
    type: "function",
    function: {
      name: "get_workspace_diagnostics",
      description,
      strict: true,
      parameters: {
        type: "object",
        properties: {
          targets: {
            type: "array",
            description: "File paths, folder paths, or glob patterns to get diagnostics for. If not provided, gets diagnostics for entire workspace",
            items: {
              type: "string"
            }
          },
          severity: {
            type: "array",
            description: "Diagnostic severities to include. Default: ['error', 'warning']",
            items: {
              type: "string",
              enum: ["error", "warning", "information", "hint"]
            }
          },
          sources: {
            type: "array",
            description: "Diagnostic sources to filter by (e.g., 'typescript', 'eslint')",
            items: {
              type: "string"
            }
          },
          codes: {
            type: "array",
            description: "Diagnostic codes to filter by (e.g., 'TS2532', 'no-unused-vars')",
            items: {
              type: "string"
            }
          },
          maxResults: {
            type: "number",
            description: "Maximum number of diagnostic results to return. Default: 100"
          },
          includeRelatedInformation: {
            type: "boolean",
            description: "Whether to include related diagnostic information. Default: false"
          },
          includeTags: {
            type: "boolean",
            description: "Whether to include diagnostic tags. Default: false"
          },
          sortBy: {
            type: "string",
            description: "Sort order for results. Default: 'severity'",
            enum: ["severity", "file", "line", "source"]
          },
          summaryOnly: {
            type: "boolean",
            description: "Whether to return only summary information. Default: false"
          }
        },
        required: [],
        additionalProperties: false
      }
    }
  } satisfies OpenAI.Chat.ChatCompletionTool
}

export const get_workspace_diagnostics = createGetWorkspaceDiagnosticsTool()
```

## 独立使用场景

### 1. 诊断查询场景
- **代码审查**：独立查询特定文件或模块的诊断信息
- **质量检查**：定期检查项目质量指标
- **问题排查**：专门针对问题文件进行诊断分析
- **状态监控**：监控项目整体诊断状态

### 2. 与现有系统的区别
- **独立性**：不依赖于文件修改操作，可随时调用
- **查询性**：专门用于诊断信息查询，而非文件操作后的反馈
- **灵活性**：支持更广泛的诊断查询需求
- **实时性**：获取当前最新的诊断状态

## 输出格式设计

### 1. JSON 输出格式
```json
{
  "queryInfo": {
    "targets": ["src/", "tests/"],
    "severity": ["error", "warning"],
    "timestamp": "2024-01-15T10:30:00Z"
  },
  "summary": {
    "totalDiagnostics": 25,
    "bySeverity": {
      "error": 5,
      "warning": 15,
      "information": 5
    },
    "bySource": {
      "typescript": 12,
      "eslint": 8,
      "tsc": 5
    },
    "byFileCount": 8
  },
  "diagnostics": [
    {
      "file": "src/example.ts",
      "line": 15,
      "column": 8,
      "severity": "error",
      "source": "typescript",
      "code": "TS2532",
      "message": "Object is possibly 'undefined'",
      "range": {
        "start": { "line": 15, "character": 8 },
        "end": { "line": 15, "character": 15 }
      }
    }
  ]
}
```

### 2. Markdown 输出格式（用于 LLM 交互）
```markdown
## Diagnostic Analysis Results
**Query Time:** 2024-01-15 10:30:00
**Targets:** src/, tests/
**Severity Filter:** error, warning

### Summary
- **Total Issues:** 25
- **By Severity:** 5 errors, 15 warnings, 5 info
- **Affected Files:** 8 files
- **Main Sources:** typescript (12), eslint (8), tsc (5)

### Detailed Issues

#### src/example.ts
**Line 15:** [typescript] TS2532 - Object is possibly 'undefined'
```ts
const value = obj?.property;
console.log(value.toString()); // Error here
```

**Line 23:** [eslint] no-unused-vars - 'unusedVar' is defined but never used
```ts
const unusedVar = "hello"; // Unused variable
```

#### src/utils/helper.ts
**Line 45:** [typescript] TS7006 - Parameter 'param' implicitly has an 'any' type

### Recommendations
1. Address critical errors first (5 items)
2. Review unused variables (3 items) 
3. Add proper type annotations
```

## 集成考虑

### 1. 与现有诊断模块的关系
- 复用 `diagnosticsToProblemsString` 函数进行格式化
- 集成到现有的诊断配置系统
- 支持相同的过滤和限制选项

### 2. 性能优化
- 支持诊断结果缓存
- 实现增量更新机制
- 提供进度指示器

### 3. 错误处理
- 路径不存在的处理
- 权限不足的处理
- 大量诊断结果的处理

## 使用场景

### 1. 代码质量检查
```
get_workspace_diagnostics(targets=["src/"], severity=["error", "warning"])
```

### 2. 特定问题排查
```
get_workspace_diagnostics(targets=["src/main.ts"], sources=["typescript"], codes=["TS2532"])
```

### 3. 批量诊断分析
```
get_workspace_diagnostics(targets=["*.ts", "*.tsx"], severity=["error"], maxResults=100)
```

### 4. 工作区整体诊断
```
get_workspace_diagnostics(summaryOnly=true)
```

## 安全和权限考虑

### 1. 文件访问权限
- 遵循 `.rooignore` 规则
- 检查文件读取权限
- 提供安全的路径解析

### 2. 诊断信息隐私
- 不包含敏感的诊断数据
- 可配置的诊断信息详细程度

## 实施计划

### 阶段 1：基础工具实现
- 实现基本的诊断获取功能
- 支持文件和文件夹目标
- 基础的严重程度过滤

### 阶段 2：高级功能
- 实现所有过滤选项
- 添加排序和分页功能
- 实现缓存机制

### 阶段 3：工具描述集成
- 集成到工具描述系统
- 实现 XML 和 Native 两种格式
- 添加用户界面支持

## 测试策略

### 1. 单元测试
- 路径解析功能测试
- 诊断过滤功能测试
- 输出格式验证

### 2. 集成测试
- 与 LLM 的集成测试
- 与现有诊断模块的兼容性测试
- 性能基准测试

## 预期收益

1. **独立诊断能力**：提供独立的诊断查询功能
2. **灵活的问题排查**：支持多种诊断查询场景
3. **增强的代码质量分析**：更好的诊断驱动开发体验
4. **与现有系统兼容**：保持与当前诊断模块的一致性