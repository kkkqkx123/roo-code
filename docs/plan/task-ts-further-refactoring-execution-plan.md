# Task.ts 进一步拆分执行方案

## 概述

本文档提供了Task.ts进一步拆分的详细分阶段执行方案。基于职责分析，我们将创建7个新的Manager类，并将相关功能从Task.ts迁移到这些Manager中。

## 拆分优先级

| 阶段 | Manager名称 | 复杂度 | 影响范围 | 预计时间 |
|------|-------------|--------|----------|----------|
| 阶段1 | StreamingManager | 高 | 大 | 2-3天 |
| 阶段2 | PromptManager | 中 | 中 | 1-2天 |
| 阶段3 | MessageQueueManager | 中 | 中 | 1-2天 |
| 阶段4 | BrowserSessionManager | 低 | 小 | 0.5-1天 |
| 阶段5 | ConversationHistoryManager | 中 | 中 | 1天 |
| 阶段6 | TokenEstimator | 低 | 小 | 0.5天 |
| 阶段7 | TerminalManager | 低 | 小 | 0.5天 |

**总计预计时间**: 7-10天

---

## 阶段1: StreamingManager（流式处理管理器）

### 目标
将所有流式处理相关的状态和逻辑从Task.ts迁移到独立的StreamingManager。

### 要迁移的属性（Task.ts:351-368）

```typescript
isWaitingForFirstChunk = false
isStreaming = false
currentStreamingContentIndex = 0
currentStreamingDidCheckpoint = false
assistantMessageContent: AssistantMessageContent[] = []
presentAssistantMessageLocked = false
presentAssistantMessageHasPendingUpdates = false
userMessageContent: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolResultBlockParam)[] = []
userMessageContentReady = false
didRejectTool = false
didAlreadyUseTool = false
didToolFailInCurrentTurn = false
didCompleteReadingStream = false
assistantMessageParser?: AssistantMessageParser
private streamingToolCallIndices: Map<string, number> = new Map()
cachedStreamingModel?: { id: string; info: ModelInfo }
```

### 要迁移的方法

需要从Task.ts和ApiRequestManager中识别所有使用这些属性的方法，包括但不限于：
- 流式内容处理方法
- 流式工具调用处理方法
- 流式状态更新方法
- 流式检查点处理方法

### 执行步骤

#### 1.1 创建StreamingManager类

**文件**: `src/core/task/managers/StreamingManager.ts`

```typescript
export interface StreamingManagerOptions {
    taskId: string
    onStreamingStateChange?: (state: StreamingState) => void
    onStreamingContentUpdate?: (content: AssistantMessageContent[]) => void
}

export class StreamingManager {
    // 所有流式处理相关的属性
    // 所有流式处理相关的方法
}
```

#### 1.2 实现核心功能

1. **流式状态管理**
   - `startStreaming()`
   - `stopStreaming()`
   - `isStreaming()`
   - `getStreamingState()`

2. **流式内容处理**
   - `appendAssistantContent(content: AssistantMessageContent)`
   - `getUserMessageContent()`
   - `getAssistantMessageContent()`
   - `clearStreamingContent()`

3. **流式工具调用处理**
   - `startToolCall(toolId: string)`
   - `updateToolCallIndex(toolId: string, index: number)`
   - `getToolCallIndex(toolId: string)`

4. **流式检查点处理**
   - `setStreamingDidCheckpoint(value: boolean)`
   - `getStreamingDidCheckpoint()`

5. **流式模型缓存**
   - `setCachedStreamingModel(model: { id: string; info: ModelInfo })`
   - `getCachedStreamingModel()`

#### 1.3 更新Task.ts

1. 创建StreamingManager实例
2. 替换所有直接访问流式属性的地方为通过StreamingManager访问
3. 更新构造函数
4. 更新相关方法

#### 1.4 更新ApiRequestManager

1. 注入StreamingManager
2. 更新所有使用流式属性的地方
3. 确保流式逻辑通过StreamingManager协调

#### 1.5 编写测试

**测试文件**: `src/core/task/managers/__tests__/StreamingManager.test.ts`

测试覆盖：
- 流式状态管理
- 流式内容处理
- 流式工具调用处理
- 流式检查点处理
- 流式模型缓存
- 边界情况和错误处理

#### 1.6 运行测试

```bash
cd "d:\项目\agent\Roo-Code\src" && pnpm test --run --dir core/task/managers/__tests__/StreamingManager.test.ts
```

#### 1.7 验证标准

- [ ] 所有流式相关属性已迁移到StreamingManager
- [ ] 所有流式相关方法已迁移到StreamingManager
- [ ] Task.ts不再直接访问流式属性
- [ ] ApiRequestManager通过StreamingManager访问流式功能
- [ ] 所有测试通过
- [ ] 无TypeScript错误
- [ ] 无ESLint错误

---

## 阶段2: PromptManager（提示词管理器）

### 目标
将系统提示词生成逻辑从Task.ts迁移到独立的PromptManager。

### 要迁移的方法（Task.ts:1003-1078）

```typescript
private async getSystemPrompt(): Promise<string>
```

### 执行步骤

#### 2.1 创建PromptManager类

**文件**: `src/core/task/managers/PromptManager.ts`

```typescript
export interface PromptManagerOptions {
    providerRef: WeakRef<ClineProvider>
    taskId: string
    workspacePath: string
    diffStrategy?: DiffStrategy
    rooIgnoreController?: RooIgnoreController
}

export class PromptManager {
    // 提示词生成相关的方法
}
```

#### 2.2 实现核心功能

1. **系统提示词生成**
   - `getSystemPrompt(): Promise<string>`
   - `getSystemPromptWithMcp(mcpHub: McpHub): Promise<string>`

2. **自定义提示词处理**
   - `applyCustomPrompt(basePrompt: string, customPrompt: string): string`

3. **提示词模板管理**
   - `getPromptTemplate(mode: string): string`

#### 2.3 更新Task.ts

1. 创建PromptManager实例
2. 替换所有调用`getSystemPrompt()`的地方为通过PromptManager调用
3. 更新构造函数
4. 更新相关方法

#### 2.4 更新ApiRequestManager

1. 注入PromptManager
2. 更新所有需要系统提示词的地方
3. 确保提示词生成通过PromptManager协调

#### 2.5 编写测试

**测试文件**: `src/core/task/managers/__tests__/PromptManager.test.ts`

测试覆盖：
- 系统提示词生成
- MCP提示词生成
- 自定义提示词处理
- 提示词模板管理
- 不同模式的提示词生成
- 边界情况和错误处理

#### 2.6 运行测试

```bash
cd "d:\项目\agent\Roo-Code\src" && pnpm test --run --dir core/task/managers/__tests__/PromptManager.test.ts
```

#### 2.7 验证标准

- [ ] `getSystemPrompt()`方法已迁移到PromptManager
- [ ] Task.ts通过PromptManager获取系统提示词
- [ ] ApiRequestManager通过PromptManager获取系统提示词
- [ ] 所有测试通过
- [ ] 无TypeScript错误
- [ ] 无ESLint错误

---

## 阶段3: MessageQueueManager（消息队列管理器）

### 目标
将消息队列处理逻辑从Task.ts迁移到独立的MessageQueueManager。

### 要迁移的方法（Task.ts:923-986）

```typescript
public async submitUserMessage(
    text: string,
    images: string[] = [],
    mode?: string,
    providerProfile?: string,
): Promise<void>

public async processQueuedMessages(): Promise<void>
```

### 执行步骤

#### 3.1 创建MessageQueueManager类

**文件**: `src/core/task/managers/MessageQueueManager.ts`

```typescript
export interface MessageQueueManagerOptions {
    taskId: string
    providerRef: WeakRef<ClineProvider>
    messageQueueService: MessageQueueService
    onUserMessage?: (taskId: string) => void
}

export class MessageQueueManager {
    // 消息队列处理相关的方法
}
```

#### 3.2 实现核心功能

1. **用户消息提交**
   - `submitUserMessage(text: string, images: string[], mode?: string, providerProfile?: string): Promise<void>`
   - `validateUserMessage(text: string, images: string[]): boolean`

2. **消息队列处理**
   - `processQueuedMessages(): Promise<void>`
   - `hasQueuedMessages(): boolean`
   - `getQueuedMessageCount(): number`

3. **模式切换**
   - `switchMode(mode: string): Promise<void>`
   - `switchProviderProfile(profileId: string): Promise<void>`

#### 3.3 更新Task.ts

1. 创建MessageQueueManager实例
2. 替换所有调用`submitUserMessage()`和`processQueuedMessages()`的地方
3. 更新构造函数
4. 更新相关方法

#### 3.4 编写测试

**测试文件**: `src/core/task/managers/__tests__/MessageQueueManager.test.ts`

测试覆盖：
- 用户消息提交
- 消息验证
- 消息队列处理
- 模式切换
- 提供者配置切换
- 边界情况和错误处理

#### 3.5 运行测试

```bash
cd "d:\项目\agent\Roo-Code\src" && pnpm test --run --dir core/task/managers/__tests__/MessageQueueManager.test.ts
```

#### 3.6 验证标准

- [ ] `submitUserMessage()`方法已迁移到MessageQueueManager
- [ ] `processQueuedMessages()`方法已迁移到MessageQueueManager
- [ ] Task.ts通过MessageQueueManager处理消息队列
- [ ] 所有测试通过
- [ ] 无TypeScript错误
- [ ] 无ESLint错误

---

## 阶段4: BrowserSessionManager（浏览器会话管理器）

### 目标
将浏览器会话管理逻辑从Task.ts迁移到独立的BrowserSessionManager。

### 要迁移的属性和方法（Task.ts:274-292, 1278-1287）

```typescript
browserSession: BrowserSession

private broadcastBrowserSessionUpdate(): void
```

### 执行步骤

#### 4.1 创建BrowserSessionManager类

**文件**: `src/core/task/managers/BrowserSessionManager.ts`

```typescript
export interface BrowserSessionManagerOptions {
    taskId: string
    providerRef: WeakRef<ClineProvider>
    onSessionStatusChange?: (isActive: boolean) => void
}

export class BrowserSessionManager {
    // 浏览器会话管理相关的方法
}
```

#### 4.2 实现核心功能

1. **浏览器会话管理**
   - `initializeBrowserSession(): void`
   - `getBrowserSession(): BrowserSession`
   - `isSessionActive(): boolean`

2. **会话状态广播**
   - `broadcastSessionUpdate(): void`

3. **会话面板管理**
   - `showBrowserSessionPanel(): Promise<void>`

#### 4.3 更新Task.ts

1. 创建BrowserSessionManager实例
2. 替换所有直接访问`browserSession`的地方
3. 替换所有调用`broadcastBrowserSessionUpdate()`的地方
4. 更新构造函数
5. 更新相关方法

#### 4.4 编写测试

**测试文件**: `src/core/task/managers/__tests__/BrowserSessionManager.test.ts`

测试覆盖：
- 浏览器会话初始化
- 会话状态管理
- 会话状态广播
- 会话面板显示
- 边界情况和错误处理

#### 4.5 运行测试

```bash
cd "d:\项目\agent\Roo-Code\src" && pnpm test --run --dir core/task/managers/__tests__/BrowserSessionManager.test.ts
```

#### 4.6 验证标准

- [ ] `browserSession`属性已迁移到BrowserSessionManager
- [ ] `broadcastBrowserSessionUpdate()`方法已迁移到BrowserSessionManager
- [ ] Task.ts通过BrowserSessionManager管理浏览器会话
- [ ] 所有测试通过
- [ ] 无TypeScript错误
- [ ] 无ESLint错误

---

## 阶段5: ConversationHistoryManager（对话历史管理器）

### 目标
将对话历史管理逻辑从Task.ts迁移到独立的ConversationHistoryManager。

### 要迁移的方法（Task.ts:1191-1276）

```typescript
private buildCleanConversationHistory(
    messages: ApiMessage[],
): Array<
    Anthropic.Messages.MessageParam | { type: "reasoning"; encrypted_content: string; id?: string; summary?: any[] }
>
```

### 执行步骤

#### 5.1 创建ConversationHistoryManager类

**文件**: `src/core/task/managers/ConversationHistoryManager.ts`

```typescript
export interface ConversationHistoryManagerOptions {
    taskId: string
}

export class ConversationHistoryManager {
    // 对话历史管理相关的方法
}
```

#### 5.2 实现核心功能

1. **对话历史清理**
   - `buildCleanConversationHistory(messages: ApiMessage[]): Array<...>`
   - `cleanAssistantMessage(msg: ApiMessage): Anthropic.Messages.MessageParam | null`
   - `cleanReasoningMessage(msg: ApiMessage): ReasoningItemForRequest | null`

2. **对话历史验证**
   - `validateConversationHistory(messages: ApiMessage[]): boolean`

3. **对话历史转换**
   - `convertToApiMessages(messages: ApiMessage[]): Anthropic.Messages.MessageParam[]`

#### 5.3 更新Task.ts

1. 创建ConversationHistoryManager实例
2. 替换所有调用`buildCleanConversationHistory()`的地方
3. 更新构造函数
4. 更新相关方法

#### 5.4 更新ApiRequestManager

1. 注入ConversationHistoryManager
2. 更新所有需要清理对话历史的地方

#### 5.5 编写测试

**测试文件**: `src/core/task/managers/__tests__/ConversationHistoryManager.test.ts`

测试覆盖：
- 对话历史清理
- 助手消息清理
- 推理消息清理
- 对话历史验证
- 对话历史转换
- 边界情况和错误处理

#### 5.6 运行测试

```bash
cd "d:\项目\agent\Roo-Code\src" && pnpm test --run --dir core/task/managers/__tests__/ConversationHistoryManager.test.ts
```

#### 5.7 验证标准

- [ ] `buildCleanConversationHistory()`方法已迁移到ConversationHistoryManager
- [ ] Task.ts通过ConversationHistoryManager清理对话历史
- [ ] ApiRequestManager通过ConversationHistoryManager清理对话历史
- [ ] 所有测试通过
- [ ] 无TypeScript错误
- [ ] 无ESLint错误

---

## 阶段6: TokenEstimator（Token估算器）

### 目标
将Token估算逻辑从Task.ts迁移到独立的TokenEstimator。

### 要迁移的方法（Task.ts:1309-1330）

```typescript
private async estimateTokensWithTiktoken(): Promise<{ inputTokens: number; outputTokens: number } | null>
```

### 执行步骤

#### 6.1 创建TokenEstimator类

**文件**: `src/core/task/managers/TokenEstimator.ts`

```typescript
export interface TokenEstimatorOptions {
    apiHandler: ApiHandler
}

export class TokenEstimator {
    // Token估算相关的方法
}
```

#### 6.2 实现核心功能

1. **Token估算**
   - `estimateInputTokens(content: Anthropic.Messages.ContentBlockParam[]): Promise<number>`
   - `estimateOutputTokens(content: AssistantMessageContent[]): Promise<number>`
   - `estimateTotalTokens(inputContent: Anthropic.Messages.ContentBlockParam[], outputContent: AssistantMessageContent[]): Promise<{ inputTokens: number; outputTokens: number }>`

2. **Token验证**
   - `isValidTokenCount(count: number | undefined): boolean`

#### 6.3 更新Task.ts

1. 创建TokenEstimator实例
2. 替换所有调用`estimateTokensWithTiktoken()`的地方
3. 更新构造函数
4. 更新相关方法

#### 6.4 更新ApiRequestManager

1. 注入TokenEstimator
2. 更新所有需要估算Token的地方

#### 6.5 编写测试

**测试文件**: `src/core/task/managers/__tests__/TokenEstimator.test.ts`

测试覆盖：
- 输入Token估算
- 输出Token估算
- 总Token估算
- Token验证
- 边界情况和错误处理

#### 6.6 运行测试

```bash
cd "d:\项目\agent\Roo-Code\src" && pnpm test --run --dir core/task/managers/__tests__/TokenEstimator.test.ts
```

#### 6.7 验证标准

- [ ] `estimateTokensWithTiktoken()`方法已迁移到TokenEstimator
- [ ] Task.ts通过TokenEstimator估算Token
- [ ] ApiRequestManager通过TokenEstimator估算Token
- [ ] 所有测试通过
- [ ] 无TypeScript错误
- [ ] 无ESLint错误

---

## 阶段7: TerminalManager（终端管理器）

### 目标
将终端操作处理逻辑从Task.ts迁移到独立的TerminalManager。

### 要迁移的方法（Task.ts:970-977）

```typescript
async handleTerminalOperation(terminalOperation: "continue" | "abort")
```

### 执行步骤

#### 7.1 创建TerminalManager类

**文件**: `src/core/task/managers/TerminalManager.ts`

```typescript
export interface TerminalManagerOptions {
    taskId: string
    onContinue?: () => Promise<void>
    onAbort?: () => Promise<void>
}

export class TerminalManager {
    // 终端管理相关的方法
}
```

#### 7.2 实现核心功能

1. **终端操作处理**
   - `handleTerminalOperation(operation: "continue" | "abort"): Promise<void>`
   - `pauseTask(): void`
   - `resumeTask(): Promise<void>`

#### 7.3 更新Task.ts

1. 创建TerminalManager实例
2. 替换所有调用`handleTerminalOperation()`的地方
3. 更新构造函数
4. 更新相关方法

#### 7.4 编写测试

**测试文件**: `src/core/task/managers/__tests__/TerminalManager.test.ts`

测试覆盖：
- 终端继续操作
- 终端中止操作
- 任务暂停
- 任务恢复
- 边界情况和错误处理

#### 7.5 运行测试

```bash
cd "d:\项目\agent\Roo-Code\src" && pnpm test --run --dir core/task/managers/__tests__/TerminalManager.test.ts
```

#### 7.6 验证标准

- [ ] `handleTerminalOperation()`方法已迁移到TerminalManager
- [ ] Task.ts通过TerminalManager处理终端操作
- [ ] 所有测试通过
- [ ] 无TypeScript错误
- [ ] 无ESLint错误

---

## 额外阶段: 移动功能到现有Manager

### 目标
将一些功能移动到现有的Manager类中，进一步简化Task.ts。

### 要移动的功能

#### 1. 移动到ContextManager

**方法**: `condenseContext()` 和 `handleContextWindowExceededError()`

**步骤**:
1. 将这两个方法从Task.ts移动到ContextManager
2. 更新Task.ts中的调用
3. 更新ApiRequestManager中的调用
4. 编写测试
5. 运行测试
6. 验证

#### 2. 移动到UsageTracker

**方法**: `updateTokenUsage()`

**步骤**:
1. 将这个方法从Task.ts移动到UsageTracker
2. 更新Task.ts中的调用
3. 更新TaskMessageManager中的调用
4. 编写测试
5. 运行测试
6. 验证

#### 3. 移动到TaskMessageManager

**方法**: `findMessageByTimestamp()`

**步骤**:
1. 删除Task.ts中的包装方法
2. 直接使用TaskMessageManager的方法
3. 更新所有调用点
4. 运行测试
5. 验证

---

## 最终验证阶段

### 目标
确保所有拆分完成后，Task.ts符合职责分离原则。

### 验证步骤

#### 1. 代码审查

检查Task.ts是否符合以下标准：
- [ ] 只包含核心职责：任务协调、事件发射、元数据管理、依赖注入
- [ ] 不包含流式处理逻辑
- [ ] 不包含提示词生成逻辑
- [ ] 不包含消息队列处理逻辑
- [ ] 不包含浏览器会话管理逻辑
- [ ] 不包含对话历史管理逻辑
- [ ] 不包含Token估算逻辑
- [ ] 不包含终端操作处理逻辑
- [ ] 所有非核心功能都已委托给Manager

#### 2. 运行所有测试

```bash
cd "d:\项目\agent\Roo-Code\src" && pnpm test --run
```

#### 3. 类型检查

```bash
cd "d:\项目\agent\Roo-Code" && pnpm check-types
```

#### 4. Lint检查

```bash
cd "d:\项目\agent\Roo-Code" && pnpm lint
```

#### 5. 构建测试

```bash
cd "d:\项目\agent\Roo-Code" && pnpm build
```

#### 6. 集成测试

运行完整的集成测试，确保所有功能正常工作。

---

## 风险和缓解措施

### 风险1: 拆分过程中引入bug

**缓解措施**:
- 每个阶段完成后立即运行测试
- 使用git提交每个阶段的成果
- 保留原始代码作为参考

### 风险2: Manager之间的依赖关系复杂

**缓解措施**:
- 仔细设计Manager之间的接口
- 使用依赖注入减少耦合
- 编写详细的接口文档

### 风险3: 测试覆盖不足

**缓解措施**:
- 为每个Manager编写完整的单元测试
- 编写集成测试验证Manager之间的交互
- 使用测试覆盖率工具确保覆盖充分

### 风险4: 性能下降

**缓解措施**:
- 使用性能测试工具监控性能
- 优化Manager之间的通信
- 避免不必要的对象创建

---

## 回滚计划

如果在某个阶段遇到无法解决的问题，可以按照以下步骤回滚：

1. 使用git回滚到上一个稳定版本
2. 分析问题原因
3. 修复问题后重新开始该阶段
4. 确保问题解决后再继续下一个阶段

---

## 总结

本执行方案提供了Task.ts进一步拆分的详细步骤。按照这个方案执行，可以确保：

1. 每个阶段都有明确的目标和验证标准
2. 拆分过程可控且可回滚
3. 代码质量得到保证
4. 最终的Task.ts符合职责分离原则

**预计总时间**: 7-10天
**最终目标**: Task.ts只保留核心职责，代码行数减少到500行以下
