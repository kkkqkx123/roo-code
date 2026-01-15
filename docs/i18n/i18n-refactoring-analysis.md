# i18n 重构分析文档

## 当前问题分析

### 同步性问题

通过代码分析发现，当前 i18n 实现存在严重的同步性问题：

1. **缺失的翻译键**：
   - `common:errors.wait_checkpoint_long_time` - 在测试中使用但不存在于翻译文件
   - `common:errors.init_checkpoint_fail_long_time` - 在测试中使用但不存在于翻译文件
   - 这些键在 `src/core/checkpoints/__tests__/checkpoint.test.ts` 中被引用，但在 `src/i18n/locales/en/common.json` 和 `src/i18n/locales/zh-CN/common.json` 中都不存在

2. **运行时耦合**：
   - 当前的 `src/i18n/setup.ts` 依赖于动态文件系统加载
   - 在测试环境中需要特殊处理
   - 没有编译时验证机制

### 架构问题

1. **关注点分离不当**：i18n 模块同时处理翻译逻辑和文件系统操作
2. **缺乏类型安全**：没有 TypeScript 定义，导致潜在的运行时错误
3. **测试复杂**：需要模拟整个 i18n 模块而不是简单的翻译字符串
4. **命名空间碎片化**：翻译键分散在多个文件中，没有清晰的组织模式

## 方案1：类型安全的静态方法

### 核心设计原则

1. **编译时验证**：所有翻译键必须在编译时存在
2. **类型安全**：提供完整的 TypeScript 类型定义
3. **静态导入**：避免运行时文件系统依赖
4. **智能感知**：IDE 自动完成和类型检查

### 架构设计

```
src/i18n/
├── types.ts              # 翻译键类型定义
├── translations/
│   ├── en.ts            # 英文翻译
│   ├── zh-CN.ts         # 中文翻译
│   └── index.ts         # 翻译导出
├── utils/
│   ├── validation.ts    # 编译时验证工具
│   └── extraction.ts    # 键提取工具
└── index.ts             # 主入口
```

### 类型定义系统

```typescript
// src/i18n/types.ts
export interface TranslationParams {
  'common:errors.nested_git_repos_warning': { path: string };
  'common:errors.checkpoint_timeout': {};
  'common:errors.git_not_installed': {};
  'tools:readFile.linesRange': { start: number; end: number };
  'tools:readFile.imageTooLarge': { size: number; max: number };
  'mcp:errors.serverNotFound': { serverName: string; availableServers: string[] };
  'embeddings:orchestrator.indexingRequiresWorkspace': {};
  // ... 所有其他键
}

export type TranslationKey = keyof TranslationParams;

export interface TranslationDictionary {
  [key: string]: string | TranslationDictionary;
}
```

### 翻译结构

```typescript
// src/i18n/translations/en.ts
export const enTranslations = {
  common: {
    errors: {
      nested_git_repos_warning: "Checkpoints are disabled because a nested git repository was detected at: {{path}}",
      checkpoint_timeout: "Timed out when attempting to restore checkpoint.",
      git_not_installed: "Git is required for the checkpoints feature. Please install Git to enable checkpoints.",
      wait_checkpoint_long_time: "Checkpoints are taking longer than expected ({{timeout}}s)...", // 新增缺失键
      init_checkpoint_fail_long_time: "Failed to initialize checkpoints after {{timeout}}s. Checkpoints will be disabled." // 新增缺失键
    },
    buttons: {
      learn_more: "Learn More",
      save: "Save",
      edit: "Edit"
    }
  },
  tools: {
    readFile: {
      linesRange: " (lines {{start}}-{{end}})",
      imageTooLarge: "Image file is too large ({{size}} MB). The maximum allowed size is {{max}} MB.",
      unknownToolError: "Roo tried to use an unknown tool: \"{{toolName}}\". Retrying..."
    },
    toolRepetitionLimitReached: "Roo appears to be stuck in a loop, attempting the same action ({{toolName}}) repeatedly."
  }
} as const;

// 类型验证
type ValidateTranslations<T> = T extends typeof enTranslations ? true : false;
```

### 核心 API

```typescript
// src/i18n/index.ts
import { TranslationKey, TranslationParams } from './types';
import { enTranslations } from './translations/en';
import { zhCNTranslations } from './translations/zh-CN';

class I18nManager {
  private currentLanguage: string = 'en';
  private translations: Record<string, any> = {
    en: enTranslations,
    'zh-CN': zhCNTranslations
  };

  t<K extends TranslationKey>(
    key: K, 
    params?: TranslationParams[K]
  ): string {
    const keys = key.split('.');
    let result = this.translations[this.currentLanguage];
    
    for (const k of keys) {
      result = result[k];
      if (!result) {
        console.warn(`Missing translation key: ${key}`);
        return key; // 返回键名作为后备
      }
    }
    
    if (typeof result !== 'string') {
      console.warn(`Invalid translation key: ${key}`);
      return key;
    }
    
    // 参数替换
    if (params) {
      return this.interpolate(result, params);
    }
    
    return result;
  }

  private interpolate(template: string, params: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] !== undefined ? String(params[key]) : match;
    });
  }

  changeLanguage(language: string): void {
    if (this.translations[language]) {
      this.currentLanguage = language;
    }
  }

  getCurrentLanguage(): string {
    return this.currentLanguage;
  }
}

export const i18n = new I18nManager();
export const t = i18n.t.bind(i18n);
```

### 编译时验证工具

```typescript
// src/i18n/utils/validation.ts
import { TranslationKey } from '../types';
import { enTranslations } from '../translations/en';

/**
 * 编译时验证所有翻译键都存在
 */
export type ValidateAllKeysExist<T> = T extends TranslationKey 
  ? true 
  : false;

/**
 * 运行时验证（开发环境）
 */
export function validateTranslations(): void {
  if (process.env.NODE_ENV === 'development') {
    // 扫描代码库中的所有 t() 调用
    // 验证每个键都存在
    // 报告缺失的键
  }
}
```

### 使用示例

```typescript
// 之前的方式（容易出错）
import { t } from "../../i18n";
const message = t("common:errors.nested_git_repos_warning", { path: relativePath });

// 新的方式（类型安全）
import { t } from "../../i18n";
const message = t("common:errors.nested_git_repos_warning", { path: relativePath });
// TypeScript 会验证键存在且参数正确
```

## 迁移步骤

### 阶段1：基础架构（1-2天）
1. 创建新的类型系统和翻译结构
2. 实现核心 I18nManager 类
3. 创建翻译验证工具
4. 设置基本的英文翻译

### 阶段2：数据迁移（1天）
1. 将现有 JSON 翻译文件转换为 TypeScript 格式
2. 添加缺失的翻译键
3. 验证所有现有翻译都被正确迁移

### 阶段3：代码迁移（2-3天）
1. 更新所有导入语句
2. 替换旧的 i18n 使用方式
3. 更新测试文件
4. 验证功能正常

### 阶段4：验证和优化（1天）
1. 运行全面的翻译验证
2. 添加编译时检查到构建流程
3. 更新文档和示例
4. 性能优化和代码清理

## 优势

1. **类型安全**：编译时发现翻译错误
2. **智能感知**：IDE 提供自动完成和参数提示
3. **性能优化**：静态导入支持更好的打包优化
4. **易于测试**：无需复杂的模块模拟
5. **维护简单**：集中管理，清晰的错误报告
6. **可扩展**：容易添加新语言和验证规则

## 风险缓解

1. **向后兼容**：保持相同的 API 接口
2. **渐进迁移**：可以逐步替换，不影响现有功能
3. **错误处理**：提供完善的后备机制
4. **测试覆盖**：确保所有翻译场景都被测试

这个方案将彻底解决当前 i18n 系统的同步性问题，同时提供更好的开发体验和代码质量。