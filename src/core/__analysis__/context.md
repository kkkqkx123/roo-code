## 📁 `src/core/context-management` - 对话上下文管理

### 主要作用
这个目录负责**对话历史上下文的管理**，当对话接近 token 限制时自动处理，确保不会超过 AI 模型的上下文窗口限制。

### 核心功能

1. **智能上下文压缩**
   - 当对话达到配置的阈值时，自动调用 AI 压缩历史消息
   - 保留关键信息，减少 token 使用

2. **滑动窗口截断**
   - 作为压缩失败时的后备方案
   - 非破坏性地隐藏旧消息（标记为 `truncationParent`）
   - 可以通过回滚恢复被截断的消息

3. **错误检测**
   - 检测各种 AI 提供商的上下文窗口错误
   - 支持 OpenAI、Anthropic、OpenRouter、Cerebras 等

### 主要导出函数
- `manageContext()` - 主函数，根据 token 使用情况决定是否压缩或截断
- `truncateConversation()` - 执行滑动窗口截断
- `willManageContext()` - 预测是否需要运行上下文管理
- `estimateTokenCount()` - 估算消息的 token 数量
- `checkContextWindowExceededError()` - 检测上下文窗口错误

### 使用位置
主要在 **`src/core/task/Task.ts:3440`** 和 **`src/core/task/Task.ts:3612`** 中使用，在每次发送消息到 API 之前调用。

---

## 📁 `src/core/context-tracking` - 文件上下文跟踪

### 主要作用
这个目录负责**文件操作的跟踪和监控**，防止 Roo 使用过时的文件内容进行编辑操作。

### 核心功能

1. **文件操作跟踪**
   - 记录文件何时被 Roo 读取或编辑
   - 记录文件何时被用户编辑
   - 记录文件何时被提及

2. **文件变更检测**
   - 为被跟踪的文件设置文件系统监听器
   - 检测文件在外部（用户手动编辑）的修改
   - 区分 Roo 的编辑和用户的编辑

3. **元数据管理**
   - 保存文件操作历史到任务元数据
   - 跟踪文件状态（active/stale）
   - 记录最后读取/编辑时间

### 主要类和方法
- `FileContextTracker` - 主类
  - `trackFileContext()` - 跟踪文件操作
  - `setupFileWatcher()` - 设置文件监听器
  - `getAndClearRecentlyModifiedFiles()` - 获取最近修改的文件
  - `markFileAsEditedByRoo()` - 标记文件为 Roo 编辑

### 使用位置
在多个工具类中使用：
- **文件读取工具**: `ReadFileTool.ts:97`, `simpleReadFileTool.ts:97`
- **文件编辑工具**: `EditFileTool.ts:97`, `ApplyDiffTool.ts:97`, `MultiApplyDiffTool.ts:97`, `ApplyPatchTool.ts:97`, `WriteToFileTool.ts:97`
- **搜索替换工具**: `SearchAndReplaceTool.ts:97`, `SearchReplaceTool.ts:97`
- **Task.ts:431** - 在 Task 构造函数中初始化

---

## 🔗 两个模块的关系

| 维度 | context-management | context-tracking |
|------|-------------------|------------------|
| **关注点** | 对话历史消息 | 文件操作 |
| **目的** | 控制 token 使用 | 防止上下文过时 |
| **触发时机** | 发送 API 请求前 | 文件操作时 |
| **主要使用者** | Task 类 | 各个工具类 |
| **数据存储** | 内存中的消息数组 | 任务元数据文件 |

**协同工作场景示例**：
1. 用户通过工具读取文件 → `context-tracking` 记录文件读取
2. 对话继续，消息增多 → `context-management` 可能压缩对话历史
3. 用户手动修改了文件 → `context-tracking` 检测到变更
4. Roo 尝试编辑文件时 → 可以重新读取最新内容，避免基于过时上下文编辑

这两个模块共同确保了 Roo Code 在长时间对话中既能有效管理 token 使用，又能保持文件上下文的准确性。