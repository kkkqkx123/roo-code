# Eval模块简化方案

## 目标
将当前的分布式评估系统简化为本地单机版本，移除Redis和PostgreSQL依赖，改用SQLite数据库。

## 架构变化

### 当前架构（分布式）
```
Web界面 ←→ Redis(Pub/Sub) ←→ 控制器 ←→ PostgreSQL
                    ↓
              多个运行器容器
```

### 简化架构（单机）
```
CLI ←→ 本地控制器 ←→ SQLite数据库
          ↓
     本地任务执行
```

## 具体修改方案

### 1. 数据库迁移 PostgreSQL → SQLite

**当前依赖**：
```json
"drizzle-orm": "^0.44.1",
"postgres": "^3.4.7"
```

**替换为**：
```json
"drizzle-orm": "^0.44.1",
"better-sqlite3": "^9.2.2",
"@types/better-sqlite3": "^7.6.8"
```

**代码修改**：
```typescript
// 原代码 (src/db/db.ts)
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
const pgClient = postgres(process.env.DATABASE_URL!, { prepare: false })
const client = drizzle({ client: pgClient, schema })

// 新代码
import { drizzle } from "drizzle-orm/better-sqlite3"
import Database from "better-sqlite3"
const sqlite = new Database('./evals.db')
const client = drizzle({ client: sqlite, schema })
```

**Schema修改**：
```typescript
// 原代码 (src/db/schema.ts)
import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core"
export const runs = pgTable("runs", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  // ...
})

// 新代码
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
export const runs = sqliteTable("runs", {
  id: integer().primaryKey({ autoIncrement: true }),
  // ...
})
```

### 2. 移除Redis依赖

**移除依赖**：
```json
// 移除
"redis": "^5.5.5"
```

**功能替代**：

| Redis功能 | 单机替代方案 | 实现文件 |
|-----------|-------------|----------|
| 心跳监控 | 进程内定时器 | `src/cli/localHeartbeat.ts` |
| 运行器注册 | 内存集合 | `src/cli/localRegistry.ts` |
| 事件发布 | 本地事件总线 | `src/cli/eventBus.ts` |

**心跳监控替代**：
```typescript
// src/cli/localHeartbeat.ts
export class LocalHeartbeat {
  private timers = new Map<number, NodeJS.Timeout>()
  
  async start(runId: number, seconds: number = 10) {
    const timer = setInterval(() => {
      this.updateHeartbeat(runId)
    }, (seconds * 1000) / 2)
    this.timers.set(runId, timer)
    return timer
  }
  
  stop(runId: number) {
    const timer = this.timers.get(runId)
    if (timer) {
      clearInterval(timer)
      this.timers.delete(runId)
    }
  }
  
  private updateHeartbeat(runId: number) {
    // 更新内存中的心跳状态
    heartbeatStore.set(runId, Date.now())
  }
}
```

**运行器注册替代**：
```typescript
// src/cli/localRegistry.ts
export class LocalRunnerRegistry {
  private runners = new Set<string>()
  
  register(runId: number, taskId: number) {
    this.runners.add(`${runId}-${taskId}`)
  }
  
  deregister(runId: number, taskId: number) {
    this.runners.delete(`${runId}-${taskId}`)
  }
  
  getActiveCount(runId: number): number {
    return Array.from(this.runners)
      .filter(id => id.startsWith(`${runId}-`)).length
  }
}
```

### 3. CLI简化

**移除容器化检查**：
```typescript
// src/cli/runEvals.ts 修改
// 移除: const containerized = isDockerContainer()
// 移除: if (!containerized) { await resetEvalsRepo(...) }
// 移除: if (!containerized) { await commitEvalsRepoChanges(...) }

// 简化为直接本地执行
await resetEvalsRepo({ run, cwd: EVALS_REPO_PATH })
await commitEvalsRepoChanges({ run, cwd: EVALS_REPO_PATH })
```

**简化运行模式**：
```typescript
// src/cli/index.ts 修改
// 移除分布式相关的复杂参数
// 仅保留核心功能：运行评估任务
const main = async () => {
  await run(
    command({
      name: "eval",
      description: "运行本地评估任务",
      args: {
        runId: option({ type: number, long: "runId", short: "r" }),
        exercise: option({ type: string, long: "exercise", short: "e" }),
        language: option({ type: string, long: "language", short: "l" }),
      },
      handler: async (args) => {
        const { runId, exercise, language } = args
        
        if (runId) {
          await runEvals(runId)
        } else if (exercise && language) {
          await runSingleExercise(language, exercise)
        } else {
          throw new Error("需要提供runId或exercise+language参数")
        }
      },
    }),
    process.argv.slice(2),
  )
}
```

### 4. 配置简化

**环境变量简化**：
```bash
# 原配置（复杂）
DATABASE_URL=postgres://postgres:password@localhost:5433/evals_development
EVALS_DB_PORT=5433
EVALS_REDIS_PORT=6380

# 新配置（简单）
EVALS_DB_PATH=./evals.db
EVALS_REPO_PATH=./evals
```

**脚本简化**：
```json
{
  "scripts": {
    // 移除所有Docker相关脚本
    "cli": "tsx src/cli/index.ts",
    "db:init": "tsx src/db/init.ts",
    "db:migrate": "tsx src/db/migrate.ts"
  }
}
```

### 5. 文件结构变化

**移除的文件**：
- `docker-compose.yml` - 不再需要容器化
- `Dockerfile.*` - 移除所有Docker文件
- `src/cli/redis.ts` - Redis相关代码
- `.env.*` - 简化配置

**新增的文件**：
- `src/cli/localHeartbeat.ts` - 本地心跳实现
- `src/cli/localRegistry.ts` - 本地注册表
- `src/cli/eventBus.ts` - 本地事件总线
- `src/db/init.ts` - SQLite初始化脚本

## 迁移步骤

1. **备份现有数据**：导出PostgreSQL数据
2. **创建SQLite数据库**：运行新的初始化脚本
3. **迁移数据**：将现有数据导入SQLite
4. **测试功能**：验证核心评估功能
5. **更新文档**：修改相关文档说明

## 优势

- **零依赖**：仅需Node.js环境
- **快速启动**：无需服务配置
- **易于维护**：代码量减少50%+
- **便携性**：单文件数据库
- **调试友好**：本地运行，无网络问题

## 限制

- **单机使用**：不支持分布式部署
- **并发限制**：受限于单机性能
- **无实时Web界面**：仅CLI操作
- **无高可用性**：单点故障风险

## 适用场景

- 个人开发和测试
- 小规模评估任务
- CI/CD集成
- 教学演示
- 快速原型验证