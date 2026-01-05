# 日志系统设计文档

## 概述

为 Roo Code VS Code 扩展实现一个结构化的日志系统，支持多级别日志、统一格式和完善的错误追踪。

## 设计目标

- 支持多级别日志（DEBUG、INFO、WARN、ERROR）
- 统一的日志格式（时间戳、级别、前缀、消息）
- 完善的错误处理和堆栈追踪
- 可配置的日志级别
- 向后兼容现有代码

## 核心组件

### Logger 类

```typescript
class Logger {
    constructor(
        outputChannel: vscode.OutputChannel,
        prefix: string = "",
        minLevel: LogLevel = LogLevel.INFO
    )
    
    debug(message: string): void
    info(message: string): void
    warn(message: string): void
    error(message: string, error?: Error | unknown): void
}
```

### 日志级别

```typescript
enum LogLevel {
    DEBUG = "DEBUG",  // 调试信息
    INFO = "INFO",    // 一般信息
    WARN = "WARN",    // 警告信息
    ERROR = "ERROR"   // 错误信息
}
```

### 日志格式

```
[2024-01-05T10:30:45.123Z] [INFO] [Extension] Extension activated
[2024-01-05T10:30:45.456Z] [ERROR] [WebviewCoordinator] Failed to set HTML content: Connection refused
```

## 实施计划

### 阶段 1：创建 Logger 工具模块

**文件：** `src/utils/logger.ts`

**功能：**
- 实现 Logger 类
- 实现 LogLevel 枚举
- 实现 createLogger 工厂函数
- 支持日志级别过滤
- 统一的日志格式化

### 阶段 2：迁移核心模块

**优先级：**
1. `src/extension.ts` - 扩展激活入口
2. `src/activate/registerCommands.ts` - 命令注册
3. `src/core/webview/WebviewCoordinator.ts` - Webview 协调器
4. `src/core/webview/ClineProvider.ts` - Provider 实现

**迁移策略：**
- 创建 Logger 实例
- 替换 `outputChannel.appendLine` 为 Logger 方法
- 添加关键步骤的日志
- 改进错误处理

### 阶段 3：测试验证

**测试内容：**
- 日志输出正确性
- 日志级别过滤
- 错误信息完整性
- 性能影响评估

## 使用示例

### 创建 Logger

```typescript
import { createLogger, LogLevel } from "./utils/logger"

const logger = createLogger(outputChannel, "Extension", LogLevel.DEBUG)
```

### 使用 Logger

```typescript
logger.debug("Debug message")
logger.info("Extension activated")
logger.warn("Configuration not found, using defaults")
logger.error("Failed to initialize service", error)
```

## 配置

### 环境变量

```bash
# 设置日志级别
LOG_LEVEL=DEBUG  # DEBUG | INFO | WARN | ERROR
```

### 代码配置

```typescript
const logger = createLogger(
    outputChannel,
    "Module",
    process.env.LOG_LEVEL as LogLevel || LogLevel.INFO
)
```

## 向后兼容

- 保留 `outputChannel.appendLine` 方法
- 新旧日志系统可以共存
- 逐步迁移，不影响现有功能

## 性能考虑

- 日志级别过滤在日志输出前进行
- 避免在热路径中过度日志
- 生产环境默认使用 INFO 级别
- 开发环境默认使用 DEBUG 级别

## 相关文件

- `src/utils/logger.ts` - Logger 实现（新建）
- `src/extension.ts` - 扩展激活入口（修改）
- `src/activate/registerCommands.ts` - 命令注册（修改）
- `src/core/webview/WebviewCoordinator.ts` - Webview 协调器（修改）
- `src/core/webview/ClineProvider.ts` - Provider 实现（修改）

## 预期效果

- 更清晰的日志输出
- 更好的调试体验
- 更快的错误定位
- 更高的代码可维护性
