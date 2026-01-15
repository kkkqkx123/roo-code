# 代码示例和 TypeScript 定义

## 完整的 TypeScript 类型定义

### 核心类型 (types.ts)

```typescript
// src/i18n/types.ts

/**
 * 翻译键参数映射 - 完整的类型定义
 */
export interface TranslationParams {
  // Common 命名空间 - 错误消息
  'common:errors.nested_git_repos_warning': { path: string };
  'common:errors.checkpoint_timeout': {};
  'common:errors.git_not_installed': {};
  'common:errors.checkpoint_no_first': {};
  'common:errors.checkpoint_no_previous': {};
  'common:errors.checkpoint_no_changes': {};
  'common:errors.checkpoint_diff_with_next': {};
  'common:errors.checkpoint_diff_since_first': {};
  'common:errors.checkpoint_diff_to_current': {};
  'common:errors.no_workspace': {};
  'common:errors.save_api_config': {};
  'common:errors.load_api_config': {};
  'common:errors.delete_api_config': {};
  'common:errors.list_api_config': {};
  'common:errors.update_server_timeout': {};
  'common:errors.enhance_prompt': {};
  'common:errors.get_system_prompt': {};
  'common:errors.search_commits': {};
  'common:errors.reset_support_prompt': {};
  'common:errors.update_support_prompt': {};
  'common:errors.invalid_data_uri': {};
  'common:errors.error_copying_image': { errorMessage: string };
  'common:errors.error_opening_image': { error: string };
  'common:errors.error_saving_image': { errorMessage: string };
  'common:errors.could_not_open_file': { errorMessage: string };
  'common:errors.could_not_open_file_generic': {};
  'common:errors.checkpoint_failed': {};
  'common:errors.wait_checkpoint_long_time': { timeout: number };
  'common:errors.init_checkpoint_fail_long_time': { timeout: number };
  'common:errors.mistake_limit_guidance': {};
  'common:errors.violated_organization_allowlist': {};
  'common:errors.condense_failed': {};
  'common:errors.condense_not_enough_messages': {};
  'common:errors.condensed_recently': {};
  'common:errors.condense_handler_invalid': {};
  'common:errors.condense_context_grew': {};
  'common:errors.url_timeout': {};
  'common:errors.url_not_found': {};
  'common:errors.no_internet': {};
  'common:errors.url_forbidden': {};
  'common:errors.url_page_not_found': {};
  'common:errors.url_request_aborted': {};
  'common:errors.url_fetch_failed': { error: string };
  'common:errors.url_fetch_error_with_url': { url: string; error: string };
  'common:errors.command_timeout': { seconds: number };
  'common:errors.share_task_failed': {};
  'common:errors.share_no_active_task': {};
  'common:errors.share_auth_required': {};
  'common:errors.share_not_enabled': {};
  'common:errors.share_task_not_found': {};
  'common:errors.mode_import_failed': { error: string };
  'common:errors.delete_rules_folder_failed': { rulesFolderPath: string; error: string };
  'common:errors.command_not_found': { name: string };
  'common:errors.open_command_file': {};
  'common:errors.delete_command': {};
  'common:errors.no_workspace_for_project_command': {};
  'common:errors.command_already_exists': { commandName: string };
  'common:errors.create_command_failed': {};
  'common:errors.invalid_mode': { mode: string };
  'common:errors.claudeCode.processExited': { exitCode: number };
  'common:errors.claudeCode.errorOutput': { output: string };
  'common:errors.claudeCode.processExitedWithError': { exitCode: number; output: string };
  'common:errors.claudeCode.stoppedWithReason': { reason: string };
  'common:errors.claudeCode.apiKeyModelPlanMismatch': {};
  'common:errors.message.no_active_task_to_delete': {};
  'common:errors.message.invalid_timestamp_for_deletion': {};
  'common:errors.message.cannot_delete_missing_timestamp': {};
  'common:errors.message.cannot_delete_invalid_timestamp': {};
  'common:errors.message.message_not_found': { messageTs: string };
  'common:errors.message.error_deleting_message': { error: string };
  'common:errors.message.error_editing_message': { error: string };
  'common:errors.gemini.generate_stream': { error: string };
  'common:errors.gemini.generate_complete_prompt': { error: string };
  'common:errors.cerebras.authenticationFailed': {};
  'common:errors.cerebras.accessForbidden': {};
  'common:errors.cerebras.rateLimitExceeded': {};
  'common:errors.cerebras.serverError': { status: number };
  'common:errors.cerebras.genericError': { status: number; message: string };
  'common:errors.cerebras.noResponseBody': {};
  'common:errors.cerebras.completionError': { error: string };
  'common:errors.roo.authenticationRequired': {};
  'common:errors.api.invalidKeyInvalidChars': {};
  'common:errors.manual_url_empty': {};
  'common:errors.manual_url_no_query': {};
  'common:errors.manual_url_missing_params': {};
  'common:errors.manual_url_auth_failed': {};
  'common:errors.manual_url_auth_error': {};
  
  // Common 信息消息
  'common:info.no_changes': {};
  'common:info.clipboard_copy': {};
  'common:info.history_cleanup': { count: number };
  'common:info.custom_storage_path_set': { path: string };
  'common:info.default_storage_path': {};
  'common:info.settings_imported': {};
  'common:info.auto_import_success': { filename: string };
  'common:info.share_link_copied': {};
  'common:info.organization_share_link_copied': {};
  'common:info.public_share_link_copied': {};
  'common:info.image_copied_to_clipboard': {};
  'common:info.image_saved': { path: string };
  'common:info.mode_exported': { mode: string };
  'common:info.mode_imported': {};
  
  // Common 警告
  'common:warnings.no_terminal_content': {};
  'common:warnings.missing_task_files': {};
  'common:warnings.auto_import_failed': { error: string };
  
  // Common 确认对话框
  'common:confirmation.reset_state': {};
  'common:confirmation.delete_config_profile': {};
  'common:confirmation.delete_custom_mode_with_rules': { scope: string; rulesFolderPath: string };
  
  // Common UI 元素
  'common:buttons.save': {};
  'common:buttons.edit': {};
  'common:buttons.learn_more': {};
  'common:answers.yes': {};
  'common:answers.no': {};
  'common:answers.remove': {};
  'common:answers.keep': {};
  
  // Common 任务相关
  'common:tasks.canceled': {};
  'common:tasks.deleted': {};
  'common:tasks.incomplete': { taskNumber: number };
  'common:tasks.no_messages': { taskNumber: number };
  
  // Tools 命名空间
  'tools:readFile.linesRange': { start: number; end: number };
  'tools:readFile.definitionsOnly': {};
  'tools:readFile.maxLines': { max: number };
  'tools:readFile.imageTooLarge': { size: number; max: number };
  'tools:readFile.imageWithSize': { size: number };
  'tools:toolRepetitionLimitReached': { toolName: string };
  'tools:unknownToolError': { toolName: string };
  'tools:codebaseSearch.approval': { query: string };
  'tools:newTask.errors.policy_restriction': {};
  
  // MCP 命名空间
  'mcp:errors.invalid_settings_format': {};
  'mcp:errors.invalid_settings_syntax': {};
  'mcp:errors.invalid_settings_validation': { errorMessages: string };
  'mcp:errors.create_json': { error: string };
  'mcp:errors.failed_update_project': {};
  'mcp:errors.invalidJsonArgument': { toolName: string };
  'mcp:errors.refresh_after_disable': {};
  'mcp:errors.refresh_after_enable': {};
  'mcp:errors.disconnect_servers_partial': { count: number };
  'mcp:errors.toolNotFound': { toolName: string; serverName: string; availableTools: string[] };
  'mcp:errors.serverNotFound': { serverName: string; availableServers: string[] };
  'mcp:errors.toolDisabled': { toolName: string; serverName: string; availableTools: string[] };
  
  // MCP 信息消息
  'mcp:info.server_restarting': { serverName: string };
  'mcp:info.server_connected': { serverName: string };
  'mcp:info.server_deleted': { serverName: string };
  'mcp:info.server_not_found': { serverName: string };
  'mcp:info.global_servers_active': { mcpServers: string };
  'mcp:info.project_servers_active': { mcpServers: string };
  'mcp:info.already_refreshing': {};
  'mcp:info.refreshing_all': {};
  'mcp:info.all_refreshed': {};
  'mcp:info.project_config_deleted': {};
  
  // Embeddings 命名空间
  'embeddings:unknownError': {};
  'embeddings:authenticationFailed': {};
  'embeddings:failedWithStatus': { attempts: number; statusCode: number; errorMessage: string };
  'embeddings:failedWithError': { attempts: number; errorMessage: string };
  'embeddings:failedMaxAttempts': { attempts: number };
  'embeddings:textExceedsTokenLimit': { index: number; itemTokens: number; maxTokens: number };
  'embeddings:rateLimitRetry': { delayMs: number; attempt: number; maxRetries: number };
  'embeddings:scanner.unknownErrorProcessingFile': { filePath: string };
  'embeddings:scanner.unknownErrorDeletingPoints': { filePath: string };
  'embeddings:scanner.failedToProcessBatchWithError': { maxRetries: number; errorMessage: string };
  'embeddings:vectorStore.qdrantConnectionFailed': { qdrantUrl: string; errorMessage: string };
  'embeddings:vectorStore.vectorDimensionMismatch': { errorMessage: string };
  'embeddings:validation.authenticationFailed': {};
  'embeddings:validation.connectionFailed': {};
  'embeddings:validation.modelNotAvailable': {};
  'embeddings:validation.configurationError': {};
  'embeddings:validation.serviceUnavailable': {};
  'embeddings:validation.invalidEndpoint': {};
  'embeddings:validation.invalidEmbedderConfig': {};
  'embeddings:validation.invalidApiKey': {};
  'embeddings:validation.invalidBaseUrl': {};
  'embeddings:validation.invalidModel': {};
  'embeddings:validation.invalidResponse': {};
  'embeddings:validation.apiKeyRequired': {};
  'embeddings:validation.baseUrlRequired': {};
  'embeddings:serviceFactory.openAiConfigMissing': {};
  'embeddings:serviceFactory.openAiCompatibleConfigMissing': {};
  'embeddings:serviceFactory.geminiConfigMissing': {};
  'embeddings:serviceFactory.invalidEmbedderType': { embedderProvider: string };
  'embeddings:serviceFactory.vectorDimensionNotDeterminedOpenAiCompatible': { modelId: string; provider: string };
  'embeddings:serviceFactory.vectorDimensionNotDetermined': { modelId: string; provider: string };
  'embeddings:serviceFactory.qdrantUrlMissing': {};
  'embeddings:serviceFactory.codeIndexingNotConfigured': {};
  'embeddings:orchestrator.indexingFailedNoBlocks': {};
  'embeddings:orchestrator.indexingFailedCritical': {};
  'embeddings:orchestrator.fileWatcherStarted': {};
  'embeddings:orchestrator.fileWatcherStopped': {};
  'embeddings:orchestrator.failedDuringInitialScan': { errorMessage: string };
  'embeddings:orchestrator.unknownError': {};
  'embeddings:orchestrator.indexingRequiresWorkspace': {};
  'embeddings:orchestrator.failedToConnect': { errorMessage: string };
  'embeddings:orchestrator.unexpectedError': { errorMessage: string };
}

/**
 * 翻译键类型
 */
export type TranslationKey = keyof TranslationParams;

/**
 * 语言代码
 */
export type LanguageCode = 'en' | 'zh-CN';

/**
 * 翻译函数类型
 */
export type TranslationFunction = <K extends TranslationKey>(
  key: K,
  params?: TranslationParams[K]
) => string;

/**
 * 翻译字典接口
 */
export interface TranslationDictionary {
  [key: string]: string | TranslationDictionary;
}

/**
 * 语言配置
 */
export interface LanguageConfig {
  code: LanguageCode;
  name: string;
  direction: 'ltr' | 'rtl';
}

/**
 * 翻译选项
 */
export interface TranslationOptions {
  fallback?: boolean;
  debug?: boolean;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  missingKeys: TranslationKey[];
  unusedKeys: string[];
  invalidParams: Array<{ key: TranslationKey; expected: string; actual: string }>;
  totalKeys: number;
  coverage: number;
}
```

### 翻译管理器实现

```typescript
// src/i18n/I18nManager.ts

import {
  TranslationKey,
  TranslationParams,
  LanguageCode,
  TranslationFunction,
  LanguageConfig,
  TranslationOptions,
  ValidationResult
} from './types';

/**
 * 翻译管理器 - 类型安全的国际化管理
 */
export class I18nManager {
  private currentLanguage: LanguageCode = 'en';
  private translations: Map<LanguageCode, TranslationDictionary> = new Map();
  private fallbackLanguage: LanguageCode = 'en';
  private options: TranslationOptions;

  constructor(options: TranslationOptions = {}) {
    this.options = { fallback: true, debug: false, ...options };
  }

  /**
   * 注册翻译数据
   */
  registerTranslations(language: LanguageCode, translations: TranslationDictionary): void {
    this.translations.set(language, translations);
    
    if (this.options.debug) {
      console.log(`[i18n] Registered translations for: ${language}`);
    }
  }

  /**
   * 获取翻译 - 类型安全的主方法
   */
  t<K extends TranslationKey>(
    key: K,
    params?: TranslationParams[K],
    options?: TranslationOptions
  ): string {
    const opts = { ...this.options, ...options };
    
    try {
      // 尝试获取当前语言的翻译
      const translation = this.getTranslation(key, this.currentLanguage);
      
      if (translation) {
        return this.interpolate(translation, params || {});
      }

      // 尝试后备语言
      if (opts.fallback && this.currentLanguage !== this.fallbackLanguage) {
        const fallbackTranslation = this.getTranslation(key, this.fallbackLanguage);
        
        if (fallbackTranslation) {
          if (opts.debug) {
            console.warn(`[i18n] Using fallback translation for: ${key}`);
          }
          return this.interpolate(fallbackTranslation, params || {});
        }
      }

      // 生成友好的后备文本
      return this.generateFallbackText(key, params);
      
    } catch (error) {
      if (opts.debug) {
        console.error(`[i18n] Translation error for key: ${key}`, error);
      }
      return this.generateFallbackText(key, params);
    }
  }

  /**
   * 批量获取翻译
   */
  translateBatch(
    keys: TranslationKey[],
    params?: Partial<Record<TranslationKey, any>>
  ): Record<TranslationKey, string> {
    const result = {} as Record<TranslationKey, string>;
    
    for (const key of keys) {
      result[key] = this.t(key, params?.[key]);
    }
    
    return result;
  }

  /**
   * 更改语言
   */
  changeLanguage(language: LanguageCode): void {
    if (this.translations.has(language)) {
      const oldLanguage = this.currentLanguage;
      this.currentLanguage = language;
      
      if (this.options.debug) {
        console.log(`[i18n] Language changed: ${oldLanguage} -> ${language}`);
      }
    } else {
      if (this.options.debug) {
        console.warn(`[i18n] Language not available: ${language}`);
      }
    }
  }

  /**
   * 获取当前语言
   */
  getCurrentLanguage(): LanguageCode {
    return this.currentLanguage;
  }

  /**
   * 获取语言配置
   */
  getLanguageConfig(language?: LanguageCode): LanguageConfig {
    const lang = language || this.currentLanguage;
    const configs: Record<LanguageCode, LanguageConfig> = {
      'en': { code: 'en', name: 'English', direction: 'ltr' },
      'zh-CN': { code: 'zh-CN', name: '简体中文', direction: 'ltr' }
    };
    return configs[lang];
  }

  /**
   * 获取可用语言列表
   */
  getAvailableLanguages(): LanguageCode[] {
    return Array.from(this.translations.keys());
  }

  /**
   * 验证翻译完整性
   */
  validateTranslations(): ValidationResult {
    const result: ValidationResult = {
      missingKeys: [],
      unusedKeys: [],
      invalidParams: [],
      totalKeys: 0,
      coverage: 0
    };

    // 获取所有翻译键
    const allKeys = this.extractAllKeys();
    const definedKeys = this.extractDefinedKeys();
    
    result.totalKeys = allKeys.length;
    
    // 检查缺失的键
    for (const key of allKeys) {
      if (!this.keyExists(key)) {
        result.missingKeys.push(key);
      }
    }
    
    // 检查未使用的键
    for (const key of definedKeys) {
      if (!allKeys.includes(key as TranslationKey)) {
        result.unusedKeys.push(key);
      }
    }
    
    // 计算覆盖率
    result.coverage = result.totalKeys > 0 
      ? (result.totalKeys - result.missingKeys.length) / result.totalKeys 
      : 1;

    return result;
  }

  /**
   * 私有方法：获取翻译
   */
  private getTranslation(key: TranslationKey, language: LanguageCode): string | null {
    const translationDict = this.translations.get(language);
    if (!translationDict) {
      return null;
    }

    const keys = key.split('.');
    let current: any = translationDict;

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return null;
      }
    }

    return typeof current === 'string' ? current : null;
  }

  /**
   * 私有方法：插值替换
   */
  private interpolate(template: string, params: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] !== undefined ? String(params[key]) : match;
    });
  }

  /**
   * 私有方法：生成后备文本
   */
  private generateFallbackText<K extends TranslationKey>(key: K, params?: TranslationParams[K]): string {
    // 提取键的最后部分
    const keyParts = key.split('.');
    const displayKey = keyParts[keyParts.length - 1];
    
    // 格式化显示文本
    const displayText = displayKey
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());

    // 如果有参数，显示参数信息
    if (params && Object.keys(params).length > 0) {
      const paramInfo = Object.keys(params).join(', ');
      return `[${displayText}] (${paramInfo})`;
    }

    return `[${displayText}]`;
  }

  /**
   * 私有方法：检查键是否存在
   */
  private keyExists(key: TranslationKey): boolean {
    // 检查当前语言
    if (this.getTranslation(key, this.currentLanguage)) {
      return true;
    }
    
    // 检查后备语言
    if (this.currentLanguage !== this.fallbackLanguage) {
      return this.getTranslation(key, this.fallbackLanguage) !== null;
    }
    
    return false;
  }

  /**
   * 私有方法：提取所有翻译键
   */
  private extractAllKeys(): TranslationKey[] {
    // 这里可以通过扫描代码库来获取所有使用的键
    // 为了演示，返回一些示例键
    return [
      'common:errors.nested_git_repos_warning',
      'common:errors.checkpoint_timeout',
      'tools:readFile.linesRange',
      // ... 其他键
    ];
  }

  /**
   * 私有方法：提取定义的键
   */
  private extractDefinedKeys(): string[] {
    const keys: string[] = [];
    
    for (const [lang, translations] of this.translations) {
      const langKeys = this.extractKeysFromDict(translations);
      keys.push(...langKeys);
    }
    
    return [...new Set(keys)]; // 去重
  }

  /**
   * 私有方法：从字典提取键
   */
  private extractKeysFromDict(dict: TranslationDictionary, prefix = ''): string[] {
    const keys: string[] = [];
    
    for (const [key, value] of Object.entries(dict)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'string') {
        keys.push(fullKey);
      } else if (typeof value === 'object' && value !== null) {
        const nestedKeys = this.extractKeysFromDict(value, fullKey);
        keys.push(...nestedKeys);
      }
    }
    
    return keys;
  }
}
```

## 使用示例

### 基本使用

```typescript
// src/i18n/index.ts
import { I18nManager } from './I18nManager';
import { enTranslations } from './translations/en';
import { zhCNTranslations } from './translations/zh-CN';

// 创建并配置管理器
const i18n = new I18nManager({ debug: true });
i18n.registerTranslations('en', enTranslations);
i18n.registerTranslations('zh-CN', zhCNTranslations);

// 使用翻译
const message = i18n.t('common:errors.nested_git_repos_warning', { 
  path: '/user/project/.git' 
});
console.log(message);
// 输出: "Checkpoints are disabled because a nested git repository was detected at: /user/project/.git. To use checkpoints, please remove or relocate this nested git repository."
```

### 在现有代码中的迁移示例

**之前（容易出错）：**
```typescript
// src/services/checkpoints/ShadowCheckpointService.ts
import { t } from "../../i18n";

const message = t("common:errors.nested_git_repos_warning", { path: relativePath });
// 没有类型检查，键名可能拼写错误
```

**之后（类型安全）：**
```typescript
// src/services/checkpoints/ShadowCheckpointService.ts
import { i18n } from "../../i18n";

const message = i18n.t("common:errors.nested_git_repos_warning", { path: relativePath });
// TypeScript 会验证：
// 1. 键名存在
// 2. 参数类型正确（必须有 path: string）
// 3. 返回值是 string
```

### 批量翻译

```typescript
// 批量获取多个翻译
const translations = i18n.translateBatch([
  'common:errors.checkpoint_timeout',
  'common:errors.git_not_installed',
  'common:buttons.learn_more'
]);

console.log(translations);
// 输出:
// {
//   'common:errors.checkpoint_timeout': 'Timed out when attempting to restore checkpoint.',
//   'common:errors.git_not_installed': 'Git is required for the checkpoints feature...',
//   'common:buttons.learn_more': 'Learn More'
// }
```

### 语言切换

```typescript
// 切换语言
i18n.changeLanguage('zh-CN');

// 获取当前语言
const currentLang = i18n.getCurrentLanguage(); // 'zh-CN'

// 获取语言配置
const config = i18n.getLanguageConfig();
console.log(config);
// 输出: { code: 'zh-CN', name: '简体中文', direction: 'ltr' }
```

### 验证和调试

```typescript
// 开发环境中验证翻译
if (process.env.NODE_ENV === 'development') {
  const validation = i18n.validateTranslations();
  
  if (validation.missingKeys.length > 0) {
    console.warn('缺失的翻译键:', validation.missingKeys);
  }
  
  if (validation.unusedKeys.length > 0) {
    console.info('未使用的翻译键:', validation.unusedKeys);
  }
  
  console.log(`翻译覆盖率: ${(validation.coverage * 100).toFixed(1)}%`);
}
```

## 高级特性

### 自定义插值

```typescript
// 支持复杂的插值逻辑
const complexMessage = i18n.t('common:welcome', { 
  name: '张三',
  count: 5 
});
// 输出: "Welcome, 张三! You have 5 notifications."
```

### 嵌套参数

```typescript
// 支持嵌套的参数结构
const nestedMessage = i18n.t('common:errors.delete_rules_folder_failed', {
  rulesFolderPath: '/path/to/rules',
  error: 'Permission denied'
});
```

### 类型安全的翻译工具

```typescript
// src/utils/typedTranslations.ts
import { TranslationKey, TranslationParams } from '../i18n/types';

/**
 * 创建类型安全的翻译函数
 */
export function createTypedTranslation<K extends TranslationKey>(key: K) {
  return (params?: TranslationParams[K]): string => {
    return i18n.t(key, params);
  };
}

// 使用示例
const translateCheckpointError = createTypedTranslation('common:errors.checkpoint_timeout');
const message = translateCheckpointError(); // 不需要参数

const translateNestedError = createTypedTranslation('common:errors.nested_git_repos_warning');
const message2 = translateNestedError({ path: '/path/to/git' }); // 必须有 path 参数
```

### React Hook 集成

```typescript
// src/hooks/useTranslation.ts
import { useState, useEffect } from 'react';
import { i18n, TranslationKey, TranslationParams } from '../i18n';

/**
 * React Hook for translations
 */
export function useTranslation() {
  const [language, setLanguage] = useState(i18n.getCurrentLanguage());

  useEffect(() => {
    const handleLanguageChange = (newLanguage: string) => {
      setLanguage(newLanguage);
    };

    // 监听语言变化（可以扩展 i18nManager 支持事件）
    return () => {
      // 清理监听器
    };
  }, []);

  const t = <K extends TranslationKey>(key: K, params?: TranslationParams[K]): string => {
    return i18n.t(key, params);
  };

  return { t, language, changeLanguage: i18n.changeLanguage.bind(i18n) };
}

// 使用示例
function MyComponent() {
  const { t, language, changeLanguage } = useTranslation();
  
  return (
    <div>
      <p>{t('common:errors.no_workspace')}</p>
      <button onClick={() => changeLanguage('zh-CN')}>
        Switch to Chinese
      </button>
    </div>
  );
}
```

### 测试工具

```typescript
// src/test/i18nTestUtils.ts
import { I18nManager } from '../i18n/I18nManager';
import { enTranslations } from '../i18n/translations/en';

/**
 * 为测试创建 i18n 实例
 */
export function createTestI18n() {
  const i18n = new I18nManager({ debug: false });
  i18n.registerTranslations('en', enTranslations);
  return i18n;
}

/**
 * 模拟翻译（用于单元测试）
 */
export function mockTranslation(key: string, params?: any): string {
  return `[${key}]${params ? `(${JSON.stringify(params)})` : ''}`;
}

// 测试示例
describe('MyComponent', () => {
  it('should display translated error message', () => {
    const i18n = createTestI18n();
    const message = i18n.t('common:errors.no_workspace');
    
    expect(message).toBe('Please open a project folder first');
  });
});
```

## 性能优化

### 编译时优化

```typescript
// src/i18n/optimizations.ts

/**
 * 编译时翻译优化
 * 在构建时内联静态翻译
 */
export function inlineTranslations(code: string, translations: TranslationDictionary): string {
  // 实现编译时翻译内联逻辑
  // 将 t('key') 替换为实际的翻译字符串
  return code;
}

/**
 * 翻译键树摇优化
 * 移除未使用的翻译键
 */
export function treeShakeTranslations(
  translations: TranslationDictionary,
  usedKeys: string[]
): TranslationDictionary {
  // 实现翻译树摇逻辑
  return translations;
}
```

### 运行时缓存

```typescript
// 在 I18nManager 中添加缓存
private translationCache: Map<string, string> = new Map();

private getCachedTranslation(key: TranslationKey, language: LanguageCode, params?: TranslationParams[TranslationKey]): string | null {
  const cacheKey = `${language}:${key}:${JSON.stringify(params || {})}`;
  
  if (this.translationCache.has(cacheKey)) {
    return this.translationCache.get(cacheKey)!;
  }
  
  const translation = this.getTranslation(key, language);
  if (translation) {
    const result = this.interpolate(translation, params || {});
    this.translationCache.set(cacheKey, result);
    return result;
  }
  
  return null;
}
```

这些代码示例和 TypeScript 定义展示了类型安全静态 i18n 系统的完整实现，提供了从基础使用到高级特性的全面解决方案。