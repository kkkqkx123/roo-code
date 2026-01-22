# 消息总线实施计划

## 概述

本文档详细描述了消息总线架构的实施计划，包括四个阶段的任务分解、时间估算和交付物。

## 阶段 1: 基础架构 (1-2周)

### 目标
创建消息总线核心组件，建立基础设施。

### 任务分解

#### 任务 1.1: 创建消息类型定义文件
**文件**: `src/core/messagebus/MessageTypes.ts`

**内容**:
- 定义所有消息类型的命名空间
- 定义 WebviewRequestMessage 联合类型
- 定义 ExtensionResponseMessage 联合类型
- 添加 Zod 验证 schema

**验收标准**:
- 所有消息类型都有完整的 TypeScript 类型定义
- 消息类型按功能分组（Task、Settings、MCP、Browser、Checkpoint）
- 包含 Zod 验证 schema
- 通过 TypeScript 编译检查

**时间估算**: 2-3 天

#### 任务 1.2: 实现 MessageBus 核心类
**文件**: `src/core/messagebus/MessageBus.ts`

**内容**:
- 实现 MessageBus 类
- 实现处理器注册和管理
- 实现消息路由和分发
- 实现消息队列管理
- 实现错误处理和重试机制
- 实现死消息自动清理

**验收标准**:
- 支持处理器注册和取消注册
- 支持消息路由和分发
- 支持消息队列管理
- 支持自动重试（指数退避）
- 支持死消息自动清理
- 单元测试覆盖率 > 90%

**时间估算**: 3-4 天

#### 任务 1.3: 实现 MessageBusServer
**文件**: `src/core/messagebus/MessageBusServer.ts`

**内容**:
- 继承 MessageBus 类
- 实现 VSCode Webview API 集成
- 实现消息发送和接收
- 实现消息队列处理
- 实现 Webview 可用性检查

**验收标准**:
- 继承 MessageBus 的所有功能
- 正确集成 VSCode Webview API
- 支持消息队列处理
- 支持 Webview 可用性检查
- 单元测试覆盖率 > 90%

**时间估算**: 2-3 天

#### 任务 1.4: 实现 MessageBusClient
**文件**: `webview-ui/src/utils/MessageBusClient.ts`

**内容**:
- 实现 MessageBusClient 类
- 实现 Promise-based API
- 实现超时处理
- 实现请求-响应匹配
- 实现自动请求 ID 生成

**验收标准**:
- 提供 Promise-based API
- 支持超时处理
- 支持请求-响应匹配
- 自动生成请求 ID
- 单元测试覆盖率 > 90%

**时间估算**: 2-3 天

#### 任务 1.5: 创建 MessageHandlerRegistry
**文件**: `src/core/messagebus/MessageHandlerRegistry.ts`

**内容**:
- 实现 MessageHandlerRegistry 类
- 实现按功能分组的处理器注册
- 实现自动注册接口
- 实现日志记录

**验收标准**:
- 支持按功能分组注册处理器
- 提供统一的注册接口
- 自动记录日志
- 单元测试覆盖率 > 90%

**时间估算**: 2-3 天

### 交付物
- `src/core/messagebus/MessageTypes.ts`
- `src/core/messagebus/MessageBus.ts`
- `src/core/messagebus/MessageBusServer.ts`
- `webview-ui/src/utils/MessageBusClient.ts`
- `src/core/messagebus/MessageHandlerRegistry.ts`
- 完整的单元测试套件
- API 文档

### 风险和缓解
- **风险**: TypeScript 类型定义可能不完整
  - **缓解**: 充分的代码审查和测试
- **风险**: 性能可能不如预期
  - **缓解**: 性能基准测试和优化

---

## 阶段 2: 迁移现有消息处理 (2-3周)

### 目标
将现有的消息处理逻辑迁移到新的消息总线架构。

### 任务分解

#### 任务 2.1: 迁移 Task 相关消息
**文件**: `src/core/messagebus/handlers/TaskHandlers.ts`

**内容**:
- 实现 Task 相关消息处理器
- 迁移 `newTask` 消息处理
- 迁移 `cancelTask` 消息处理
- 迁移 `clearTask` 消息处理
- 迁移 `askResponse` 消息处理

**验收标准**:
- 所有 Task 相关消息都有对应的处理器
- 处理器逻辑与原系统一致
- 单元测试覆盖率 > 90%
- 集成测试通过

**时间估算**: 3-4 天

#### 任务 2.2: 迁移 Settings 相关消息
**文件**: `src/core/messagebus/handlers/SettingsHandlers.ts`

**内容**:
- 实现 Settings 相关消息处理器
- 迁移 `updateSettings` 消息处理
- 迁移 `customInstructions` 消息处理
- 迁移 `mode` 消息处理
- 迁移其他 Settings 相关消息

**验收标准**:
- 所有 Settings 相关消息都有对应的处理器
- 处理器逻辑与原系统一致
- 单元测试覆盖率 > 90%
- 集成测试通过

**时间估算**: 3-4 天

#### 任务 2.3: 迁移 MCP 相关消息
**文件**: `src/core/messagebus/handlers/MCPHandlers.ts`

**内容**:
- 实现 MCP 相关消息处理器
- 迁移 `toggleMcpServer` 消息处理
- 迁移 `restartMcpServer` 消息处理
- 迁移 `refreshAllMcpServers` 消息处理
- 迁移其他 MCP 相关消息

**验收标准**:
- 所有 MCP 相关消息都有对应的处理器
- 处理器逻辑与原系统一致
- 单元测试覆盖率 > 90%
- 集成测试通过

**时间估算**: 2-3 天

#### 任务 2.4: 迁移 Browser 相关消息
**文件**: `src/core/messagebus/handlers/BrowserHandlers.ts`

**内容**:
- 实现 Browser 相关消息处理器
- 迁移 `testBrowserConnection` 消息处理
- 迁移 `killBrowserSession` 消息处理
- 迁移其他 Browser 相关消息

**验收标准**:
- 所有 Browser 相关消息都有对应的处理器
- 处理器逻辑与原系统一致
- 单元测试覆盖率 > 90%
- 集成测试通过

**时间估算**: 2-3 天

#### 任务 2.5: 迁移 Checkpoint 相关消息
**文件**: `src/core/messagebus/handlers/CheckpointHandlers.ts`

**内容**:
- 实现 Checkpoint 相关消息处理器
- 迁移 `checkpointDiff` 消息处理
- 迁移 `checkpointRestore` 消息处理
- 迁移其他 Checkpoint 相关消息

**验收标准**:
- 所有 Checkpoint 相关消息都有对应的处理器
- 处理器逻辑与原系统一致
- 单元测试覆盖率 > 90%
- 集成测试通过

**时间估算**: 2-3 天

### 交付物
- `src/core/messagebus/handlers/TaskHandlers.ts`
- `src/core/messagebus/handlers/SettingsHandlers.ts`
- `src/core/messagebus/handlers/MCPHandlers.ts`
- `src/core/messagebus/handlers/BrowserHandlers.ts`
- `src/core/messagebus/handlers/CheckpointHandlers.ts`
- 完整的单元测试套件
- 集成测试套件

### 风险和缓解
- **风险**: 迁移过程中可能引入 bug
  - **缓解**: 充分的测试和代码审查
- **风险**: 迁移时间可能超出预期
  - **缓解**: 优先级排序，先迁移关键功能

---

## 阶段 3: 集成和测试 (1-2周)

### 目标
将消息总线集成到现有系统，并进行全面测试。

### 任务分解

#### 任务 3.1: 集成到 ClineProvider
**文件**: `src/core/webview/ClineProvider.ts`

**内容**:
- 在 ClineProvider 中初始化 MessageBusServer
- 在 ClineProvider 中初始化 MessageHandlerRegistry
- 替换现有的消息处理逻辑
- 保持向后兼容性

**验收标准**:
- MessageBusServer 正确集成到 ClineProvider
- MessageHandlerRegistry 正确注册所有处理器
- 现有功能正常工作
- 向后兼容性测试通过

**时间估算**: 3-4 天

#### 任务 3.2: 更新前端组件使用新的消息总线
**文件**: `webview-ui/src/components/**/*.tsx`

**内容**:
- 更新 ChatView 使用 MessageBusClient
- 更新 SettingsView 使用 MessageBusClient
- 更新其他组件使用 MessageBusClient
- 移除旧的 vscode.postMessage 调用

**验收标准**:
- 所有前端组件使用 MessageBusClient
- 现有功能正常工作
- 用户体验没有变化
- 集成测试通过

**时间估算**: 3-4 天

#### 任务 3.3: 单元测试
**文件**: `src/core/messagebus/__tests__/**/*.ts`

**内容**:
- 为 MessageBus 编写单元测试
- 为 MessageBusServer 编写单元测试
- 为 MessageBusClient 编写单元测试
- 为 MessageHandlerRegistry 编写单元测试
- 为所有处理器编写单元测试

**验收标准**:
- 单元测试覆盖率 > 90%
- 所有测试通过
- 测试覆盖关键路径和边界情况

**时间估算**: 2-3 天

#### 任务 3.4: 集成测试
**文件**: `src/core/messagebus/__tests__/integration/**/*.ts`

**内容**:
- 编写前后端集成测试
- 编写消息确认机制测试
- 编写错误恢复测试
- 编写性能测试

**验收标准**:
- 集成测试覆盖率 > 80%
- 所有测试通过
- 测试覆盖关键场景

**时间估算**: 2-3 天

#### 任务 3.5: 性能测试
**文件**: `src/core/messagebus/__tests__/performance/**/*.ts`

**内容**:
- 测试消息吞吐量
- 测试内存使用
- 测试响应时间
- 对比新旧系统性能

**验收标准**:
- 消息吞吐量 > 1000 msg/s
- 内存使用 < 100MB
- 平均响应时间 < 10ms
- 性能优于或等于旧系统

**时间估算**: 1-2 天

### 交付物
- 集成的消息总线系统
- 完整的单元测试套件
- 完整的集成测试套件
- 性能测试报告

### 风险和缓解
- **风险**: 集成可能引入不兼容问题
  - **缓解**: 充分的集成测试和兼容性测试
- **风险**: 性能可能不如旧系统
  - **缓解**: 性能优化和基准测试

---

## 阶段 4: 优化和文档 (1周)

### 目标
优化消息总线性能，完善文档和监控。

### 任务分解

#### 任务 4.1: 性能优化
**文件**: `src/core/messagebus/MessageBus.ts`

**内容**:
- 实现消息批处理
- 实现消息缓存
- 优化消息路由
- 优化内存使用

**验收标准**:
- 消息处理速度提升 50%
- 内存使用减少 30%
- 性能测试通过

**时间估算**: 2-3 天

#### 任务 4.2: 错误处理优化
**文件**: `src/core/messagebus/MessageBus.ts`

**内容**:
- 完善错误分类
- 完善错误恢复策略
- 完善错误日志
- 完善错误监控

**验收标准**:
- 错误恢复率 > 95%
- 错误日志完整
- 错误监控完善

**时间估算**: 1-2 天

#### 任务 4.3: 日志和监控
**文件**: `src/core/messagebus/MessageBus.ts`

**内容**:
- 实现消息追踪
- 实现性能监控
- 实现错误监控
- 实现日志聚合

**验收标准**:
- 消息追踪完整
- 性能监控完善
- 错误监控完善
- 日志聚合正常

**时间估算**: 1-2 天

#### 任务 4.4: 文档编写
**文件**: `docs/plan/event/*.md`

**内容**:
- 编写 API 文档
- 编写使用指南
- 编写故障排查指南
- 编写最佳实践

**验收标准**:
- API 文档完整
- 使用指南清晰
- 故障排查指南实用
- 最佳实践明确

**时间估算**: 1-2 天

### 交付物
- 优化的消息总线系统
- 完整的文档
- 监控和日志系统

### 风险和缓解
- **风险**: 优化可能引入新的 bug
  - **缓解**: 充分的测试和代码审查
- **风险**: 文档可能不完整
  - **缓解**: 多人审查和用户反馈

---

## 总体时间估算

| 阶段 | 时间估算 | 关键路径 |
|------|---------|---------|
| 阶段 1: 基础架构 | 1-2 周 | MessageBus 核心类 |
| 阶段 2: 迁移现有消息处理 | 2-3 周 | Task 相关消息迁移 |
| 阶段 3: 集成和测试 | 1-2 周 | 集成到 ClineProvider |
| 阶段 4: 优化和文档 | 1 周 | 性能优化 |
| **总计** | **5-8 周** | **6-7 周** |

## 资源需求

### 人员
- 后端开发工程师: 2 人
- 前端开发工程师: 1 人
- 测试工程师: 1 人
- 技术文档工程师: 0.5 人

### 工具
- TypeScript 5.x
- Vitest (测试框架)
- VS Code API
- Git

### 环境
- 开发环境
- 测试环境
- 预发布环境

## 成功标准

### 功能性
- 所有现有功能正常工作
- 新的消息总线系统稳定可靠
- 向后兼容性良好

### 性能
- 消息处理速度提升 50%
- 内存使用减少 30%
- 错误恢复率 > 95%

### 质量
- 单元测试覆盖率 > 90%
- 集成测试覆盖率 > 80%
- 代码审查通过率 100%

### 文档
- API 文档完整
- 使用指南清晰
- 故障排查指南实用

## 风险管理

### 高风险
- **风险**: 迁移过程中可能引入严重 bug
  - **影响**: 系统不稳定
  - **概率**: 中
  - **缓解**: 充分的测试和代码审查，分阶段迁移

- **风险**: 性能可能不如预期
  - **影响**: 用户体验下降
  - **概率**: 低
  - **缓解**: 性能基准测试，及时优化

### 中风险
- **风险**: 开发周期延长
  - **影响**: 项目延期
  - **概率**: 中
  - **缓解**: 优先级排序，灵活调整计划

- **风险**: 向后兼容性问题
  - **影响**: 现有功能失效
  - **概率**: 低
  - **缓解**: 充分的兼容性测试

### 低风险
- **风险**: 文档不完整
  - **影响**: 开发效率下降
  - **概率**: 低
  - **缓解**: 多人审查，用户反馈

## 总结

消息总线实施计划分为四个阶段，总计 5-8 周。通过分阶段实施，可以降低风险，确保平稳过渡。

关键成功因素:
- 充分的测试
- 代码审查
- 性能优化
- 完整的文档

预期效果:
- 代码量减少 70%
- 性能提升 50%
- 开发效率提升 40%
- 错误恢复率提升到 95%
