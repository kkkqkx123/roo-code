# Core 模块重构 - 第一阶段详细计划

## Task.ts 拆分详细方案

### 当前问题分析

Task.ts 文件包含以下混合职责：
- 任务生命周期管理
- 状态管理
- 工具执行协调
- 消息处理
- 上下文管理
- API 调用管理
- 错误处理

### 拆分策略

#### 1. 提取 TaskState 模块

**负责内容：**
- 任务状态管理
- 状态转换逻辑
- 状态持久化
- 状态订阅通知

**提取方法：**
```typescript
// TaskState.ts
export class TaskState {
  private currentStatus: TaskStatus
  private stateHistory: StateChange[]
  private subscribers: StateSubscriber[]
  
  constructor(initialState: TaskStatus) {
    this.currentStatus = initialState
    this.stateHistory = []
    this.subscribers = []
  }
  
  transitionTo(newStatus: TaskStatus, reason?: string): void {
    // 状态转换逻辑
  }
  
  subscribe(subscriber: StateSubscriber): void {
    // 状态订阅
  }
  
  getCurrent(): TaskStatus {
    return this.currentStatus
  }
  
  getHistory(): StateChange[] {
    return [...this.stateHistory]
  }
}
```

**迁移步骤：**
1. 识别所有状态相关代码（搜索 `TaskStatus`、`this.status`、`setStatus`）
2. 创建 TaskState 类
3. 逐步移动状态管理逻辑
4. 在 Task.ts 中创建 TaskState 实例
5. 更新所有状态访问代码

**预计时间：** 2-3 天

#### 2. 提取 TaskExecutor 模块

**负责内容：**
- 工具调用执行
- 工具结果处理
- 工具重试逻辑
- 工具超时管理

**提取方法：**
```typescript
// TaskExecutor.ts
export class TaskExecutor {
  private toolRegistry: ToolRegistry
  private executionQueue: ExecutionQueue
  private retryPolicy: RetryPolicy
  
  constructor(options: ExecutorOptions) {
    this.toolRegistry = options.toolRegistry
    this.executionQueue = new ExecutionQueue()
    this.retryPolicy = options.retryPolicy
  }
  
  async executeTool(toolName: string, params: ToolParams): Promise<ToolResult> {
    // 工具执行逻辑
  }
  
  async executeMultiple(tools: ToolCall[]): Promise<ToolResult[]> {
    // 批量执行
  }
  
  handleToolError(error: ToolError): Promise<ToolResult> {
    // 错误处理
  }
}
```

**迁移步骤：**
1. 识别所有工具执行相关代码（搜索 `execute.*tool`、`tool.*result`）
2. 创建 TaskExecutor 类
3. 移动工具执行逻辑
4. 处理工具结果回调
5. 更新错误处理逻辑

**预计时间：** 3-4 天

#### 3. 提取 TaskContext 模块

**负责内容：**
- 文件上下文追踪
- 环境信息管理
- 工作目录管理
- 资源清理

**提取方法：**
```typescript
// TaskContext.ts
export class TaskContext {
  private fileTracker: FileContextTracker
  private environment: EnvironmentInfo
  private workingDirectory: string
  
  constructor(cwd: string) {
    this.workingDirectory = cwd
    this.fileTracker = new FileContextTracker()
    this.environment = new EnvironmentInfo()
  }
  
  trackFile(filePath: string): void {
    // 文件追踪
  }
  
  getContextFiles(): TrackedFile[] {
    return this.fileTracker.getFiles()
  }
  
  updateEnvironment(info: EnvironmentInfo): void {
    this.environment = { ...this.environment, ...info }
  }
  
  cleanup(): void {
    // 资源清理
  }
}
```

**迁移步骤：**
1. 识别所有上下文相关代码（搜索 `FileContextTracker`、`environment`、`cwd`）
2. 创建 TaskContext 类
3. 移动文件追踪逻辑
4. 处理环境信息更新
5. 确保资源正确清理

**预计时间：** 2-3 天

#### 4. 提取 TaskMessage 模块

**负责内容：**
- 消息解析和格式化
- 消息历史管理
- 消息验证
- 消息导出

**提取方法：**
```typescript
// TaskMessage.ts
export class TaskMessage {
  private messageHistory: ClineMessage[]
  private messageParser: MessageParser
  private messageValidator: MessageValidator
  
  constructor() {
    this.messageHistory = []
    this.messageParser = new MessageParser()
    this.messageValidator = new MessageValidator()
  }
  
  addMessage(message: ClineMessage): void {
    if (this.messageValidator.validate(message)) {
      this.messageHistory.push(message)
    }
  }
  
  getHistory(): ClineMessage[] {
    return [...this.messageHistory]
  }
  
  formatForExport(): ExportableMessage[] {
    // 消息格式化导出
  }
}
```

**迁移步骤：**
1. 识别所有消息处理代码（搜索 `ClineMessage`、`addMessage`、`messageHistory`）
2. 创建 TaskMessage 类
3. 移动消息处理逻辑
4. 处理消息验证
5. 更新消息访问代码

**预计时间：** 2-3 天

### 重构执行计划

#### 第一周：TaskState 提取
- **Day 1**: 代码分析，识别状态相关逻辑
- **Day 2**: 创建 TaskState 类，编写基础结构
- **Day 3**: 迁移状态转换逻辑，更新单元测试
- **Day 4**: 集成测试，修复问题
- **Day 5**: 代码审查，文档更新

#### 第二周：TaskExecutor 提取
- **Day 1**: 分析工具执行逻辑
- **Day 2-3**: 创建 TaskExecutor，迁移核心逻辑
- **Day 4**: 处理工具结果和错误处理
- **Day 5**: 测试和修复

#### 第三周：TaskContext 提取
- **Day 1**: 分析上下文管理逻辑
- **Day 2**: 创建 TaskContext 类
- **Day 3**: 迁移文件追踪逻辑
- **Day 4**: 环境信息管理
- **Day 5**: 测试和集成

#### 第四周：TaskMessage 提取
- **Day 1**: 分析消息处理逻辑
- **Day 2**: 创建 TaskMessage 类
- **Day 3**: 迁移消息处理逻辑
- **Day 4**: 消息验证和导出
- **Day 5**: 最终测试和文档

### 测试策略

#### 单元测试
- 每个新模块都需要完整的单元测试
- 测试覆盖率 > 90%
- 边界条件和错误处理必须覆盖

#### 集成测试
- 确保 Task.ts 与其他模块的集成正常
- 验证原有功能不受影响
- 性能测试确保没有退化

#### 回归测试
- 所有现有测试必须通过
- 手动测试关键功能路径
- 用户场景验证

### 风险缓解

#### 技术风险
1. **代码依赖复杂**
   - 措施：详细分析依赖关系，制定迁移顺序
   
2. **状态同步问题**
   - 措施：建立清晰的状态同步机制
   
3. **性能影响**
   - 措施：性能基准测试，确保不下降

#### 进度风险
1. **复杂度低估**
   - 措施：预留 30% 时间缓冲
   
2. **集成问题**
   - 措施：频繁的集成测试

### 验收标准

#### 代码质量
- [ ] Task.ts < 500 行
- [ ] 每个新模块 < 400 行
- [ ] 代码复杂度降低 40%
- [ ] 重复代码消除

#### 功能正确性
- [ ] 所有现有功能正常工作
- [ ] 所有测试通过
- [ ] 性能不下降
- [ ] 内存使用不增加

#### 可维护性
- [ ] 代码可读性提升
- [ ] 模块职责清晰
- [ ] 新增功能更容易
- [ ] 调试更简单

### 后续工作

完成 Task.ts 拆分后，可以继续：
1. 工具系统重构
2. ClineProvider 简化
3. 配置管理统一
4. 性能优化

## 总结

Task.ts 拆分是重构的关键第一步，成功完成后将为后续重构奠定良好基础。通过详细的计划和风险控制，可以确保重构过程平稳进行，最终达到提升代码质量和可维护性的目标。