# 前端消息类型安全改进方案 v2

## 问题重新分析

### 核心问题

当前方案虽然添加了 Zod schema 运行时验证，但**前端代码仍然无法得到静态类型检查**：

```typescript
// 前端代码 - TypeScript 不会报错！
const message: WebviewMessage = {
  type: "task.create",
  taskId: "123",  // 错误！task.create 不应该有 taskId
  // 缺少必需的 text 字段
}

// 只有运行时才能发现错误
await messageBusClient.send(message)  // 运行时验证失败
```

### 问题根源

1. **`WebviewMessage` 接口过于宽泛**
   - 所有消息类型共享同一个接口
   - 包含 50+ 可选字段
   - TypeScript 无法区分不同消息类型的字段要求

2. **前后端类型定义不一致**
   - 后端使用 `WebviewRequestMessage`（联合类型）
   - 前端使用 `WebviewMessage`（宽泛接口）
   - 两者无法共享类型信息

3. **缺少类型推断机制**
   - 前端发送消息时无法推断正确的类型
   - IDE 无法提供准确的自动补全
   - 编译器无法检查字段的有效性

## 解决方案：端到端类型安全

### 核心思想

使用 **Zod Schema 作为单一真理来源**，自动生成 TypeScript 类型，确保前后端类型完全一致。

### 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    共享类型定义层                          │
│  MessageSchemas.ts (Zod) + 自动生成的 TypeScript 类型      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    前端类型安全层                          │
│  - 类型安全的消息构建器                                     │
│  - 类型守卫和类型推断                                       │
│  - 编译时类型检查                                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    后端类型安全层                          │
│  - Zod schema 运行时验证                                  │
│  - 类型安全的消息处理器                                     │
│  - 自动生成的类型                                          │
└─────────────────────────────────────────────────────────────┘
```

## 实施方案

### 阶段 1: 创建共享的 Zod Schema 定义 (1周)

#### 1.1 定义所有消息的 Zod Schema

**文件**: `src/shared/schemas/MessageSchemas.ts`

```typescript
import { z } from "zod"

// Task 消息 Schema
export const TaskSchemas = {
  create: z.object({
    type: z.literal("task.create"),
    text: z.string(),
    images: z.array(z.string()).optional()
  }),

  cancel: z.object({
    type: z.literal("task.cancel"),
    taskId: z.string()
  }),

  clear: z.object({
    type: z.literal("task.clear")
  }),

  askResponse: z.object({
    type: z.literal("task.askResponse"),
    askResponse: z.enum(["yesButtonClicked", "noButtonClicked", "messageResponse", "objectResponse"]),
    text: z.string().optional(),
    images: z.array(z.string()).optional()
  }),

  deleteMessageConfirm: z.object({
    type: z.literal("task.deleteMessageConfirm"),
    messageTs: z.number(),
    restoreCheckpoint: z.boolean().optional()
  }),

  editMessageConfirm: z.object({
    type: z.literal("task.editMessageConfirm"),
    messageTs: z.number(),
    text: z.string(),
    restoreCheckpoint: z.boolean().optional(),
    images: z.array(z.string()).optional()
  }),

  humanRelayResponse: z.object({
    type: z.literal("task.humanRelayResponse"),
    requestId: z.string(),
    text: z.string()
  }),

  humanRelayCancel: z.object({
    type: z.literal("task.humanRelayCancel"),
    requestId: z.string()
  })
}

// Settings 消息 Schema
export const SettingsSchemas = {
  get: z.object({
    type: z.literal("settings.get")
  }),

  update: z.object({
    type: z.literal("settings.update"),
    settings: z.record(z.any())
  }),

  updateCustomInstructions: z.object({
    type: z.literal("settings.updateCustomInstructions"),
    text: z.string().optional()
  }),

  updateMode: z.object({
    type: z.literal("settings.updateMode"),
    mode: z.string()
  })
}

// MCP 消息 Schema
export const MCPSchemas = {
  toggle: z.object({
    type: z.literal("mcp.toggle"),
    serverName: z.string(),
    enabled: z.boolean()
  }),

  restart: z.object({
    type: z.literal("mcp.restart"),
    serverName: z.string()
  }),

  refreshAll: z.object({
    type: z.literal("mcp.refreshAll")
  }),

  toggleToolAlwaysAllow: z.object({
    type: z.literal("mcp.toggleToolAlwaysAllow"),
    serverName: z.string(),
    toolName: z.string(),
    alwaysAllow: z.boolean()
  }),

  toggleToolEnabledForPrompt: z.object({
    type: z.literal("mcp.toggleToolEnabledForPrompt"),
    serverName: z.string(),
    toolName: z.string(),
    isEnabled: z.boolean()
  }),

  updateTimeout: z.object({
    type: z.literal("mcp.updateTimeout"),
    serverName: z.string(),
    timeout: z.number()
  }),

  deleteServer: z.object({
    type: z.literal("mcp.deleteServer"),
    serverName: z.string()
  })
}

// ... 其他消息类型的 Schema
```

#### 1.2 从 Zod Schema 自动生成 TypeScript 类型

**文件**: `src/shared/schemas/MessageTypes.ts`

```typescript
import { z } from "zod"
import * as Schemas from "./MessageSchemas"

// 从 Zod Schema 自动生成类型
export type TaskCreate = z.infer<typeof Schemas.TaskSchemas.create>
export type TaskCancel = z.infer<typeof Schemas.TaskSchemas.cancel>
export type TaskClear = z.infer<typeof Schemas.TaskSchemas.clear>
export type TaskAskResponse = z.infer<typeof Schemas.TaskSchemas.askResponse>
export type TaskDeleteMessageConfirm = z.infer<typeof Schemas.TaskSchemas.deleteMessageConfirm>
export type TaskEditMessageConfirm = z.infer<typeof Schemas.TaskSchemas.editMessageConfirm>
export type TaskHumanRelayResponse = z.infer<typeof Schemas.TaskSchemas.humanRelayResponse>
export type TaskHumanRelayCancel = z.infer<typeof Schemas.TaskSchemas.humanRelayCancel>

export type SettingsGet = z.infer<typeof Schemas.SettingsSchemas.get>
export type SettingsUpdate = z.infer<typeof Schemas.SettingsSchemas.update>
export type SettingsUpdateCustomInstructions = z.infer<typeof Schemas.SettingsSchemas.updateCustomInstructions>
export type SettingsUpdateMode = z.infer<typeof Schemas.SettingsSchemas.updateMode>

export type MCPToggle = z.infer<typeof Schemas.MCPSchemas.toggle>
export type MCPRestart = z.infer<typeof Schemas.MCPSchemas.restart>
export type MCPRefreshAll = z.infer<typeof Schemas.MCPSchemas.refreshAll>
export type MCPToggleToolAlwaysAllow = z.infer<typeof Schemas.MCPSchemas.toggleToolAlwaysAllow>
export type MCPToggleToolEnabledForPrompt = z.infer<typeof Schemas.MCPSchemas.toggleToolEnabledForPrompt>
export type MCPUpdateTimeout = z.infer<typeof Schemas.MCPSchemas.updateTimeout>
export type MCPDeleteServer = z.infer<typeof Schemas.MCPSchemas.deleteServer>

// ... 其他消息类型

// 联合类型
export type WebviewRequestMessage =
  | TaskCreate
  | TaskCancel
  | TaskClear
  | TaskAskResponse
  | TaskDeleteMessageConfirm
  | TaskEditMessageConfirm
  | TaskHumanRelayResponse
  | TaskHumanRelayCancel
  | SettingsGet
  | SettingsUpdate
  | SettingsUpdateCustomInstructions
  | SettingsUpdateMode
  | MCPToggle
  | MCPRestart
  | MCPRefreshAll
  | MCPToggleToolAlwaysAllow
  | MCPToggleToolEnabledForPrompt
  | MCPUpdateTimeout
  | MCPDeleteServer
  // ... 其他消息类型
```

#### 1.3 创建 Schema Registry

**文件**: `src/shared/schemas/SchemaRegistry.ts`

```typescript
import { z } from "zod"
import * as Schemas from "./MessageSchemas"

export class SchemaRegistry {
  private static instance: SchemaRegistry
  private schemas = new Map<string, z.ZodSchema>()

  private constructor() {
    this.registerSchemas()
  }

  static getInstance(): SchemaRegistry {
    if (!SchemaRegistry.instance) {
      SchemaRegistry.instance = new SchemaRegistry()
    }
    return SchemaRegistry.instance
  }

  private registerSchemas(): void {
    // Task schemas
    this.register("task.create", Schemas.TaskSchemas.create)
    this.register("task.cancel", Schemas.TaskSchemas.cancel)
    this.register("task.clear", Schemas.TaskSchemas.clear)
    this.register("task.askResponse", Schemas.TaskSchemas.askResponse)
    this.register("task.deleteMessageConfirm", Schemas.TaskSchemas.deleteMessageConfirm)
    this.register("task.editMessageConfirm", Schemas.TaskSchemas.editMessageConfirm)
    this.register("task.humanRelayResponse", Schemas.TaskSchemas.humanRelayResponse)
    this.register("task.humanRelayCancel", Schemas.TaskSchemas.humanRelayCancel)

    // Settings schemas
    this.register("settings.get", Schemas.SettingsSchemas.get)
    this.register("settings.update", Schemas.SettingsSchemas.update)
    this.register("settings.updateCustomInstructions", Schemas.SettingsSchemas.updateCustomInstructions)
    this.register("settings.updateMode", Schemas.SettingsSchemas.updateMode)

    // MCP schemas
    this.register("mcp.toggle", Schemas.MCPSchemas.toggle)
    this.register("mcp.restart", Schemas.MCPSchemas.restart)
    this.register("mcp.refreshAll", Schemas.MCPSchemas.refreshAll)
    this.register("mcp.toggleToolAlwaysAllow", Schemas.MCPSchemas.toggleToolAlwaysAllow)
    this.register("mcp.toggleToolEnabledForPrompt", Schemas.MCPSchemas.toggleToolEnabledForPrompt)
    this.register("mcp.updateTimeout", Schemas.MCPSchemas.updateTimeout)
    this.register("mcp.deleteServer", Schemas.MCPSchemas.deleteServer)

    // ... 其他 schema
  }

  register(messageType: string, schema: z.ZodSchema): void {
    this.schemas.set(messageType, schema)
  }

  get(messageType: string): z.ZodSchema | undefined {
    return this.schemas.get(messageType)
  }

  has(messageType: string): boolean {
    return this.schemas.has(messageType)
  }

  validate(messageType: string, data: unknown): any {
    const schema = this.get(messageType)
    if (!schema) {
      throw new Error(`No schema registered for message type: ${messageType}`)
    }
    return schema.parse(data)
  }
}

export const schemaRegistry = SchemaRegistry.getInstance()
```

**验收标准**:
- 所有消息类型都有对应的 Zod schema
- TypeScript 类型从 Zod schema 自动生成
- Schema Registry 正确注册所有 schema
- 通过 TypeScript 编译检查

### 阶段 2: 创建类型安全的消息构建器 (1周)

#### 2.1 前端消息构建器

**文件**: `webview-ui/src/utils/MessageBuilder.ts`

```typescript
import type {
  TaskCreate,
  TaskCancel,
  TaskClear,
  TaskAskResponse,
  TaskDeleteMessageConfirm,
  TaskEditMessageConfirm,
  TaskHumanRelayResponse,
  TaskHumanRelayCancel,
  SettingsGet,
  SettingsUpdate,
  SettingsUpdateCustomInstructions,
  SettingsUpdateMode,
  MCPToggle,
  MCPRestart,
  MCPRefreshAll,
  MCPToggleToolAlwaysAllow,
  MCPToggleToolEnabledForPrompt,
  MCPUpdateTimeout,
  MCPDeleteServer,
  WebviewRequestMessage
} from "@shared/schemas/MessageTypes"

export class MessageBuilder {
  // Task 消息构建器
  static createTask(text: string, images?: string[]): TaskCreate {
    return {
      type: "task.create",
      text,
      images
    }
  }

  static cancelTask(taskId: string): TaskCancel {
    return {
      type: "task.cancel",
      taskId
    }
  }

  static clearTask(): TaskClear {
    return {
      type: "task.clear"
    }
  }

  static askResponse(
    askResponse: "yesButtonClicked" | "noButtonClicked" | "messageResponse" | "objectResponse",
    text?: string,
    images?: string[]
  ): TaskAskResponse {
    return {
      type: "task.askResponse",
      askResponse,
      text,
      images
    }
  }

  static deleteMessageConfirm(messageTs: number, restoreCheckpoint?: boolean): TaskDeleteMessageConfirm {
    return {
      type: "task.deleteMessageConfirm",
      messageTs,
      restoreCheckpoint
    }
  }

  static editMessageConfirm(
    messageTs: number,
    text: string,
    restoreCheckpoint?: boolean,
    images?: string[]
  ): TaskEditMessageConfirm {
    return {
      type: "task.editMessageConfirm",
      messageTs,
      text,
      restoreCheckpoint,
      images
    }
  }

  static humanRelayResponse(requestId: string, text: string): TaskHumanRelayResponse {
    return {
      type: "task.humanRelayResponse",
      requestId,
      text
    }
  }

  static humanRelayCancel(requestId: string): TaskHumanRelayCancel {
    return {
      type: "task.humanRelayCancel",
      requestId
    }
  }

  // Settings 消息构建器
  static getSettings(): SettingsGet {
    return {
      type: "settings.get"
    }
  }

  static updateSettings(settings: Record<string, any>): SettingsUpdate {
    return {
      type: "settings.update",
      settings
    }
  }

  static updateCustomInstructions(text?: string): SettingsUpdateCustomInstructions {
    return {
      type: "settings.updateCustomInstructions",
      text
    }
  }

  static updateMode(mode: string): SettingsUpdateMode {
    return {
      type: "settings.updateMode",
      mode
    }
  }

  // MCP 消息构建器
  static toggleMcpServer(serverName: string, enabled: boolean): MCPToggle {
    return {
      type: "mcp.toggle",
      serverName,
      enabled
    }
  }

  static restartMcpServer(serverName: string): MCPRestart {
    return {
      type: "mcp.restart",
      serverName
    }
  }

  static refreshAllMcpServers(): MCPRefreshAll {
    return {
      type: "mcp.refreshAll"
    }
  }

  static toggleToolAlwaysAllow(serverName: string, toolName: string, alwaysAllow: boolean): MCPToggleToolAlwaysAllow {
    return {
      type: "mcp.toggleToolAlwaysAllow",
      serverName,
      toolName,
      alwaysAllow
    }
  }

  static toggleToolEnabledForPrompt(serverName: string, toolName: string, isEnabled: boolean): MCPToggleToolEnabledForPrompt {
    return {
      type: "mcp.toggleToolEnabledForPrompt",
      serverName,
      toolName,
      isEnabled
    }
  }

  static updateMcpTimeout(serverName: string, timeout: number): MCPUpdateTimeout {
    return {
      type: "mcp.updateTimeout",
      serverName,
      timeout
    }
  }

  static deleteMcpServer(serverName: string): MCPDeleteServer {
    return {
      type: "mcp.deleteServer",
      serverName
    }
  }

  // ... 其他消息构建器
}
```

**使用示例**:
```typescript
// 编译时类型检查！
const message = MessageBuilder.createTask("Hello", ["image.png"])

// TypeScript 会报错！
// const badMessage = MessageBuilder.createTask("Hello", 123)  // Error: images 应该是 string[]

// TypeScript 会报错！缺少必需字段
// const badMessage2 = MessageBuilder.createTask()  // Error: text 是必需的

// 发送消息
await typedMessageBusClient.send(message)
```

**验收标准**:
- 提供类型安全的消息构建方法
- 自动补全和类型提示
- 编译时类型检查
- 返回的类型与 Zod schema 一致

#### 2.2 创建类型守卫

**文件**: `webview-ui/src/utils/MessageGuards.ts`

```typescript
import type { WebviewRequestMessage } from "@shared/schemas/MessageTypes"

export function isTaskCreate(message: WebviewRequestMessage): message is TaskCreate {
  return message.type === "task.create"
}

export function isTaskCancel(message: WebviewRequestMessage): message is TaskCancel {
  return message.type === "task.cancel"
}

export function isTaskClear(message: WebviewRequestMessage): message is TaskClear {
  return message.type === "task.clear"
}

export function isTaskAskResponse(message: WebviewRequestMessage): message is TaskAskResponse {
  return message.type === "task.askResponse"
}

export function isTaskDeleteMessageConfirm(message: WebviewRequestMessage): message is TaskDeleteMessageConfirm {
  return message.type === "task.deleteMessageConfirm"
}

export function isTaskEditMessageConfirm(message: WebviewRequestMessage): message is TaskEditMessageConfirm {
  return message.type === "task.editMessageConfirm"
}

export function isTaskHumanRelayResponse(message: WebviewRequestMessage): message is TaskHumanRelayResponse {
  return message.type === "task.humanRelayResponse"
}

export function isTaskHumanRelayCancel(message: WebviewRequestMessage): message is TaskHumanRelayCancel {
  return message.type === "task.humanRelayCancel"
}

// ... 其他类型守卫
```

**使用示例**:
```typescript
function handleMessage(message: WebviewRequestMessage) {
  if (isTaskCreate(message)) {
    // TypeScript 知道 message 是 TaskCreate 类型
    console.log(message.text)  // OK
    console.log(message.taskId)  // Error: TaskCreate 没有 taskId 字段
  }
}
```

**验收标准**:
- 为每种消息类型提供类型守卫
- 类型守卫正确缩窄类型
- 通过 TypeScript 编译检查

### 阶段 3: 创建类型安全的消息客户端 (1周)

#### 3.1 类型安全的消息客户端

**文件**: `webview-ui/src/utils/TypedMessageBusClient.ts`

```typescript
import type { WebviewRequestMessage } from "@shared/schemas/MessageTypes"
import { vscode } from "./vscode"

export interface MessageRequestOptions {
  timeout?: number
  expectResponse?: boolean
}

export class TypedMessageBusClient {
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void
    reject: (error: Error) => void
    timeout: NodeJS.Timeout
  }>()

  private readonly defaultTimeout = 30000

  constructor() {
    this.setupMessageListener()
  }

  private setupMessageListener(): void {
    window.addEventListener("message", (event: MessageEvent) => {
      const message = event.data as any & { requestId?: string }

      if (message.requestId && this.pendingRequests.has(message.requestId)) {
        const { resolve, reject, timeout } = this.pendingRequests.get(message.requestId)!

        clearTimeout(timeout)
        this.pendingRequests.delete(message.requestId)

        if (message.error) {
          reject(new Error(message.error))
        } else {
          resolve(message)
        }
      }
    })
  }

  async send<T = any>(
    message: WebviewRequestMessage,
    options: MessageRequestOptions = {}
  ): Promise<T> {
    const { timeout = this.defaultTimeout, expectResponse = true } = options

    if (!expectResponse) {
      vscode.postMessage(message)
      return undefined as T
    }

    const requestId = this.generateRequestId()
    const messageWithId = { ...message, requestId, timestamp: Date.now() }

    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error(`Message timeout: ${message.type}`))
      }, timeout)

      this.pendingRequests.set(requestId, { resolve, reject, timeout: timeoutId })
      vscode.postMessage(messageWithId)
    })
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  dispose(): void {
    for (const { timeout, reject } of this.pendingRequests.values()) {
      clearTimeout(timeout)
      reject(new Error("TypedMessageBusClient disposed"))
    }
    this.pendingRequests.clear()
  }
}

export const typedMessageBusClient = new TypedMessageBusClient()
```

**使用示例**:
```typescript
// 类型安全的消息发送
const message: TaskCreate = MessageBuilder.createTask("Hello")
await typedMessageBusClient.send(message)

// TypeScript 会检查消息类型
// const badMessage: WebviewMessage = { type: "task.create", taskId: "123" }
// await typedMessageBusClient.send(badMessage)  // Error: WebviewMessage 不是 WebviewRequestMessage
```

**验收标准**:
- 直接发送 WebviewRequestMessage，无需转换
- 保持与现有 MessageBusClient 相同的 API
- 向后兼容
- 通过 TypeScript 编译检查

### 阶段 4: 集成验证到后端 (1周)

#### 4.1 修改 MessageBus 集成验证

**文件**: `src/core/messagebus/MessageBus.ts`

```typescript
import { schemaRegistry } from "../../shared/schemas/SchemaRegistry"
import type { WebviewRequestMessage } from "../../shared/schemas/MessageTypes"

export class MessageBus {
  // ... 现有代码

  async handle<T>(message: T): Promise<any> {
    const messageType = (message as any).type

    // 使用 Schema Registry 验证消息
    const validatedMessage = schemaRegistry.validate(messageType, message) as WebviewRequestMessage

    const handlers = this.handlers.get(messageType)

    if (!handlers || handlers.size === 0) {
      this.logger.warn(`No handler registered for message type: ${messageType}`)
      throw new Error(`No handler for message type: ${messageType}`)
    }

    this.logger.debug(`Handling message: ${messageType}`)

    try {
      const results = await Promise.all(
        Array.from(handlers).map(handler => handler(validatedMessage))
      )

      this.logger.debug(`Message handled successfully: ${messageType}`)
      return results[0]
    } catch (error) {
      this.logger.error(`Error handling message ${messageType}:`, error)
      throw error
    }
  }
}
```

#### 4.2 修改消息处理器使用类型安全的参数

**文件**: `src/core/messagebus/handlers/TaskHandlers.ts`

```typescript
import type { TaskCreate, TaskCancel, TaskClear, TaskAskResponse } from "../../../shared/schemas/MessageTypes"

export class TaskHandlers {
  // ... 现有代码

  private registerTaskCreate() {
    this.messageBus.register("task.create", async (message: TaskCreate) => {
      // TypeScript 知道 message 是 TaskCreate 类型
      const { text, images } = message  // 类型安全！

      // TypeScript 会报错！
      // const taskId = message.taskId  // Error: TaskCreate 没有 taskId 字段

      return await this.adapter.handle({ type: "newTask", text, images })
    })
  }

  private registerTaskCancel() {
    this.messageBus.register("task.cancel", async (message: TaskCancel) => {
      // TypeScript 知道 message 是 TaskCancel 类型
      const { taskId } = message  // 类型安全！

      return await this.adapter.handle({ type: "cancelTask", taskId })
    })
  }

  // ... 其他处理器
}
```

**验收标准**:
- 消息在处理前自动验证
- 处理器参数类型安全
- 验证失败时抛出明确的错误
- 通过 TypeScript 编译检查

### 阶段 5: 移除旧代码和优化 (1周)

#### 5.1 移除旧的 WebviewMessage 接口

**文件**: `src/shared/WebviewMessage.ts`

```typescript
// 移除旧的 WebviewMessage 接口
// export interface WebviewMessage { ... }

// 导出新的类型
export type { WebviewRequestMessage } from "./schemas/MessageTypes"
```

#### 5.2 移除手动转换逻辑

**文件**: `webview-ui/src/utils/MessageBusClient.ts`

```typescript
// 移除 convertToWebviewMessage 方法
// private convertToWebviewMessage(...) { ... }

// 直接发送 WebviewRequestMessage
async send<T = any>(
  message: WebviewRequestMessage,
  options: MessageRequestOptions = {}
): Promise<T> {
  // ... 直接发送，无需转换
}
```

**验收标准**:
- 移除所有手动转换逻辑
- 代码量减少 60%+
- 性能提升
- 通过 TypeScript 编译检查

### 阶段 6: 测试和文档 (1周)

#### 6.1 添加类型安全测试

**文件**: `webview-ui/src/utils/__tests__/MessageBuilder.test.ts`

```typescript
import { describe, it, expect } from "vitest"
import { MessageBuilder } from "../MessageBuilder"

describe("MessageBuilder", () => {
  it("should create valid task.create message", () => {
    const message = MessageBuilder.createTask("Hello", ["image.png"])

    expect(message.type).toBe("task.create")
    expect(message.text).toBe("Hello")
    expect(message.images).toEqual(["image.png"])
  })

  it("should have correct type", () => {
    const message = MessageBuilder.createTask("Hello")

    // TypeScript 类型检查
    const typedMessage: TaskCreate = message  // OK

    // TypeScript 类型检查
    // const badMessage: TaskCancel = message  // Error: 类型不匹配
  })

  it("should enforce required fields", () => {
    // TypeScript 会报错！缺少必需参数
    // MessageBuilder.createTask()  // Error: text 是必需的
  })

  it("should enforce field types", () => {
    // TypeScript 会报错！类型不匹配
    // MessageBuilder.createTask(123)  // Error: text 应该是 string
    // MessageBuilder.createTask("Hello", [123])  // Error: images 应该是 string[]
  })
})
```

#### 6.2 添加集成测试

**文件**: `src/core/messagebus/__tests__/integration/type-safety.test.ts`

```typescript
import { describe, it, expect } from "vitest"
import { MessageBusServer } from "../MessageBusServer"
import { TypedMessageBusClient } from "../../../../webview-ui/src/utils/TypedMessageBusClient"
import { MessageBuilder } from "../../../../webview-ui/src/utils/MessageBuilder"
import type { TaskCreate } from "../../../../shared/schemas/MessageTypes"

describe("Type Safety Integration", () => {
  it("should send and receive type-safe messages", async () => {
    const server = new MessageBusServer(outputChannel, { webview })
    const client = new TypedMessageBusClient()

    server.register("task.create", async (msg: TaskCreate) => {
      // TypeScript 知道 msg 是 TaskCreate 类型
      expect(msg.text).toBe("Hello")
      expect(msg.images).toEqual(["image.png"])

      // TypeScript 会报错！
      // expect(msg.taskId).toBe("123")  // Error: TaskCreate 没有 taskId 字段

      return { type: "task.created", taskId: "123" }
    })

    const message = MessageBuilder.createTask("Hello", ["image.png"])
    const result = await client.send(message)

    expect(result).toEqual({ type: "task.created", taskId: "123" })
  })

  it("should validate message structure at runtime", async () => {
    const server = new MessageBusServer(outputChannel, { webview })
    const client = new TypedMessageBusClient()

    server.register("task.create", async (msg: TaskCreate) => {
      return { type: "task.created", taskId: "123" }
    })

    // 发送无效的消息结构
    const badMessage = {
      type: "task.create",
      taskId: "123"  // 错误的字段
    }

    await expect(client.send(badMessage)).rejects.toThrow()
  })
})
```

**验收标准**:
- 单元测试覆盖率 > 90%
- 集成测试覆盖率 > 80%
- 所有测试通过
- 类型安全测试完整

## 时间估算

| 阶段 | 时间估算 | 关键路径 |
|------|---------|---------|
| 阶段 1: 创建共享的 Zod Schema 定义 | 1 周 | Zod Schema 定义 |
| 阶段 2: 创建类型安全的消息构建器 | 1 周 | 消息构建器 |
| 阶段 3: 创建类型安全的消息客户端 | 1 周 | 消息客户端 |
| 阶段 4: 集成验证到后端 | 1 周 | MessageBus 集成 |
| 阶段 5: 移除旧代码和优化 | 1 周 | 移除旧代码 |
| 阶段 6: 测试和文档 | 1 周 | 类型安全测试 |
| **总计** | **6 周** | **4 周** |

## 预期效果

### 编译时类型安全

**前端代码**:
```typescript
// TypeScript 会报错！
const badMessage = MessageBuilder.createTask("Hello", 123)  // Error: images 应该是 string[]
```

**后端代码**:
```typescript
this.messageBus.register("task.create", async (message: TaskCreate) => {
  // TypeScript 会报错！
  const taskId = message.taskId  // Error: TaskCreate 没有 taskId 字段
})
```

### 运行时验证

```typescript
// 发送无效的消息结构
const badMessage = {
  type: "task.create",
  taskId: "123"  // 错误的字段
}

// 运行时验证失败
await typedMessageBusClient.send(badMessage)  // Error: Invalid message structure
```

### 开发体验提升

- **自动补全**: IDE 提供准确的自动补全
- **类型提示**: 清晰的类型提示和文档
- **错误提示**: 明确的编译时错误提示
- **重构支持**: 安全的重构和代码导航

### 代码质量提升

- **代码量减少 50%**: 从 1990 行减少到约 950 行
- **类型安全**: 完整的编译时和运行时类型安全
- **可维护性**: 单一真理来源，易于维护

## 总结

通过使用 Zod Schema 作为单一真理来源，自动生成 TypeScript 类型，我们实现了：

1. **完整的编译时类型安全**: 前端和后端代码都能得到静态类型检查
2. **运行时验证**: 使用 Zod schema 确保消息结构正确
3. **类型推断**: IDE 提供准确的自动补全和类型提示
4. **单一真理来源**: Zod schema 是类型定义的唯一来源
5. **前后端类型一致**: 自动生成的类型确保前后端完全一致

这个方案真正解决了前后端集成的类型安全问题，让前端代码能够得到完整的静态类型检查。
