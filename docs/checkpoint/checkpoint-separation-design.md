# 检查点机制分离设计方案

## 设计概述

本方案旨在将现有的检查点机制分离为两个独立的子系统：
- **文件检查点系统**：基于Git的版本控制，负责文件系统的状态保存和恢复
- **上下文检查点系统**：基于内存快照，负责AI任务上下文的状态保存和恢复

通过这种分离，我们可以实现更精细的控制、更好的性能和更清晰的架构设计。

## 当前架构分析

### 现有混合检查点机制

当前检查点机制将文件和上下文状态混合管理：

```typescript
// 当前混合的检查点管理器
class CheckpointManager {
    private apiContextSnapshots: Map<string, ApiCallContextSnapshot> = new Map()
    
    async checkpointSave(force: boolean = false): Promise<void> {
        // 同时保存文件状态和上下文状态
        await checkpointSave(this.stateManager, force)
    }
    
    async checkpointRestoreExtended(options: CheckpointRestoreOptionsExtended): Promise<void> {
        // 同时恢复文件状态和上下文状态
        await checkpointRestore(this.stateManager, options)
        if (options.restoreApiContext) {
            await this.restoreApiContext(snapshot)
        }
    }
}
```

### 存在的问题

1. **职责不清晰**：单一管理器负责多个不同性质的状态管理
2. **性能影响**：上下文快照保存可能影响文件检查点性能
3. **扩展困难**：添加新的状态类型需要修改核心管理器
4. **配置复杂**：用户难以理解不同恢复选项的含义

## 分离方案设计

### 1. 架构分离

#### 文件检查点系统 (FileCheckpointSystem)
```typescript
interface FileCheckpointSystem {
    // 文件状态管理
    saveFileCheckpoint(message: string, options?: FileCheckpointOptions): Promise<FileCheckpointResult>
    restoreFileCheckpoint(checkpointId: string, options?: FileRestoreOptions): Promise<void>
    getFileDiffs(checkpointId: string, options?: DiffOptions): Promise<FileDiff[]>
    
    // 文件历史管理
    listFileCheckpoints(): Promise<FileCheckpoint[]>
    deleteFileCheckpoint(checkpointId: string): Promise<void>
    cleanupOldFileCheckpoints(maxAge: number): Promise<void>
}
```

#### 上下文检查点系统 (ContextCheckpointSystem)
```typescript
interface ContextCheckpointSystem {
    // 上下文状态管理
    saveContextSnapshot(snapshotId: string, context: TaskContext): Promise<void>
    restoreContextSnapshot(snapshotId: string): Promise<TaskContext>
    
    // 上下文关联管理
    linkContextToFileCheckpoint(contextId: string, fileCheckpointId: string): Promise<void>
    getContextsForFileCheckpoint(fileCheckpointId: string): Promise<ContextSnapshot[]>
    
    // 上下文历史管理
    listContextSnapshots(): Promise<ContextSnapshot[]>
    deleteContextSnapshot(snapshotId: string): Promise<void>
}
```

### 2. 统一管理接口

#### 协调器模式 (CheckpointCoordinator)
```typescript
class CheckpointCoordinator {
    private fileSystem: FileCheckpointSystem
    private contextSystem: ContextCheckpointSystem
    
    // 统一保存接口
    async saveUnifiedCheckpoint(options: UnifiedCheckpointOptions): Promise<UnifiedCheckpointResult> {
        const results: UnifiedCheckpointResult = {}
        
        // 并行保存文件和上下文
        if (options.saveFiles) {
            results.fileCheckpoint = await this.fileSystem.saveFileCheckpoint(
                options.message, 
                options.fileOptions
            )
        }
        
        if (options.saveContext) {
            results.contextSnapshot = await this.contextSystem.saveContextSnapshot(
                options.snapshotId,
                options.context
            )
        }
        
        // 建立关联关系
        if (results.fileCheckpoint && results.contextSnapshot) {
            await this.contextSystem.linkContextToFileCheckpoint(
                results.contextSnapshot.id,
                results.fileCheckpoint.id
            )
        }
        
        return results
    }
    
    // 统一恢复接口
    async restoreUnifiedCheckpoint(options: UnifiedRestoreOptions): Promise<void> {
        // 根据恢复类型执行不同的恢复策略
        switch (options.restoreType) {
            case "files_only":
                await this.fileSystem.restoreFileCheckpoint(options.checkpointId)
                break
                
            case "context_only":
                const context = await this.contextSystem.restoreContextSnapshot(options.snapshotId)
                await this.applyContextToTask(context)
                break
                
            case "files_and_context":
                await this.fileSystem.restoreFileCheckpoint(options.checkpointId)
                const context = await this.contextSystem.restoreContextSnapshot(options.snapshotId)
                await this.applyContextToTask(context)
                break
                
            // Note: context_with_current_files was removed as it was functionally identical to context_only
        }
    }
}
```

### 3. 类型定义扩展

#### 新的类型定义
```typescript
// 检查点类型枚举
export enum CheckpointType {
    FILE_ONLY = "file_only",
    CONTEXT_ONLY = "context_only", 
    UNIFIED = "unified"
}

// 恢复类型枚举
export enum RestoreType {
    FILES_ONLY = "files_only",
    CONTEXT_ONLY = "context_only",
    FILES_AND_CONTEXT = "files_and_context"
}

// 统一检查点选项
interface UnifiedCheckpointOptions {
    type: CheckpointType
    message: string
    saveFiles: boolean
    saveContext: boolean
    snapshotId?: string
    context?: TaskContext
    fileOptions?: FileCheckpointOptions
}

// 统一恢复选项
interface UnifiedRestoreOptions {
    restoreType: RestoreType
    checkpointId?: string
    snapshotId?: string
    targetTaskState?: Partial<TaskState>
}
```

### 4. UI组件修改

#### 增强的检查点菜单
```typescript
// 扩展的检查点菜单组件
const CheckpointMenu: React.FC<CheckpointMenuProps> = ({ checkpoint, onRestore }) => {
    const [restoreType, setRestoreType] = useState<RestoreType>(RestoreType.FILES_ONLY)
    
    const restoreOptions = [
        {
            value: RestoreType.FILES_ONLY,
            label: "仅恢复文件",
            description: "将项目文件恢复到此检查点状态，保持当前对话上下文"
        },
        {
            value: RestoreType.CONTEXT_ONLY,
            label: "仅恢复上下文", 
            description: "恢复对话上下文到此检查点状态，保持当前文件状态"
        },
        {
            value: RestoreType.FILES_AND_CONTEXT,
            label: "恢复文件和上下文",
            description: "完全恢复到检查点状态，包括文件和对话上下文"
        },
        {
            value: RestoreType.CONTEXT_WITH_CURRENT_FILES,
            label: "恢复上下文（保持当前文件）",
            description: "恢复对话上下文，但保持当前的文件修改状态"
        }
    ]
    
    const handleRestore = () => {
        onRestore({
            restoreType,
            checkpointId: checkpoint.id,
            snapshotId: checkpoint.contextSnapshotId
        })
    }
    
    return (
        <div className="checkpoint-menu">
            <div className="restore-options">
                {restoreOptions.map(option => (
                    <RadioGroup.Item 
                        key={option.value}
                        value={option.value}
                        checked={restoreType === option.value}
                        onChange={() => setRestoreType(option.value)}
                    >
                        <div className="option-content">
                            <div className="option-label">{option.label}</div>
                            <div className="option-description">{option.description}</div>
                        </div>
                    </RadioGroup.Item>
                ))}
            </div>
            
            <Button onClick={handleRestore} variant="primary">
                确认恢复
            </Button>
        </div>
    )
}
```

### 5. 实现迁移策略

#### 阶段1：并行运行（兼容性）
```typescript
// 过渡期的CheckpointManager
class TransitionalCheckpointManager {
    private legacyManager: LegacyCheckpointManager
    private newCoordinator: CheckpointCoordinator
    
    async checkpointSave(force: boolean = false): Promise<void> {
        // 同时调用新旧系统，保持兼容性
        await this.legacyManager.checkpointSave(force)
        await this.newCoordinator.saveUnifiedCheckpoint({
            type: CheckpointType.UNIFIED,
            message: `Task: ${this.taskId}, Time: ${Date.now()}`,
            saveFiles: true,
            saveContext: true
        })
    }
}
```

#### 阶段2：逐步迁移
1. 先迁移上下文检查点功能到新系统
2. 再迁移文件检查点功能
3. 最后移除旧系统依赖

#### 阶段3：完全分离
- 移除混合检查点管理器
- 使用新的协调器作为统一入口
- 优化性能和存储策略

## 技术优势

### 1. 性能优化
- **并行处理**：文件和上下文可以并行保存/恢复
- **选择性恢复**：用户可以选择只恢复需要的部分
- **存储优化**：上下文快照可以更轻量级存储

### 2. 架构清晰
- **单一职责**：每个系统专注于特定类型的状态管理
- **模块化设计**：易于扩展新的状态类型
- **接口清晰**：明确的API边界和错误处理

### 3. 用户体验
- **直观选择**：清晰的恢复选项说明
- **灵活控制**：支持多种恢复组合
- **错误恢复**：部分失败时仍可恢复可用部分

### 4. 可维护性
- **独立测试**：每个系统可以独立测试
- **版本控制**：文件和上下文可以独立版本化
- **监控指标**：可以分别监控性能和可靠性

## 实现计划

### 阶段1：基础架构（2-3周）
1. 定义新的类型系统和接口
2. 实现ContextCheckpointSystem
3. 创建CheckpointCoordinator
4. 更新UI组件类型定义

### 阶段2：功能迁移（3-4周）
1. 迁移上下文快照功能到新系统
2. 实现并行运行模式
3. 更新恢复处理逻辑
4. 添加测试覆盖

### 阶段3：优化完善（2-3周）
1. 性能优化和缓存策略
2. 错误处理和回滚机制
3. 用户文档和帮助说明
4. 最终测试和部署

## 风险评估

### 技术风险
- **兼容性问题**：确保与现有检查点机制兼容
- **数据迁移**：需要安全的数据迁移策略
- **性能回归**：避免引入性能问题

### 缓解措施
- **渐进式迁移**：分阶段实施，降低风险
- **充分测试**：全面的单元测试和集成测试
- **回滚计划**：准备完善的回滚方案

## 总结

本分离方案通过将文件和上下文检查点机制解耦，提供了更清晰、更灵活、更高性能的检查点管理系统。通过协调器模式统一管理，既保持了用户体验的一致性，又实现了技术架构的优化。这种设计为未来的功能扩展奠定了良好的基础。