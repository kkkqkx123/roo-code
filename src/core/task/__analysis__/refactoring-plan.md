# Task.ts 重构计划

## 目标
将Task.ts中的职责拆分到各个管理器中，使Task类只负责协调各个管理器之间的交互。

## 当前状态
- Task.ts: 1537行
- 已有管理器：TaskStateManager, ApiRequestManager, TaskMessageManager, ToolExecutor, UserInteractionManager, FileEditorManager, CheckpointManager, ContextManager, UsageTracker
- 新增管理器：ConfigurationManager, SubtaskManager, TaskLifecycleManager

## 重构步骤

### 阶段1：添加新的管理器到Task类
1. 在Task类中添加ConfigurationManager实例
2. 在Task类中添加SubtaskManager实例
3. 在Task类中添加TaskLifecycleManager实例
4. 在构造函数中初始化这些管理器

### 阶段2：将配置管理相关方法委托给ConfigurationManager
1. `updateApiConfiguration()` -> ConfigurationManager.updateApiConfiguration()
2. `setupProviderProfileChangeListener()` -> ConfigurationManager.setupProviderProfileChangeListener()
3. `getCurrentProfileId()` -> ConfigurationManager.getCurrentProfileId()

### 阶段3：将子任务管理相关方法委托给SubtaskManager
1. `startSubtask()` -> SubtaskManager.startSubtask()
2. `resumeAfterDelegation()` -> SubtaskManager.resumeAfterDelegation()
3. 移除childTaskId和pendingNewTaskToolCallId的直接访问，通过SubtaskManager访问

### 阶段4：将任务生命周期管理相关方法委托给TaskLifecycleManager
1. `startTask()` -> TaskLifecycleManager.startTask()
2. `resumeTaskFromHistory()` -> TaskLifecycleManager.resumeTaskFromHistory()
3. `initiateTaskLoop()` -> TaskLifecycleManager.initiateTaskLoop()
4. `abortTask()` -> TaskLifecycleManager.abortTask()
5. `dispose()` -> TaskLifecycleManager.dispose()

### 阶段5：将上下文管理相关方法委托给ContextManager
1. `condenseContext()` -> 需要创建新的ContextManager方法
2. `handleContextWindowExceededError()` -> 需要创建新的ContextManager方法
3. `buildCleanConversationHistory()` -> 需要创建新的ContextManager方法
4. `getSystemPrompt()` -> 需要创建新的ContextManager方法

### 阶段6：清理和优化
1. 移除不再需要的属性
2. 简化Task类的职责
3. 确保所有管理器正确初始化和释放

## 注意事项
1. 保持向后兼容性
2. 确保所有测试通过
3. 逐步重构，避免一次性大规模改动
4. 每个阶段完成后运行类型检查和lint

## 预期结果
- Task类的职责更加清晰
- 代码更易于维护和测试
- 管理器之间的耦合度降低
- 提高代码的可扩展性
