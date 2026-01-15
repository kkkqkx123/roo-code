# i18n 迁移实施计划

## 概述

本计划详细描述了从当前动态 i18n 系统迁移到类型安全静态系统的步骤，确保零停机时间和向后兼容性。

## 迁移策略

采用**渐进式迁移**策略，允许新旧系统并行运行，逐步替换使用场景，最终完全切换到新系统。

## 时间线

总预计时间：**7-10 个工作日**

### 阶段 1：基础架构建设（第 1-2 天）

#### 目标
- 建立新的类型安全 i18n 架构
- 创建核心类和类型定义
- 设置开发工具和验证脚本

#### 任务清单
- [ ] 创建 `src/i18n-new/` 目录结构
- [ ] 实现 `TranslationKey` 和 `TranslationParams` 类型定义
- [ ] 开发 `I18nManager` 核心类
- [ ] 创建翻译验证工具
- [ ] 设置编译时检查脚本

#### 交付物
- 完整的类型系统
- 可工作的翻译管理器
- 翻译验证工具

### 阶段 2：数据迁移（第 3 天）

#### 目标
- 将现有 JSON 翻译文件转换为 TypeScript 格式
- 添加缺失的翻译键
- 验证数据完整性

#### 任务清单
- [ ] 转换 `en/common.json` → `en.ts`
- [ ] 转换 `zh-CN/common.json` → `zh-CN.ts`
- [ ] 转换其他命名空间文件
- [ ] 添加缺失的 `wait_checkpoint_long_time` 键
- [ ] 添加缺失的 `init_checkpoint_fail_long_time` 键
- [ ] 验证所有翻译数据

#### 交付物
- 完整的 TypeScript 翻译文件
- 数据迁移报告
- 验证脚本结果

### 阶段 3：集成层开发（第 4 天）

#### 目标
- 创建兼容层确保向后兼容
- 开发迁移辅助工具
- 设置双系统运行环境

#### 任务清单
- [ ] 创建兼容性包装器
- [ ] 实现迁移检测机制
- [ ] 开发迁移状态监控
- [ ] 创建回滚机制
- [ ] 设置 A/B 测试框架

#### 交付物
- 兼容性层
- 迁移工具
- 监控系统

### 阶段 4：逐步替换（第 5-7 天）

#### 目标
- 逐步将现有代码迁移到新系统
- 保持功能完整性
- 实时监控迁移状态

#### 迁移优先级

**高优先级（第 5 天）**
- [ ] 核心服务（checkpoints, webview）
- [ ] 错误处理系统
- [ ] 用户界面组件

**中优先级（第 6 天）**
- [ ] API 提供商相关代码
- [ ] 工具系统
- [ ] 任务管理器

**低优先级（第 7 天）**
- [ ] 测试文件
- [ ] 辅助工具
- [ ] 文档和示例

#### 每日验证
- [ ] 运行完整测试套件
- [ ] 验证翻译功能
- [ ] 检查性能指标
- [ ] 更新迁移进度

### 阶段 5：测试和验证（第 8-9 天）

#### 目标
- 全面测试新系统功能
- 验证性能和稳定性
- 确保向后兼容性

#### 测试类型
- [ ] **单元测试**：所有翻译函数
- [ ] **集成测试**：i18n 集成场景
- [ ] **端到端测试**：用户界面国际化
- [ ] **性能测试**：翻译性能基准
- [ ] **兼容性测试**：向后兼容验证

#### 验证标准
- 所有测试通过率 > 99%
- 翻译响应时间 < 1ms
- 内存使用优化 > 20%
- 零运行时翻译错误

### 阶段 6：部署和清理（第 10 天）

#### 目标
- 正式切换到新系统
- 清理旧代码
- 更新文档

#### 部署步骤
- [ ] 最终系统验证
- [ ] 生产环境部署
- [ ] 监控系统设置
- [ ] 旧系统代码清理
- [ ] 文档更新发布

## 详细实施步骤

### 步骤 1：环境准备

```bash
# 创建新的 i18n 目录
mkdir -p src/i18n-new/{types,translations,utils}

# 安装必要的依赖
npm install --save-dev typescript@latest
npm install --save-dev ts-node
```

### 步骤 2：类型系统实现

```typescript
// src/i18n-new/types.ts
// 复制架构设计中的类型定义
export interface TranslationParams {
  // 完整的翻译键定义
}
```

### 步骤 3：翻译管理器

```typescript
// src/i18n-new/I18nManager.ts
export class I18nManager {
  // 实现核心翻译逻辑
  // 添加类型安全的翻译方法
}
```

### 步骤 4：数据迁移脚本

```typescript
// scripts/migrate-i18n-data.ts
import * as fs from 'fs';
import * as path from 'path';

/**
 * 迁移 JSON 翻译文件到 TypeScript
 */
async function migrateTranslationFiles() {
  const languages = ['en', 'zh-CN'];
  const namespaces = ['common', 'tools', 'mcp', 'embeddings'];
  
  for (const lang of languages) {
    const translations: any = {};
    
    for (const namespace of namespaces) {
      const jsonPath = path.join('src/i18n/locales', lang, `${namespace}.json`);
      
      if (fs.existsSync(jsonPath)) {
        const content = fs.readFileSync(jsonPath, 'utf-8');
        translations[namespace] = JSON.parse(content);
      }
    }
    
    // 生成 TypeScript 文件
    const tsContent = generateTypeScriptTranslations(lang, translations);
    const outputPath = path.join('src/i18n-new/translations', `${lang}.ts`);
    
    fs.writeFileSync(outputPath, tsContent);
    console.log(`✅ 迁移完成: ${lang}.ts`);
  }
}

/**
 * 生成 TypeScript 翻译内容
 */
function generateTypeScriptTranslations(language: string, translations: any): string {
  return `
import { TranslationDictionary } from '../types';

/**
 * ${language === 'en' ? 'English' : '简体中文'} 翻译
 */
export const ${language === 'en' ? 'enTranslations' : 'zhCNTranslations'}: TranslationDictionary = ${JSON.stringify(translations, null, 2)} as const;

// 类型验证
export type ${language === 'en' ? 'EnTranslationsType' : 'ZhCNTranslationsType'} = typeof ${language === 'en' ? 'enTranslations' : 'zhCNTranslations'};
`;
}

// 运行迁移
migrateTranslationFiles().catch(console.error);
```

### 步骤 5：兼容性层

```typescript
// src/i18n-new/compat.ts
import { I18nManager } from './I18nManager';
import { t as oldT } from '../i18n';

/**
 * 向后兼容的翻译函数
 * 在迁移期间提供平滑过渡
 */
export function createCompatibleTranslationFunction(manager: I18nManager) {
  return function t(key: string, params?: any): string {
    try {
      // 尝试使用新系统
      return manager.t(key as any, params);
    } catch (error) {
      // 回退到旧系统
      console.warn(`新翻译系统失败，使用旧系统: ${key}`);
      return oldT(key, params);
    }
  };
}
```

### 步骤 6：代码迁移工具

```typescript
// scripts/migrate-code-usage.ts
import * as ts from 'typescript';
import * as fs from 'fs';

/**
 * 自动迁移代码中的翻译使用
 */
function migrateFile(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // 使用 TypeScript AST 解析和修改
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  
  const transformer: ts.TransformerFactory<ts.SourceFile> = context => {
    return sourceFile => {
      const visitor: ts.Visitor = node => {
        // 查找 import { t } from "../../i18n" 语句
        if (ts.isImportDeclaration(node) && 
            ts.isStringLiteral(node.moduleSpecifier) &&
            node.moduleSpecifier.text.includes('../i18n')) {
          
          // 替换为新的导入
          return ts.factory.updateImportDeclaration(
            node,
            node.modifiers,
            node.importClause,
            ts.factory.createStringLiteral('../i18n-new'),
            node.assertClause
          );
        }
        
        return ts.visitEachChild(node, visitor, context);
      };
      
      return ts.visitNode(sourceFile, visitor);
    };
  };
  
  const result = ts.transform(sourceFile, [transformer]);
  const printer = ts.createPrinter();
  
  return printer.printFile(result.transformed[0]);
}
```

## 风险管理

### 技术风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 类型定义不完整 | 中 | 高 | 自动生成工具 + 人工审核 |
| 性能下降 | 低 | 中 | 基准测试 + 优化 |
| 向后兼容问题 | 中 | 高 | 兼容性层 + 全面测试 |
| 翻译数据丢失 | 低 | 高 | 备份 + 验证脚本 |

### 项目风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 时间超期 | 中 | 中 | 分阶段交付 + 优先级调整 |
| 团队学习曲线 | 低 | 低 | 培训 + 文档 |
| 第三方依赖 | 低 | 中 | 版本锁定 + 替代方案 |

## 成功指标

### 技术指标
- ✅ 编译时错误检测率：100%
- ✅ 运行时翻译错误：0
- ✅ 翻译性能：< 1ms
- ✅ 内存使用优化：> 20%
- ✅ 代码覆盖率：> 95%

### 业务指标
- ✅ 开发效率提升：> 30%
- ✅ 翻译相关 bug 减少：> 90%
- ✅ 新语言添加时间：< 1 天
- ✅ 开发者满意度：> 4.5/5

## 后续优化

### 短期（1-2 周）
- [ ] 添加更多语言支持
- [ ] 优化翻译性能
- [ ] 完善开发工具

### 中期（1-2 月）
- [ ] 集成翻译管理平台
- [ ] 自动化翻译工作流
- [ ] 添加翻译质量检查

### 长期（3-6 月）
- [ ] AI 辅助翻译
- [ ] 上下文感知翻译
- [ ] 动态翻译更新

这个实施计划确保了迁移过程的平滑进行，同时最大化地减少了风险和中断。