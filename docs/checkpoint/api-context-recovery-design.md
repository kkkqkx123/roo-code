# API调用上下文恢复机制设计

## 问题描述

当前检查点机制在恢复时只能恢复到API调用后的状态，无法恢复到API调用前的上下文状态。这导致：
- 无法重新执行失败的API调用
- 无法修改API调用参数后重试
- 上下文状态丢失，影响后续对话连续性

## 解决方案概述

### 1. API调用状态快照
在每次API调用前，保存完整的上下文状态快照：
- 当前系统提示
- 对话历史消息
- API配置参数
- 任务状态
- 文件上下文跟踪状态

### 2. 检查点保存时机调整
将检查点保存时机从API响应后调整为API调用前，确保恢复时能回到调用前的状态。

### 3. 上下文恢复机制
在检查点恢复时，不仅恢复文件系统状态，还要恢复API调用上下文状态。

## 详细设计

### API调用上下文快照接口

```typescript
interface ApiCallContextSnapshot {
  timestamp: number
  systemPrompt: string
  conversationHistory: Anthropic.Messages.MessageParam[]
  apiConfiguration: ProviderSettings
  taskState: TaskState
  fileContextState: FileContextState
  apiCallParameters: {
    userContent: any[]
    includeFileDetails: boolean
    retryAttempt?: number
  }
}
```

### 检查点管理器扩展

扩展`CheckpointManager`类，增加API上下文管理功能：

```typescript
export class CheckpointManager {
  // 现有属性...
  private apiContextSnapshots: Map<string, ApiCallContextSnapshot> = new Map()
  
  // 新方法：保存API调用上下文快照
  async saveApiContextSnapshot(apiRequestId: string, snapshot: ApiCallContextSnapshot): Promise<void>
  
  // 新方法：获取API调用上下文快照
  async getApiContextSnapshot(apiRequestId: string): Promise<ApiCallContextSnapshot | undefined>
  
  // 新方法：恢复API调用上下文
  async restoreApiContext(snapshot: ApiCallContextSnapshot): Promise<void>
}
```

### API请求管理器集成

修改`ApiRequestManager`，在API调用前保存上下文快照：

```typescript
export class ApiRequestManager {
  // 在API调用前保存上下文快照
  private async saveApiContextBeforeCall(userContent: any[], includeFileDetails: boolean): Promise<string>
  
  // 修改检查点保存逻辑，在API调用前保存
  private async processStream(currentItem: any, stack: any[]): Promise<void> {
    // 在API调用前保存检查点和上下文快照
    const apiRequestId = await this.saveApiContextBeforeCall(
      currentItem.userContent, 
      currentItem.includeFileDetails
    )
    
    // 然后执行API调用...
  }
}
```

### 检查点恢复流程改进

修改`checkpointRestore`函数，支持上下文恢复：

```typescript
export async function checkpointRestore(
  task: Task,
  options: CheckpointRestoreOptions & { restoreApiContext?: boolean }
) {
  // 现有文件系统恢复逻辑...
  
  // 新增API上下文恢复逻辑
  if (options.restoreApiContext) {
    const snapshot = await task.checkpointManager?.getApiContextSnapshot(apiRequestId)
    if (snapshot) {
      await task.checkpointManager?.restoreApiContext(snapshot)
    }
  }
}
```

## 实现步骤

1. **定义API上下文快照接口** - 创建类型定义和数据结构
2. **扩展检查点管理器** - 添加上下文快照管理功能
3. **修改API请求管理器** - 集成上下文保存逻辑
4. **改进检查点恢复流程** - 支持上下文状态恢复
5. **更新用户界面** - 提供上下文恢复选项
6. **添加测试用例** - 确保功能正确性

## 预期效果

- 检查点恢复后可以重新执行API调用
- 支持修改API参数后重试
- 保持对话上下文的连续性
- 提高错误恢复的灵活性