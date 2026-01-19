# src/core 目录结构重构方案

## 一、现状分析

### 1.1 当前目录结构概览

```
src/core/
├── __analysis__/               # 分析文档
├── assistant-message/          # 助手消息解析
├── auto-approval/              # 自动审批
├── checkpoints/                # 检查点管理
├── config/                     # 配置管理
├── context/                    # 上下文管理（已合并 context-management + condense）
├── context-management/         # 上下文管理（已废弃，迁移到 context/）
├── condense/                   # 对话压缩（已废弃，迁移到 context/）
├── context-tracking/           # 文件上下文跟踪（已废弃，迁移到 file-tracking/）
├── file-tracking/              # 文件上下文跟踪（新）
├── diff/                       # 差异管理
├── environment/                # 环境管理
├── ignore/                     # 忽略规则
├── mentions/                   # 提及处理
├── prompts/                    # 提示词管理
├── protect/                    # 保护规则
├── providers/                  # 提供者管理
├── state/                      # 状态管理
├── task/                       # 任务管理（核心）
├── task-persistence/           # 任务持久化
├── tools/                      # 工具管理
└── webview/                    # Web视图
```

### 1.2 主要问题

#### 问题1：模块职责划分过细
- ~~`context-management` 和 `condense` 职责重叠，紧密耦合~~ ✅ 已合并到 `context/`
- ~~`context-tracking` 命名容易与 `context-management` 混淆~~ ✅ 已重命名为 `file-tracking/`

#### 问题2：单个文件过大
- [`Task.ts`](src/core/task/Task.ts:1) (1319行)：包含过多职责
- ~~[`condense/index.ts`](src/core/condense/index.ts:1) (465行)：功能混杂~~ ✅ 已拆分到 `context/summarization.ts`
- ~~[`context-management/index.ts`](src/core/context-management/index.ts:1) (361行)：功能混杂~~ ✅ 已拆分到 `context/` 目录
- [`checkpoints/index.ts`](src/core/checkpoints/index.ts:1) (385行)：功能混杂

#### 问题3：目录结构不够清晰
- `task/` 目录下文件过多，缺乏分类
- `tools/` 目录下24个工具文件平铺，缺乏分类
- `prompts/` 目录结构复杂但合理

## 二、重构建议

### 2.1 模块合并建议

#### ✅ 建议1：合并 context-management 和 condense（已完成）

**理由：**
- [`context-management/index.ts`](src/core/context-management/index.ts:5) 已经依赖 `condense` 模块
- 两者都负责对话上下文管理，职责高度重叠
- `condense` 是 `context-management` 的子功能

**合并后结构：**
```
context/                        # 统一的上下文管理
├── index.ts                    # 主入口，导出所有公共API
├── token-utils.ts              # Token估算工具
│   ├── estimateTokenCount()
│   └── 相关常量
├── truncation.ts               # 截断逻辑
│   ├── truncateConversation()
│   └── TruncationResult类型
├── summarization.ts            # 压缩逻辑（原 condense/index.ts）
│   ├── summarizeConversation()
│   ├── getKeepMessagesWithToolBlocks()
│   ├── getMessagesSinceLastSummary()
│   ├── getEffectiveApiHistory()
│   └── cleanupAfterTruncation()
├── context-manager.ts          # 上下文管理主逻辑
│   ├── manageContext()
│   ├── willManageContext()
│   └── ContextManagementOptions类型
├── context-error-handling.ts   # 错误处理
│   └── checkContextWindowExceededError()
└── __tests__/
    ├── context-manager.spec.ts
    └── ...
```

**迁移路径：**
1. ✅ 创建 `context/` 目录
2. ✅ 将 `condense/index.ts` 重命名为 `context/summarization.ts`
3. ✅ 将 `context-management/index.ts` 中的函数拆分到对应文件
4. ✅ 更新所有导入路径
5. ⏳ 删除旧的 `condense/` 和 `context-management/` 目录（待测试通过后）

#### ✅ 建议2：重命名 context-tracking 为 file-tracking（已完成）

**理由：**
- `context-tracking` 容易与 `context-management` 混淆
- 该模块实际职责是跟踪文件操作，而非对话上下文
- 更清晰的命名有助于理解模块职责

**重命名后结构：**
```
file-tracking/                  # 文件上下文跟踪
├── FileContextTracker.ts       # 主类
├── FileContextTrackerTypes.ts  # 类型定义
└── __tests__/
```

**迁移路径：**
1. ✅ 创建 `file-tracking/` 目录
2. ✅ 移动文件到新位置
3. ✅ 更新所有导入路径
4. ⏳ 删除旧的 `context-tracking/` 目录（待测试通过后）

### 2.2 文件拆分建议

#### 建议1：拆分 Task.ts

**当前问题：**
- 1319行代码，包含过多职责
- 虽然使用了 Manager 模式，但主类仍然庞大

**拆分方案：**
```
task/
├── Task.ts                     # 主类（精简到300-400行）
│   ├── 构造函数
│   ├── 公共接口方法
│   └── Manager getter方法
├── TaskContainer.ts            # 依赖注入容器（保持不变）
├── TaskEventBus.ts             # 事件总线（保持不变）
├── TaskDelegationCoordinator.ts # 委托协调器（保持不变）
├── TaskManager.ts              # 任务管理器（保持不变）
├── properties/                 # 属性定义（新增）
│   ├── index.ts                # 导出所有属性
│   ├── state.ts                # 状态相关属性
│   ├── api.ts                  # API相关属性
│   ├── editing.ts              # 编辑相关属性
│   ├── checkpoints.ts          # 检查点相关属性
│   └── interaction.ts          # 交互相关属性
├── initialization/             # 初始化逻辑（新增）
│   ├── index.ts                # 导出初始化函数
│   ├── managers.ts             # Manager初始化
│   ├── components.ts           # 组件初始化
│   └── setup.ts                # 设置逻辑
├── public-api/                 # 公共API（新增）
│   ├── index.ts                # 导出所有公共方法
│   ├── lifecycle.ts            # 生命周期方法
│   ├── interaction.ts          # 交互方法
│   ├── checkpoints.ts          # 检查点方法
│   ├── context.ts              # 上下文方法
│   └── subtask.ts              # 子任务方法
└── managers/                   # 管理器（保持现有结构）
```

**拆分原则：**
- `Task.ts` 只保留核心结构和公共接口
- 属性定义移到 `properties/` 目录
- 初始化逻辑移到 `initialization/` 目录
- 公共方法按功能分类到 `public-api/` 目录

#### 建议2：拆分 context/ 目录文件

**拆分方案：**
```
context/
├── index.ts                    # 主入口（~100行）
├── token-utils.ts              # Token估算（~50行）
├── truncation.ts               # 截断逻辑（~100行）
├── summarization.ts            # 压缩逻辑（~300行）
├── context-manager.ts          # 上下文管理（~150行）
└── types.ts                    # 类型定义（~50行）
```

#### 建议3：拆分 checkpoints/ 目录文件

**拆分方案：**
```
checkpoints/
├── index.ts                    # 主入口（~50行）
├── service.ts                  # 服务初始化（~150行）
│   ├── getCheckpointService()
│   ├── checkGitInstallation()
│   └── sendCheckpointInitWarn()
├── operations.ts               # 操作逻辑（~200行）
│   ├── checkpointSave()
│   ├── checkpointRestore()
│   └── checkpointDiff()
├── types.ts                    # 类型定义（~50行）
│   ├── CheckpointRestoreOptions
│   └── CheckpointDiffOptions
└── __tests__/
```

### 2.3 目录结构优化建议

#### 建议1：优化 tools/ 目录结构

**当前问题：**
- 24个工具文件平铺在 `tools/` 目录下
- 缺乏分类，难以查找和维护

**优化后结构：**
```
tools/
├── index.ts                    # 导出所有工具
├── base/                       # 基础工具
│   ├── BaseTool.ts
│   └── validateToolUse.ts
├── file-operations/            # 文件操作工具
│   ├── ReadFileTool.ts
│   ├── WriteToFileTool.ts
│   ├── EditFileTool.ts
│   ├── ApplyDiffTool.ts
│   ├── MultiApplyDiffTool.ts
│   ├── SearchReplaceTool.ts
│   └── simpleReadFileTool.ts
├── search/                     # 搜索工具
│   ├── SearchFilesTool.ts
│   ├── CodebaseSearchTool.ts
│   └── ListFilesTool.ts
├── execution/                  # 执行工具
│   ├── ExecuteCommandTool.ts
│   └── RunSlashCommandTool.ts
├── task/                       # 任务工具
│   ├── NewTaskTool.ts
│   ├── UpdateTodoListTool.ts
│   ├── AttemptCompletionTool.ts
│   └── AskFollowupQuestionTool.ts
├── system/                     # 系统工具
│   ├── GetWorkspaceDiagnosticsTool.ts
│   ├── FetchInstructionsTool.ts
│   └── SwitchModeTool.ts
├── browser/                    # 浏览器工具
│   └── BrowserActionTool.ts
├── helpers/                    # 辅助工具
│   ├── fileTokenBudget.ts
│   ├── imageHelpers.ts
│   ├── toolResultFormatting.ts
│   └── truncateDefinitions.ts
├── utils/                      # 工具类
│   └── ToolRepetitionDetector.ts
└── __tests__/
```

#### 建议2：优化 task/ 目录结构

**优化后结构：**
```
task/
├── Task.ts                     # 主类（精简后）
├── TaskContainer.ts            # 依赖注入容器
├── TaskEventBus.ts             # 事件总线
├── TaskDelegationCoordinator.ts # 委托协调器
├── TaskManager.ts              # 任务管理器
├── properties/                 # 属性定义
│   ├── index.ts
│   ├── state.ts
│   ├── api.ts
│   ├── editing.ts
│   ├── checkpoints.ts
│   └── interaction.ts
├── initialization/             # 初始化逻辑
│   ├── index.ts
│   ├── managers.ts
│   ├── components.ts
│   └── setup.ts
├── public-api/                 # 公共API
│   ├── index.ts
│   ├── lifecycle.ts
│   ├── interaction.ts
│   ├── checkpoints.ts
│   ├── context.ts
│   └── subtask.ts
├── managers/                   # 管理器
│   ├── index.ts
│   ├── core/
│   │   ├── IndexManager.ts
│   │   └── ...
│   ├── TaskStateManager.ts
│   ├── TaskMessageManager.ts
│   ├── ApiRequestManager.ts
│   └── ...
├── utils/                      # 工具函数
│   ├── validateToolResultIds.ts
│   └── build-tools.ts
└── __tests__/
```

## 三、重构优先级

### ✅ 高优先级（已完成）
1. **合并 context-management 和 condense**
   - 影响：高
   - 复杂度：中
   - 收益：显著提升代码组织性
   - 状态：✅ 已完成
   - 测试：✅ 37个测试全部通过

2. **重命名 context-tracking 为 file-tracking**
   - 影响：中
   - 复杂度：低
   - 收益：提升代码可读性
   - 状态：✅ 已完成
   - 测试：⏳ 待验证

### 中优先级（近期执行）
3. **拆分 Task.ts**
   - 影响：高
   - 复杂度：高
   - 收益：显著提升可维护性
   - 状态：⏳ 待执行

4. **优化 tools/ 目录结构**
   - 影响：中
   - 复杂度：中
   - 收益：提升代码可维护性
   - 状态：⏳ 待执行

### 低优先级（长期优化）
5. **拆分 context/ 目录文件**
   - 影响：中
   - 复杂度：低
   - 收益：提升代码可读性
   - 状态：✅ 已完成（合并时已拆分）

6. **拆分 checkpoints/ 目录文件**
   - 影响：低
   - 复杂度：低
   - 收益：提升代码可读性
   - 状态：⏳ 待执行

7. **优化 task/ 目录结构**
   - 影响：中
   - 复杂度：高
   - 收益：提升代码组织性
   - 状态：⏳ 待执行

## 四、实施建议

### 4.1 重构原则
1. **渐进式重构**：不要一次性重构所有模块
2. **保持向后兼容**：使用导出别名确保旧导入路径仍然有效
3. **充分测试**：每次重构后运行完整测试套件
4. **文档更新**：同步更新相关文档和注释

### 4.2 实施步骤
1. 创建新的目录结构
2. 迁移文件到新位置
3. 更新导入路径
4. 运行测试确保功能正常
5. 删除旧目录
6. 更新文档

### 4.3 风险控制
1. 使用 Git 分支进行重构
2. 每次重构后提交代码
3. 保持测试覆盖率
4. 代码审查确保质量

## 五、预期收益

### 5.1 代码质量提升
- 更清晰的模块职责划分
- 更小的文件，更易维护
- 更好的代码组织性

### 5.2 开发效率提升
- 更快的代码定位
- 更容易理解代码结构
- 更低的认知负担

### 5.3 可维护性提升
- 更容易添加新功能
- 更容易修复bug
- 更容易进行代码审查

## 六、总结

当前 `src/core` 目录存在模块划分过细、文件过大、目录结构不够清晰等问题。通过合并相关模块、拆分大文件、优化目录结构，可以显著提升代码质量和开发效率。

### 已完成的重构

1. ✅ **合并 context-management 和 condense**
   - 创建了统一的 `context/` 模块
   - 将功能拆分为 6 个文件：`index.ts`, `token-utils.ts`, `truncation.ts`, `summarization.ts`, `context-manager.ts`, `context-error-handling.ts`
   - 所有 37 个测试全部通过
   - 更新了所有导入路径

2. ✅ **重命名 context-tracking 为 file-tracking**
   - 创建了 `file-tracking/` 目录
   - 移动了 `FileContextTracker.ts` 和 `FileContextTrackerTypes.ts`
   - 更新了所有导入路径

### 待完成的重构

1. ⏳ 删除旧的 `condense/` 和 `context-management/` 目录
2. ⏳ 删除旧的 `context-tracking/` 目录
3. ⏳ 拆分 Task.ts
4. ⏳ 优化 tools/ 目录结构
5. ⏳ 拆分 checkpoints/ 目录文件
6. ⏳ 优化 task/ 目录结构

建议优先执行高优先级任务，然后逐步完成中低优先级任务。重构过程中要遵循渐进式原则，确保每次重构后代码仍然可用。