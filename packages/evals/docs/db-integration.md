## 数据库集成架构概述
### 技术栈
- ORM 框架 ：Drizzle ORM（PostgreSQL 专用）
- 数据库 ：PostgreSQL 15.4
- 连接库 ：postgres.js
- 迁移管理 ：Drizzle Kit
- 容器化 ：Docker Compose
## 核心数据模型设计
### 1. 运行表 (runs)
```
// 核心概念：一次完整的评估运行
runs: pgTable("runs", {
    id: integer().primaryKey().
    generatedAlwaysAsIdentity(),
    model: text().notNull
    (),           // AI 模型名称
    name: text
    (),                      // 运行名
    称
    description: text
    (),               // 运行描述
    settings: jsonb().
    $type<RooCodeSettings>(), // Roo 
    Code 配置
    concurrency: integer().default
    (2), // 并发度
    timeout: integer().default
    (5),     // 超时时间（分钟）
    passed: integer().default
    (0),      // 通过的任务数
    failed: integer().default
    (0),      // 失败的任务数
    createdAt: timestamp().notNull(),
})
```
### 2. 任务表 (tasks)
```
// 核心概念：单个编程练习任务
tasks: pgTable("tasks", {
    id: integer().primaryKey().
    generatedAlwaysAsIdentity(),
    runId: integer().references(() => 
    runs.id, { onDelete: "cascade" }),
    language: text().notNull().
    $type<ExerciseLanguage>(), // 编程
    语言
    exercise: text().notNull
    (),      // 练习名称
    iteration: integer().default
    (1), // 迭代次数（重试机制）
    passed: boolean
    (),               // 是否通过
    startedAt: timestamp
    (),          // 开始时间
    finishedAt: timestamp
    (),         // 完成时间
})
```
### 3. 任务指标表 (taskMetrics)
```
// 核心概念：任务的性能和使用指标
taskMetrics: pgTable("taskMetrics", {
    id: integer().primaryKey().
    generatedAlwaysAsIdentity(),
    tokensIn: integer().notNull
    (),      // 输入 token 数
    tokensOut: integer().notNull
    (),     // 输出 token 数
    tokensContext: integer().notNull
    (), // 上下文 token 数
    cacheWrites: integer().notNull
    (),   // 缓存写入次数
    cacheReads: integer().notNull
    (),    // 缓存读取次数
    cost: real().notNull
    (),             // API 成本
    duration: integer().notNull
    (),        // 执行时间（毫秒）
    toolUsage: jsonb().
    $type<ToolUsage>(), // 工具使用情况
    统计
})
```
### 4. 工具错误表 (toolErrors)
```
// 核心概念：工具执行错误记录
toolErrors: pgTable("toolErrors", {
    id: integer().primaryKey().
    generatedAlwaysAsIdentity(),
    runId: integer().references(() => 
    runs.id, { onDelete: "cascade" }),
    taskId: integer().references(() 
    => tasks.id, { onDelete: 
    "cascade" }),
    toolName: text().notNull().
    $type<ToolName>(), // 工具名称
    error: text().notNull
    (),                      // 错误信
    息
})
```
## 数据库连接管理
### 多环境支持
```
// 主数据库连接
const pgClient = postgres(process.env.
DATABASE_URL!, { prepare: false })
const client = drizzle({ client: 
pgClient, schema })

// 测试环境验证
if (process.env.NODE_ENV === "test") {
    if (!process.env.DATABASE_URL!.
    includes("test") || !process.env.
    DATABASE_URL!.includes
    ("localhost")) {
        throw new Error("DATABASE_URL 
        is not a test database")
    }
}

// 生产数据库连接（按需创建）
const getProductionClient = () => {
    if (!process.env.
    PRODUCTION_DATABASE_URL) {
        throw new Error
        ("PRODUCTION_DATABASE_URL is 
        not set")
    }
    
    if (!_productionClient) {
        _productionPgClient = postgres
        (process.env.
        PRODUCTION_DATABASE_URL, { 
        prepare: false })
        _productionClient = drizzle({ 
        client: _productionPgClient, 
        schema })
    }
    
    return _productionClient
}
```
## 查询层设计模式
### 1. 错误处理模式
```
// 统一的错误处理
export class RecordNotFoundError 
extends Error {}
export class RecordNotCreatedError 
extends Error {}

export const findRun = async (id: 
number) => {
    const run = await db.query.runs.
    findFirst({ where: eq(schema.runs.
    id, id) })
    
    if (!run) {
        throw new RecordNotFoundError
        ()
    }
    
    return run
}
```
### 2. 关系查询优化
```
// 使用 Drizzle 的关系查询功能
export const getTasks = async (runId: 
number) =>
    db.query.tasks.findMany({
        where: eq(tasks.runId, runId),
        with: { taskMetrics: 
        true },  // 自动关联查询
        orderBy: asc(tasks.id),
    })
```
### 3. 复杂聚合查询
```
// 计算运行的总体统计
export const finishRun = async 
(runId: number) => {
    const [values] = await db
        .select({
            tokensIn: sum(schema.
            taskMetrics.tokensIn).
            mapWith(Number),
            tokensOut: sum(schema.
            taskMetrics.tokensOut).
            mapWith(Number),
            tokensContext: sum(schema.
            taskMetrics.
            tokensContext).mapWith
            (Number),
            cacheWrites: sum(schema.
            taskMetrics.cacheWrites).
            mapWith(Number),
            cacheReads: sum(schema.
            taskMetrics.cacheReads).
            mapWith(Number),
            cost: sum(schema.
            taskMetrics.cost).mapWith
            (Number),
            duration: sum(schema.
            taskMetrics.duration).
            mapWith(Number),
            passed: sql<number>`sum
            (CASE WHEN ${schema.tasks.
            passed} THEN 1 ELSE 0 END)
            `,
            failed: sql<number>`sum
            (CASE WHEN ${schema.tasks.
            passed} THEN 0 ELSE 1 END)
            `,
        })
        .from(schema.taskMetrics)
        .innerJoin(schema.tasks, eq
        (schema.taskMetrics.id, 
        schema.tasks.taskMetricsId))
        .innerJoin(schema.runs, eq
        (schema.tasks.runId, schema.
        runs.id))
        .where(eq(schema.runs.id, 
        runId))
}
```
## 迁移管理
### Drizzle Kit 配置
```
export default defineConfig({
    out: "./src/db/migrations",
    schema: "./src/db/schema.ts",
    dialect: "postgresql",
    dbCredentials: { url: process.env.
    DATABASE_URL! },
    verbose: true,
    strict: true,
})
```
### 迁移历史
从 _journal.json 可以看到有 6 个迁移版本，包括：

- 0000_young_trauma：初始表结构
- 0001_lowly_captain_flint：添加超时字段
- 0002_bouncy_blazing_skull：其他优化
- ...（后续迁移）
## 容器化部署
### Docker Compose 配置
```
services:
    db:
        container_name: evals-db
        image: postgres:15.4
        ports:
            - "${EVALS_DB_PORT:-5432}
            :5432"
        volumes:
            - ./.docker/postgres:/var/
            lib/postgresql/data
            - ./.docker/scripts/
            postgres:/
            docker-entrypoint-initdb.d
        environment:
            - POSTGRES_USER=postgres
            - 
            POSTGRES_PASSWORD=password
            - 
            POSTGRES_DATABASES=evals_d
            evelopment,evals_test
```
## 数据流分析
### 评估运行流程
1. 创建运行记录 → createRun()
2. 创建任务记录 → createTask()
3. 执行任务 → 更新 startedAt
4. 记录指标 → createTaskMetrics()
5. 更新任务状态 → updateTask()
6. 完成运行 → finishRun() （汇总统计）
### 工具错误追踪
```
// 在任务执行过程中记录工具错误
if (eventName === RooCodeEventName.
TaskToolFailed) {
    const [_taskId, toolName, error] 
    = payload
    await createToolError({ taskId: 
    task.id, toolName, error })
}
```
## 设计亮点
### 1. 类型安全
- 使用 Drizzle ORM 的 TypeScript 集成
- 所有查询都有完整的类型推断
- 与 @roo-code/types 集成，确保数据一致性
### 2. 性能优化
- 使用 PostgreSQL 的 JSONB 类型存储复杂数据
- 合理的索引设计（唯一索引 on tasks）
- 批量操作支持
### 3. 可扩展性
- 支持多环境（开发、测试、生产）
- 模块化查询设计
- 易于添加新的数据表和关系
### 4. 错误处理
- 统一的异常处理模式
- 详细的错误日志记录
- 事务支持（通过 Drizzle）
### 5. 数据完整性
- 外键约束确保数据一致性
- 级联删除防止孤立记录
- 时间戳追踪完整的生命周期
这个数据库集成设计体现了现代 TypeScript 应用的最佳实践，结合了 Drizzle ORM 的类型安全性和 PostgreSQL 的强大功能，为 Roo Code 的评估系统提供了可靠的数据持久化基础。