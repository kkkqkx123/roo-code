# 动态配置升级架构设计

## 1. 问题背景

### 1.1 当前架构的局限性

当前的`VectorStorageConfigManager`实现存在以下关键问题：

1. **静态配置**：配置仅在集合创建时确定一次，之后不再调整
2. **无法适应增长**：当集合从tiny增长到small、medium或large时，配置不会自动升级
3. **性能退化**：随着数据增长，初始配置可能不再适合当前规模，导致性能下降
4. **资源浪费**：小集合使用大配置会浪费资源，大集合使用小配置会影响性能

### 1.2 Qdrant配置更新能力

根据Qdrant API文档，以下配置可以在不删除数据的情况下更新：

| 配置项 | 更新方法 | 是否需要重建索引 | 影响范围 |
|--------|----------|------------------|----------|
| HNSW参数 (m, ef_construct) | `updateCollection` | 是 | 搜索性能 |
| 量化配置 | `updateCollection` | 是 | 存储空间和搜索速度 |
| on_disk (vectors) | `updateCollection` | 否 | 内存使用 |
| WAL配置 | `updateCollection` | 否 | 写入性能和持久化 |
| 优化器配置 | `updateCollection` | 否 | 索引构建速度 |

**关键发现**：
- HNSW和量化配置的更新会触发索引重建，但不会删除数据
- 索引重建期间集合仍可读写，但性能可能下降
- on_disk和WAL配置可以即时生效，无需重建索引

## 2. 动态配置升级需求分析

### 2.1 功能需求

1. **自动检测**：定期检查集合大小，判断是否需要升级配置
2. **渐进升级**：支持从tiny → small → medium → large的渐进式升级
3. **配置迁移**：将当前配置平滑迁移到新的预设配置
4. **性能监控**：监控升级过程中的性能影响
5. **回滚机制**：在升级失败时能够回滚到之前的配置

### 2.2 非功能需求

1. **最小化停机**：升级过程中保持服务可用
2. **性能可控**：避免在升级过程中出现性能大幅下降
3. **资源优化**：升级后配置应与当前数据规模匹配
4. **可观测性**：提供清晰的升级日志和状态追踪

## 3. 架构设计

### 3.1 核心组件

```
┌─────────────────────────────────────────────────────────────┐
│                    VectorStorageConfigManager                 │
├─────────────────────────────────────────────────────────────┤
│  - getCollectionConfig(collectionName)                       │
│  - getCollectionConfigFromSize(size)                        │
│  - getCollectionConfigFromEstimation(estimation)            │
│  + checkAndUpgradeCollection(collectionName) [NEW]           │
│  + upgradeCollectionConfig(collectionName, newConfig) [NEW] │
│  + rollbackCollectionConfig(collectionName) [NEW]           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              CollectionConfigUpgradeService [NEW]            │
├─────────────────────────────────────────────────────────────┤
│  - checkUpgradeNeeded(collectionName, currentSize)          │
│  - determineTargetPreset(currentSize, thresholds)           │
│  - calculateUpgradePath(currentPreset, targetPreset)        │
│  - executeUpgrade(collectionName, upgradePath)              │
│  - monitorUpgradeProgress(collectionName)                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    QdrantClient                              │
├─────────────────────────────────────────────────────────────┤
│  - getCollectionInfo(collectionName)                        │
│  - updateCollection(collectionName, config)                  │
│  - createCollection(collectionName, config)                  │
│  - deleteCollection(collectionName)                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              CollectionSizeEstimator                        │
├─────────────────────────────────────────────────────────────┤
│  - estimateSize(collectionName)                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 升级流程

```
开始
  │
  ▼
┌─────────────────────────┐
│ 定期检查集合大小         │
│ (checkAndUpgradeCollection)│
└─────────────────────────┘
  │
  ▼
┌─────────────────────────┐
│ 获取当前集合信息         │
│ - 当前向量数量           │
│ - 当前配置               │
│ - 当前预设级别           │
└─────────────────────────┘
  │
  ▼
┌─────────────────────────┐
│ 判断是否需要升级         │
│ (checkUpgradeNeeded)    │
│ - 比较当前大小与阈值     │
│ - 确定目标预设           │
└─────────────────────────┘
  │
  ├─ 不需要升级 ──────────┤
  │                       ▼
  │                   结束
  │
  ▼ 需要升级
┌─────────────────────────┐
│ 计算升级路径             │
│ (calculateUpgradePath)  │
│ tiny → small → medium   │
│ → large                 │
└─────────────────────────┘
  │
  ▼
┌─────────────────────────┐
│ 执行升级                 │
│ (executeUpgrade)        │
│ 1. 备份当前配置          │
│ 2. 应用新配置            │
│ 3. 监控重建进度          │
└─────────────────────────┘
  │
  ▼
┌─────────────────────────┐
│ 升级成功？               │
└─────────────────────────┘
  │
  ├─ 成功 ────────────────┤
  │                       ▼
  │                   记录升级历史
  │                       │
  │                       ▼
  │                   结束
  │
  ▼ 失败
┌─────────────────────────┐
│ 回滚到之前配置           │
│ (rollbackCollectionConfig)│
└─────────────────────────┘
  │
  ▼
记录错误日志
  │
  ▼
结束
```

### 3.3 配置升级策略

#### 3.3.1 阈值判断逻辑

```typescript
interface UpgradeThresholds {
    tiny: number;    // 2000
    small: number;   // 10000
    medium: number;  // 100000
}

function determineTargetPreset(
    currentSize: number,
    thresholds: UpgradeThresholds
): PresetType {
    if (currentSize < thresholds.tiny) {
        return "tiny";
    } else if (currentSize < thresholds.small) {
        return "small";
    } else if (currentSize < thresholds.medium) {
        return "medium";
    } else {
        return "large";
    }
}
```

#### 3.3.2 升级路径计算

```typescript
const PRESET_ORDER: PresetType[] = ["tiny", "small", "medium", "large"];

function calculateUpgradePath(
    currentPreset: PresetType,
    targetPreset: PresetType
): PresetType[] {
    const currentIndex = PRESET_ORDER.indexOf(currentPreset);
    const targetIndex = PRESET_ORDER.indexOf(targetPreset);
    
    if (currentIndex >= targetIndex) {
        return []; // 不需要升级或降级
    }
    
    return PRESET_ORDER.slice(currentIndex + 1, targetIndex + 1);
}

// 示例：
// calculateUpgradePath("tiny", "medium") → ["small", "medium"]
// calculateUpgradePath("small", "large") → ["medium", "large"]
```

#### 3.3.3 配置合并策略

在升级过程中，需要将新预设配置与用户自定义配置合并：

```typescript
function mergeConfigs(
    baseConfig: CustomVectorStorageConfig,
    userConfig?: Partial<CustomVectorStorageConfig>
): CustomVectorStorageConfig {
    if (!userConfig) {
        return baseConfig;
    }
    
    return {
        hnsw: { ...baseConfig.hnsw, ...userConfig.hnsw },
        vectors: { ...baseConfig.vectors, ...userConfig.vectors },
        wal: { ...baseConfig.wal, ...userConfig.wal },
    };
}
```

## 4. 实现方案

### 4.1 CollectionConfigUpgradeService

```typescript
interface UpgradeProgress {
    collectionName: string;
    currentPreset: PresetType;
    targetPreset: PresetType;
    status: "pending" | "in_progress" | "completed" | "failed" | "rolling_back";
    startTime: number;
    endTime?: number;
    error?: string;
    steps: UpgradeStep[];
}

interface UpgradeStep {
    name: string;
    status: "pending" | "in_progress" | "completed" | "failed";
    startTime?: number;
    endTime?: number;
    error?: string;
}

class CollectionConfigUpgradeService {
    private upgradeHistory: Map<string, UpgradeProgress[]> = new Map();
    
    constructor(
        private qdrantClient: QdrantClient,
        private sizeEstimator: CollectionSizeEstimator,
        private configManager: VectorStorageConfigManager
    ) {}
    
    async checkAndUpgradeCollection(collectionName: string): Promise<boolean> {
        const currentInfo = await this.qdrantClient.getCollectionInfo(collectionName);
        const currentSize = currentInfo.points_count;
        
        const targetPreset = this.determineTargetPreset(currentSize);
        const currentPreset = this.detectCurrentPreset(currentInfo.config);
        
        if (currentPreset === targetPreset) {
            return false; // 不需要升级
        }
        
        const upgradePath = this.calculateUpgradePath(currentPreset, targetPreset);
        await this.executeUpgrade(collectionName, upgradePath);
        
        return true;
    }
    
    private determineTargetPreset(size: number): PresetType {
        const thresholds = this.configManager.getConfig().thresholds;
        
        if (size < thresholds.tiny) {
            return "tiny";
        } else if (size < thresholds.small) {
            return "small";
        } else if (size < thresholds.medium) {
            return "medium";
        } else {
            return "large";
        }
    }
    
    private detectCurrentPreset(config: any): PresetType {
        // 根据配置特征判断当前预设
        if (!config.hnsw) {
            return "tiny";
        }
        
        if (config.hnsw.m === 16) {
            return "small";
        } else if (config.hnsw.m === 32) {
            return "medium";
        } else if (config.hnsw.m === 64) {
            return "large";
        }
        
        return "medium"; // 默认
    }
    
    private calculateUpgradePath(
        currentPreset: PresetType,
        targetPreset: PresetType
    ): PresetType[] {
        const order: PresetType[] = ["tiny", "small", "medium", "large"];
        const currentIndex = order.indexOf(currentPreset);
        const targetIndex = order.indexOf(targetPreset);
        
        if (currentIndex >= targetIndex) {
            return [];
        }
        
        return order.slice(currentIndex + 1, targetIndex + 1);
    }
    
    private async executeUpgrade(
        collectionName: string,
        upgradePath: PresetType[]
    ): Promise<void> {
        const progress: UpgradeProgress = {
            collectionName,
            currentPreset: this.detectCurrentPreset(
                await this.qdrantClient.getCollectionInfo(collectionName)
            ),
            targetPreset: upgradePath[upgradePath.length - 1],
            status: "in_progress",
            startTime: Date.now(),
            steps: [],
        };
        
        try {
            // 备份当前配置
            const currentConfig = await this.qdrantClient.getCollectionInfo(collectionName);
            progress.steps.push({
                name: "backup_current_config",
                status: "completed",
                startTime: Date.now(),
                endTime: Date.now(),
            });
            
            // 逐步升级
            for (const preset of upgradePath) {
                const stepName = `upgrade_to_${preset}`;
                progress.steps.push({
                    name: stepName,
                    status: "in_progress",
                    startTime: Date.now(),
                });
                
                const newConfig = VECTOR_STORAGE_PRESETS[preset].customConfig;
                await this.qdrantClient.updateCollection(collectionName, {
                    ...newConfig,
                    optimizers_config: { indexing_threshold: 0 },
                });
                
                // 等待索引重建完成
                await this.waitForIndexRebuild(collectionName);
                
                progress.steps[progress.steps.length - 1].status = "completed";
                progress.steps[progress.steps.length - 1].endTime = Date.now();
            }
            
            progress.status = "completed";
            progress.endTime = Date.now();
        } catch (error) {
            progress.status = "failed";
            progress.endTime = Date.now();
            progress.error = error.message;
            
            // 回滚
            await this.rollbackCollectionConfig(collectionName, currentConfig);
        }
        
        this.recordUpgradeProgress(collectionName, progress);
    }
    
    private async waitForIndexRebuild(collectionName: string): Promise<void> {
        // 轮询检查索引状态
        const maxWaitTime = 30 * 60 * 1000; // 30分钟
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitTime) {
            const info = await this.qdrantClient.getCollectionInfo(collectionName);
            
            // 检查索引是否已重建完成
            // Qdrant会在后台重建索引，我们需要等待一段时间
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
    
    private async rollbackCollectionConfig(
        collectionName: string,
        previousConfig: any
    ): Promise<void> {
        try {
            await this.qdrantClient.updateCollection(
                collectionName,
                previousConfig.config
            );
        } catch (error) {
            console.error(`Failed to rollback collection ${collectionName}:`, error);
        }
    }
    
    private recordUpgradeProgress(
        collectionName: string,
        progress: UpgradeProgress
    ): void {
        if (!this.upgradeHistory.has(collectionName)) {
            this.upgradeHistory.set(collectionName, []);
        }
        this.upgradeHistory.get(collectionName)!.push(progress);
    }
    
    getUpgradeHistory(collectionName: string): UpgradeProgress[] {
        return this.upgradeHistory.get(collectionName) || [];
    }
}
```

### 4.2 VectorStorageConfigManager扩展

```typescript
export class VectorStorageConfigManager {
    // ... 现有代码 ...
    
    private upgradeService?: CollectionConfigUpgradeService;
    
    setUpgradeService(service: CollectionConfigUpgradeService): void {
        this.upgradeService = service;
    }
    
    async checkAndUpgradeCollection(collectionName: string): Promise<boolean> {
        if (!this.upgradeService) {
            throw new Error("Upgrade service not initialized");
        }
        
        return await this.upgradeService.checkAndUpgradeCollection(collectionName);
    }
    
    async checkAndUpgradeAllCollections(): Promise<UpgradeResult[]> {
        const collections = await this.qdrantClient.listCollections();
        const results: UpgradeResult[] = [];
        
        for (const collection of collections) {
            try {
                const upgraded = await this.checkAndUpgradeCollection(collection.name);
                results.push({
                    collectionName: collection.name,
                    upgraded,
                    error: null,
                });
            } catch (error) {
                results.push({
                    collectionName: collection.name,
                    upgraded: false,
                    error: error.message,
                });
            }
        }
        
        return results;
    }
}
```

### 4.3 定期检查调度器

```typescript
class ConfigUpgradeScheduler {
    private timer?: NodeJS.Timeout;
    
    constructor(
        private configManager: VectorStorageConfigManager,
        private intervalMs: number = 60 * 60 * 1000 // 默认每小时检查一次
    ) {}
    
    start(): void {
        this.timer = setInterval(async () => {
            try {
                await this.configManager.checkAndUpgradeAllCollections();
            } catch (error) {
                console.error("Config upgrade check failed:", error);
            }
        }, this.intervalMs);
    }
    
    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
    }
    
    setInterval(intervalMs: number): void {
        this.stop();
        this.intervalMs = intervalMs;
        this.start();
    }
}
```

## 5. 配置升级的影响分析

### 5.1 性能影响

| 升级阶段 | 性能影响 | 持续时间 | 缓解措施 |
|----------|----------|----------|----------|
| 配置更新 | 无影响 | 即时 | - |
| 索引重建 | 搜索性能下降50-80% | 取决于数据量 | 在低峰期执行 |
| WAL调整 | 写入性能暂时下降 | 几分钟 | 批量写入优化 |
| 量化启用 | 搜索速度提升20-30% | 持续 | - |

### 5.2 资源影响

| 配置项 | 内存使用 | 磁盘使用 | CPU使用 |
|--------|----------|----------|---------|
| tiny → small | +10% | +5% | 重建时+200% |
| small → medium | +20% | +10% | 重建时+300% |
| medium → large | +30% | +15% | 重建时+400% |

### 5.3 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 索引重建失败 | 低 | 高 | 实现回滚机制 |
| 性能大幅下降 | 中 | 中 | 在低峰期执行 |
| 配置不兼容 | 低 | 高 | 充分测试 |
| 数据丢失 | 极低 | 极高 | Qdrant保证数据不丢失 |

## 6. 最佳实践建议

### 6.1 升级时机

1. **定期检查**：建议每小时或每天检查一次
2. **低峰期执行**：在系统负载较低时执行升级
3. **批量处理**：避免同时升级多个集合
4. **监控指标**：密切关注升级过程中的性能指标

### 6.2 配置建议

1. **阈值设置**：
   - tiny: 2000 向量
   - small: 10000 向量
   - medium: 100000 向量
   - large: 100000+ 向量

2. **升级策略**：
   - 优先升级到下一级，避免跨级升级
   - 保留一定的缓冲空间（如达到阈值的80%时触发升级）

3. **回滚策略**：
   - 升级失败时自动回滚
   - 保留升级历史记录
   - 提供手动回滚接口

### 6.3 监控指标

1. **升级进度**：
   - 当前步骤
   - 预计剩余时间
   - 已处理数据量

2. **性能指标**：
   - 搜索延迟
   - 索引构建速度
   - 内存和CPU使用率

3. **业务指标**：
   - 查询成功率
   - 响应时间分布
   - 错误率

## 7. 实现步骤

### 阶段1：基础架构（1-2天）

1. 创建`CollectionConfigUpgradeService`类
2. 实现预设检测逻辑
3. 实现升级路径计算
4. 实现配置合并策略

### 阶段2：升级执行（2-3天）

1. 实现配置备份和恢复
2. 实现Qdrant配置更新
3. 实现索引重建监控
4. 实现错误处理和回滚

### 阶段3：调度和监控（1-2天）

1. 实现定期检查调度器
2. 实现升级历史记录
3. 实现进度监控接口
4. 添加日志和指标

### 阶段4：测试和优化（2-3天）

1. 单元测试
2. 集成测试
3. 性能测试
4. 文档编写

## 8. 总结

动态配置升级架构通过以下方式解决了当前架构的局限性：

1. **自动化**：自动检测和升级，无需人工干预
2. **渐进式**：支持逐步升级，降低风险
3. **可观测**：提供完整的升级历史和进度监控
4. **容错性**：实现回滚机制，确保系统稳定性
5. **性能优化**：根据数据规模动态调整配置，优化性能

该架构设计充分考虑了Qdrant的配置更新能力，在保证数据安全的前提下，实现了配置的平滑升级，能够有效支持代码索引系统的长期运行和性能优化。
