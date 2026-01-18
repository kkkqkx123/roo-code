## 依赖注入实现分析报告

基于对 [`src/core/task/TaskContainer.ts`](src/core/task/TaskContainer.ts:1) 的深入分析，**当前不建议引入 InversifyJS**。以下是详细评估：

### 当前实现现状

**TaskContainer** 是一个轻量级服务定位器模式实现（133行代码）：

**核心特性：**
- ✅ 基于 Symbol 的令牌系统，避免命名冲突
- ✅ 手动注册模式（见 [`Task.ts:816-1000`](src/core/task/Task.ts:816)）
- ✅ 手动解析模式（见 [`Task.ts:1110-1187`](src/core/task/Task.ts:1110)）
- ✅ 完善的异步/同步资源清理机制
- ✅ 19个服务的依赖管理（TOKENS 定义）

**使用示例：**
```typescript
// 注册服务
this.container.register(TOKENS.TaskStateManager, stateManager)

// 获取服务
private get stateManager(): TaskStateManager {
    return this.container.get(TOKENS.TaskStateManager)
}
```

### 引入 InversifyJS 的利弊分析

**InversifyJS 优势：**
- 🎯 自动构造函数依赖注入
- 🎯 多种生命周期管理（单例/瞬态/请求作用域）
- 🎯 编译时类型安全检查
- 🎯 装饰器驱动，代码更简洁

**引入成本与风险：**
- ⚠️ **性能开销**：反射元数据增加运行时负担
- ⚠️ **构建复杂度**：需配置 `emitDecoratorMetadata`
- ⚠️ **代码侵入性**：需修改约20个管理器类
- ⚠️ **学习曲线**：团队需掌握装饰器和容器配置
- ⚠️ **包体积增加**：inversify + reflect-metadata 依赖

### 关键决策点

**不建议引入的核心原因：**

1. **复杂度不匹配**：当前依赖关系扁平（仅1层深度），手动管理更清晰直观
2. **性能敏感**：VS Code 扩展对启动速度和内存占用要求严格
3. **迁移成本高**：需重构所有服务类的构造函数和注册逻辑
4. **当前方案已足够**：服务定位器模式完全满足现有需求
5. **维护成本**：自定义实现更易于调试和定制

### 优化建议（不引入 InversifyJS）

如要改进当前实现，可考虑：

1. **增强 Provider 模式**：
```typescript
// 支持延迟初始化
container.registerProvider(TOKENS.HeavyService, () => new HeavyService())
```

2. **添加作用域支持**：
```typescript
// 支持请求作用域服务
container.registerScoped(TOKENS.RequestService, RequestService)
```

3. **依赖验证**：
```typescript
// 在开发环境验证所有依赖可解析
container.validate()
```

### 未来引入时机

仅当满足以下条件时考虑引入 InversifyJS：

- [ ] 服务数量 > 50个
- [ ] 出现深层依赖嵌套（>3层）
- [ ] 需要单元测试 mock 依赖
- [ ] 跨模块/跨扩展共享服务
- [ ] 团队熟悉装饰器模式

### 结论

**保持当前实现**，理由：
- 代码简洁（133行 vs InversifyJS 的复杂配置）
- 无外部依赖，完全可控
- 性能最优
- 符合 KISS 原则
- 满足所有当前需求

当前 TaskContainer 是**恰到好处**的解决方案，既提供了依赖解耦，又保持了代码简洁性和运行效率。