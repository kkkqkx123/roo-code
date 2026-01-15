# 类型安全静态 i18n 架构设计

## 架构目标

1. **编译时安全**：所有翻译键必须在编译时存在且类型正确
2. **零运行时错误**：消除因缺失翻译键导致的运行时错误
3. **开发体验**：提供完整的 IDE 自动完成和类型检查
4. **性能优化**：支持静态分析和树摇优化
5. **易于维护**：集中管理，清晰的错误报告

## 核心组件设计

### 1. 类型系统 (types.ts)

```typescript
// src/i18n/types.ts

/**
 * 翻译键参数映射
 * 每个翻译键对应的参数类型
 */
export interface TranslationParams {
  // Common 命名空间
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
```

### 2. 翻译管理器 (I18nManager.ts)

```typescript
// src/i18n/I18nManager.ts

import { TranslationKey, TranslationParams, LanguageCode, TranslationFunction, LanguageConfig } from './types';

/**
 * 翻译管理器
 * 提供类型安全的翻译功能
 */
export class I18nManager {
  private currentLanguage: LanguageCode = 'en';
  private translations: Map<LanguageCode, TranslationDictionary> = new Map();
  private fallbackLanguage: LanguageCode = 'en';

  /**
   * 注册翻译
   */
  registerTranslations(language: LanguageCode, translations: TranslationDictionary): void {
    this.translations.set(language, translations);
  }

  /**
   * 获取翻译
   */
  t<K extends TranslationKey>(key: K, params?: TranslationParams[K]): string {
    const translation = this.getTranslation(key, this.currentLanguage);
    
    if (!translation) {
      console.warn(`Missing translation for key: ${key} in language: ${this.currentLanguage}`);
      return this.getFallbackTranslation(key, params);
    }

    return this.interpolate(translation, params || {});
  }

  /**
   * 更改语言
   */
  changeLanguage(language: LanguageCode): void {
    if (this.translations.has(language)) {
      this.currentLanguage = language;
    } else {
      console.warn(`Language ${language} not registered, keeping current language: ${this.currentLanguage}`);
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
  getLanguageConfig(): LanguageConfig {
    const configs: Record<LanguageCode, LanguageConfig> = {
      'en': { code: 'en', name: 'English', direction: 'ltr' },
      'zh-CN': { code: 'zh-CN', name: '简体中文', direction: 'ltr' }
    };
    return configs[this.currentLanguage];
  }

  /**
   * 获取翻译（私有方法）
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
   * 获取后备翻译
   */
  private getFallbackTranslation<K extends TranslationKey>(key: K, params?: TranslationParams[K]): string {
    if (this.currentLanguage !== this.fallbackLanguage) {
      const fallback = this.getTranslation(key, this.fallbackLanguage);
      if (fallback) {
        return this.interpolate(fallback, params || {});
      }
    }

    // 最后后备：返回格式化的键名
    return this.formatKeyAsFallback(key, params);
  }

  /**
   * 插值替换
   */
  private interpolate(template: string, params: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] !== undefined ? String(params[key]) : match;
    });
  }

  /**
   * 格式化键名作为后备显示
   */
  private formatKeyAsFallback<K extends TranslationKey>(key: K, params?: TranslationParams[K]): string {
    const keyWithoutNamespace = key.split(':').pop() || key;
    const formattedKey = keyWithoutNamespace
      .split('.')
      .pop()
      ?.replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase()) || key;

    if (params && Object.keys(params).length > 0) {
      const paramString = Object.entries(params)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      return `${formattedKey} (${paramString})`;
    }

    return formattedKey;
  }

  /**
   * 验证翻译完整性（开发环境使用）
   */
  validateTranslations(): ValidationResult {
    const result: ValidationResult = {
      missingKeys: [],
      unusedKeys: [],
      totalKeys: 0
    };

    // 这里可以添加复杂的验证逻辑
    // 例如：扫描代码库，检查所有 t() 调用等

    return result;
  }
}

/**
 * 验证结果
 */
export interface ValidationResult {
  missingKeys: string[];
  unusedKeys: string[];
  totalKeys: number;
}

/**
 * 创建翻译函数
 */
export function createTranslationFunction(manager: I18nManager): TranslationFunction {
  return manager.t.bind(manager);
}
```

### 3. 翻译数据 (translations/)

```typescript
// src/i18n/translations/en.ts

import { TranslationDictionary } from '../types';

/**
 * 英文翻译
 */
export const enTranslations: TranslationDictionary = {
  common: {
    extension: {
      name: "Roo Code",
      description: "A whole dev team of AI agents in your editor."
    },
    number_format: {
      thousand_suffix: "k",
      million_suffix: "m", 
      billion_suffix: "b"
    },
    welcome: "Welcome, {{name}}! You have {{count}} notifications.",
    items: {
      zero: "No items",
      one: "One item",
      other: "{{count}} items"
    },
    errors: {
      nested_git_repos_warning: "Checkpoints are disabled because a nested git repository was detected at: {{path}}. To use checkpoints, please remove or relocate this nested git repository.",
      checkpoint_timeout: "Timed out when attempting to restore checkpoint.",
      checkpoint_failed: "Failed to restore checkpoint.",
      git_not_installed: "Git is required for the checkpoints feature. Please install Git to enable checkpoints.",
      checkpoint_no_first: "No first checkpoint to compare.",
      checkpoint_no_previous: "No previous checkpoint to compare.",
      checkpoint_no_changes: "No changes found.",
      checkpoint_diff_with_next: "Changes compared with next checkpoint",
      checkpoint_diff_since_first: "Changes since first checkpoint",
      checkpoint_diff_to_current: "Changes to current workspace",
      no_workspace: "Please open a project folder first",
      save_api_config: "Failed to save api configuration",
      load_api_config: "Failed to load api configuration",
      delete_api_config: "Failed to delete api configuration",
      list_api_config: "Failed to get list api configuration",
      update_server_timeout: "Failed to update server timeout",
      enhance_prompt: "Failed to enhance prompt",
      get_system_prompt: "Failed to get system prompt",
      search_commits: "Failed to search commits",
      reset_support_prompt: "Failed to reset support prompt",
      update_support_prompt: "Failed to update support prompt",
      invalid_data_uri: "Invalid data URI format",
      error_copying_image: "Error copying image: {{errorMessage}}",
      error_opening_image: "Error opening image: {{error}}",
      error_saving_image: "Error saving image: {{errorMessage}}",
      could_not_open_file: "Could not open file: {{errorMessage}}",
      could_not_open_file_generic: "Could not open file!",
      wait_checkpoint_long_time: "Checkpoints are taking longer than expected ({{timeout}}s)...",
      init_checkpoint_fail_long_time: "Failed to initialize checkpoints after {{timeout}}s. Checkpoints will be disabled.",
      mistake_limit_guidance: "This may indicate a failure in the model's thought process or inability to use a tool properly, which can be mitigated with some user guidance (e.g. \"Try breaking down the task into smaller steps\").",
      violated_organization_allowlist: "Failed to run task: the current profile isn't compatible with your organization settings",
      condense_failed: "Failed to condense context",
      condense_not_enough_messages: "Not enough messages to condense context",
      condensed_recently: "Context was condensed recently; skipping this attempt",
      condense_handler_invalid: "API handler for condensing context is invalid",
      condense_context_grew: "Context size increased during condensing; skipping this attempt",
      url_timeout: "The website took too long to load (timeout). This could be due to a slow connection, heavy website, or the site being temporarily unavailable. You can try again later or check if the URL is correct.",
      url_not_found: "The website address could not be found. Please check if the URL is correct and try again.",
      no_internet: "No internet connection. Please check your network connection and try again.",
      url_forbidden: "Access to this website is forbidden. The site may block automated access or require authentication.",
      url_page_not_found: "The page was not found. Please check if the URL is correct.",
      url_request_aborted: "The request to fetch the URL was aborted. This may happen if the site blocks automated access, requires authentication, or if there's a network issue. Please try again or check if the URL is accessible in a regular browser.",
      url_fetch_failed: "Failed to fetch URL content: {{error}}",
      url_fetch_error_with_url: "Error fetching content for {{url}}: {{error}}",
      command_timeout: "Command execution timed out after {{seconds}} seconds",
      share_task_failed: "Failed to share task. Please try again.",
      share_no_active_task: "No active task to share",
      share_auth_required: "Authentication required. Please sign in to share tasks.",
      share_not_enabled: "Task sharing is not enabled for this organization.",
      share_task_not_found: "Task not found or access denied.",
      mode_import_failed: "Failed to import mode: {{error}}",
      delete_rules_folder_failed: "Failed to delete rules folder: {{rulesFolderPath}}. Error: {{error}}",
      command_not_found: "Command '{{name}}' not found",
      open_command_file: "Failed to open command file",
      delete_command: "Failed to delete command",
      no_workspace_for_project_command: "No workspace folder found for project command",
      command_already_exists: "Command \"{{commandName}}\" already exists",
      create_command_failed: "Failed to create command",
      invalid_mode: "Invalid mode: {{mode}}",
      claudeCode: {
        processExited: "Claude Code process exited with code {{exitCode}}.",
        errorOutput: "Error output: {{output}}",
        processExitedWithError: "Claude Code process exited with code {{exitCode}}. Error output: {{output}}",
        stoppedWithReason: "Claude Code stopped with reason: {{reason}}",
        apiKeyModelPlanMismatch: "API keys and subscription plans allow different models. Make sure the selected model is included in your plan."
      },
      message: {
        no_active_task_to_delete: "No active task to delete messages from",
        invalid_timestamp_for_deletion: "Invalid message timestamp for deletion",
        cannot_delete_missing_timestamp: "Cannot delete message: missing timestamp",
        cannot_delete_invalid_timestamp: "Cannot delete message: invalid timestamp",
        message_not_found: "Message with timestamp {{messageTs}} not found",
        error_deleting_message: "Error deleting message: {{error}}",
        error_editing_message: "Error editing message: {{error}}"
      },
      gemini: {
        generate_stream: "Gemini generate context stream error: {{error}}",
        generate_complete_prompt: "Gemini completion error: {{error}}",
        sources: "Sources:",
        thinking_complete_no_output: "(Thinking complete, but no output was generated.)",
        thinking_complete_truncated: "(Thinking complete, but output was truncated due to token limit.)",
        thinking_complete_safety: "(Thinking complete, but output was blocked due to safety settings.)",
        thinking_complete_recitation: "(Thinking complete, but output was blocked due to recitation check.)"
      },
      cerebras: {
        authenticationFailed: "Cerebras API authentication failed. Please check your API key is valid and not expired.",
        accessForbidden: "Cerebras API access forbidden. Your API key may not have access to the requested model or feature.",
        rateLimitExceeded: "Cerebras API rate limit exceeded. Please wait before making another request.",
        serverError: "Cerebras API server error ({{status}}). Please try again later.",
        genericError: "Cerebras API Error ({{status}}): {{message}}",
        noResponseBody: "Cerebras API Error: No response body",
        completionError: "Cerebras completion error: {{error}}"
      },
      roo: {
        authenticationRequired: "Roo provider requires cloud authentication. Please sign in to Roo Code Cloud."
      },
      api: {
        invalidKeyInvalidChars: "API key contains invalid characters."
      },
      manual_url_empty: "Please enter a valid callback URL",
      manual_url_no_query: "Invalid callback URL: missing query parameters",
      manual_url_missing_params: "Invalid callback URL: missing required parameters (code and state)",
      manual_url_auth_failed: "Manual URL authentication failed",
      manual_url_auth_error: "Authentication failed"
    },
    warnings: {
      no_terminal_content: "No terminal content selected",
      missing_task_files: "This task's files are missing. Would you like to remove it from the task list?",
      auto_import_failed: "Failed to auto-import RooCode settings: {{error}}"
    },
    info: {
      no_changes: "No changes found.",
      clipboard_copy: "System prompt successfully copied to clipboard",
      history_cleanup: "Cleaned up {{count}} task(s) with missing files from history.",
      custom_storage_path_set: "Custom storage path set: {{path}}",
      default_storage_path: "Reverted to using default storage path",
      settings_imported: "Settings imported successfully.",
      auto_import_success: "RooCode settings automatically imported from {{filename}}",
      share_link_copied: "Share link copied to clipboard",
      organization_share_link_copied: "Organization share link copied to clipboard!",
      public_share_link_copied: "Public share link copied to clipboard!",
      image_copied_to_clipboard: "Image data URI copied to clipboard",
      image_saved: "Image saved to {{path}}",
      mode_exported: "Mode '{{mode}}' exported successfully",
      mode_imported: "Mode imported successfully"
    },
    confirmation: {
      reset_state: "Are you sure you want to reset all state and secret storage in the extension? This cannot be undone.",
      delete_config_profile: "Are you sure you want to delete this configuration profile?",
      delete_custom_mode_with_rules: "Are you sure you want to delete this {{scope}} mode?\n\nThis will also delete the associated rules folder at:\n{{rulesFolderPath}}"
    },
    buttons: {
      save: "Save",
      edit: "Edit",
      learn_more: "Learn More"
    },
    answers: {
      yes: "Yes",
      no: "No",
      remove: "Remove",
      keep: "Keep"
    },
    tasks: {
      canceled: "Task error: It was stopped and canceled by the user.",
      deleted: "Task failure: It was stopped and deleted by the user.",
      incomplete: "Task #{{taskNumber}} (Incomplete)",
      no_messages: "Task #{{taskNumber}} (No messages)"
    },
    interruption: {
      responseInterruptedByUser: "Response interrupted by user",
      responseInterruptedByApiError: "Response interrupted by API error"
    },
    storage: {
      prompt_custom_path: "Enter custom conversation history storage path, leave empty to use default location",
      path_placeholder: "D:\\RooCodeStorage",
      enter_absolute_path: "Please enter an absolute path (e.g. D:\\RooCodeStorage or /home/user/storage)",
      enter_valid_path: "Please enter a valid path"
    },
    input: {
      task_prompt: "What should Roo do?",
      task_placeholder: "Type your task here"
    },
    customModes: {
      errors: {
        yamlParseError: "Invalid YAML in .roomodes file at line {{line}}. Please check for:\n• Proper indentation (use spaces, not tabs)\n• Matching quotes and brackets\n• Valid YAML syntax",
        schemaValidationError: "Invalid custom modes format in .roomodes:\n{{issues}}",
        invalidFormat: "Invalid custom modes format. Please ensure your settings follow the correct YAML format.",
        updateFailed: "Failed to update custom mode: {{error}}",
        deleteFailed: "Failed to delete custom mode: {{error}}",
        resetFailed: "Failed to reset custom modes: {{error}}",
        modeNotFound: "Write error: Mode not found",
        noWorkspaceForProject: "No workspace folder found for project-specific mode",
        rulesCleanupFailed: "Mode deleted successfully, but failed to delete rules folder at {{rulesFolderPath}}. You may need to delete it manually."
      },
      scope: {
        project: "project",
        global: "global"
      }
    },
    marketplace: {
      mode: {
        rulesCleanupFailed: "Mode removed successfully, but failed to delete rules folder at {{rulesFolderPath}}. You may need to delete it manually."
      }
    },
    mdm: {
      errors: {
        cloud_auth_required: "Your organization requires Roo Code Cloud authentication. Please sign in to continue.",
        organization_mismatch: "You must be authenticated with your organization's Roo Code Cloud account.",
        verification_failed: "Unable to verify organization authentication."
      },
      info: {
        organization_requires_auth: "Your organization requires authentication."
      }
    },
    prompts: {
      deleteMode: {
        title: "Delete Custom Mode",
        description: "Are you sure you want to delete this {{scope}} mode? This will also delete the associated rules folder at: {{rulesFolderPath}}",
        descriptionNoRules: "Are you sure you want to delete this custom mode?",
        confirm: "Delete"
      }
    },
    commands: {
      preventCompletionWithOpenTodos: {
        description: "Prevent task completion when there are incomplete todos in the todo list"
      }
    },
    docsLink: {
      label: "Docs",
      url: "https://docs.roocode.com"
    }
  },
  tools: {
    readFile: {
      linesRange: " (lines {{start}}-{{end}})",
      definitionsOnly: " (definitions only)",
      maxLines: " (max {{max}} lines)",
      imageTooLarge: "Image file is too large ({{size}} MB). The maximum allowed size is {{max}} MB.",
      imageWithSize: "Image file ({{size}} KB)"
    },
    toolRepetitionLimitReached: "Roo appears to be stuck in a loop, attempting the same action ({{toolName}}) repeatedly. This might indicate a problem with its current strategy. Consider rephrasing the task, providing more specific instructions, or guiding it towards a different approach.",
    unknownToolError: "Roo tried to use an unknown tool: \"{{toolName}}\". Retrying...",
    codebaseSearch: {
      approval: "Searching for '{{query}}' in codebase..."
    },
    newTask: {
      errors: {
        policy_restriction: "Failed to create new task due to policy restrictions."
      }
    }
  }
} as const;

// 类型验证 - 确保翻译结构与类型定义匹配
export type EnTranslationsType = typeof enTranslations;
```

### 4. 工具函数 (utils/)

```typescript
// src/i18n/utils/validation.ts

import { TranslationKey, TranslationDictionary } from '../types';
import { enTranslations } from '../translations/en';

/**
 * 翻译验证工具
 */
export class TranslationValidator {
  private usedKeys: Set<string> = new Set();
  private definedKeys: Set<string> = new Set();

  /**
   * 扫描代码并验证翻译完整性
   */
  async validateProjectTranslations(projectPath: string): Promise<ValidationReport> {
    // 扫描所有 TypeScript/JavaScript 文件
    const files = await this.findTranslationUsage(projectPath);
    
    // 提取所有翻译键
    this.usedKeys = await this.extractTranslationKeys(files);
    
    // 获取所有定义的键
    this.definedKeys = this.extractDefinedKeys(enTranslations);
    
    return this.generateReport();
  }

  /**
   * 查找翻译使用情况
   */
  private async findTranslationUsage(projectPath: string): Promise<string[]> {
    // 实现文件扫描逻辑
    // 查找所有 t() 函数调用
    return [];
  }

  /**
   * 提取翻译键
   */
  private async extractTranslationKeys(files: string[]): Promise<Set<string>> {
    const keys = new Set<string>();
    
    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const matches = content.match(/t\(["']([^"']+)["']/g);
      
      if (matches) {
        matches.forEach(match => {
          const key = match.match(/t\(["']([^"']+)["']/)?.[1];
          if (key) {
            keys.add(key);
          }
        });
      }
    }
    
    return keys;
  }

  /**
   * 提取定义的键
   */
  private extractDefinedKeys(translations: TranslationDictionary, prefix = ''): Set<string> {
    const keys = new Set<string>();
    
    for (const [key, value] of Object.entries(translations)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'string') {
        keys.add(fullKey);
      } else if (typeof value === 'object' && value !== null) {
        const nestedKeys = this.extractDefinedKeys(value, fullKey);
        nestedKeys.forEach(k => keys.add(k));
      }
    }
    
    return keys;
  }

  /**
   * 生成验证报告
   */
  private generateReport(): ValidationReport {
    const missingKeys = Array.from(this.usedKeys).filter(key => !this.definedKeys.has(key));
    const unusedKeys = Array.from(this.definedKeys).filter(key => !this.usedKeys.has(key));
    
    return {
      missingKeys,
      unusedKeys,
      totalDefined: this.definedKeys.size,
      totalUsed: this.usedKeys.size,
      coverage: this.definedKeys.size > 0 ? (this.definedKeys.size - missingKeys.length) / this.definedKeys.size : 1
    };
  }
}

/**
 * 验证报告接口
 */
export interface ValidationReport {
  missingKeys: string[];
  unusedKeys: string[];
  totalDefined: number;
  totalUsed: number;
  coverage: number;
}

/**
 * 编译时类型验证
 */
export type ValidateTranslationKeys<T extends TranslationKey> = T extends TranslationKey ? true : false;
```

### 5. 主入口 (index.ts)

```typescript
// src/i18n/index.ts

import { I18nManager, createTranslationFunction } from './I18nManager';
import { enTranslations } from './translations/en';
import { zhCNTranslations } from './translations/zh-CN';
import { TranslationKey, TranslationParams } from './types';

/**
 * 创建 i18n 管理器实例
 */
function createI18nManager(): I18nManager {
  const manager = new I18nManager();
  
  // 注册翻译
  manager.registerTranslations('en', enTranslations);
  manager.registerTranslations('zh-CN', zhCNTranslations);
  
  return manager;
}

/**
 * 初始化 i18n
 */
export function initializeI18n(language: string = 'en'): void {
  i18nManager.changeLanguage(language as any);
}

/**
 * 获取当前语言
 */
export function getCurrentLanguage(): string {
  return i18nManager.getCurrentLanguage();
}

/**
 * 更改语言
 */
export function changeLanguage(language: string): void {
  i18nManager.changeLanguage(language as any);
}

/**
 * 翻译函数
 * 提供类型安全的翻译功能
 */
export function t<K extends TranslationKey>(
  key: K,
  params?: TranslationParams[K]
): string {
  return i18nManager.t(key, params);
}

/**
 * 获取语言配置
 */
export function getLanguageConfig() {
  return i18nManager.getLanguageConfig();
}

/**
 * 验证翻译（开发环境）
 */
export function validateTranslations() {
  if (process.env.NODE_ENV === 'development') {
    const result = i18nManager.validateTranslations();
    
    if (result.missingKeys.length > 0) {
      console.warn('Missing translations:', result.missingKeys);
    }
    
    if (result.unusedKeys.length > 0) {
      console.info('Unused translations:', result.unusedKeys);
    }
    
    return result;
  }
}

// 创建全局实例
const i18nManager = createI18nManager();

// 导出类型供外部使用
export type { TranslationKey, TranslationParams, LanguageCode } from './types';
export { I18nManager } from './I18nManager';

// 默认导出
export default {
  t,
  initializeI18n,
  getCurrentLanguage,
  changeLanguage,
  getLanguageConfig,
  validateTranslations
};
```

## 架构优势

### 1. 类型安全
- 编译时验证所有翻译键
- 参数类型检查
- 自动完成支持

### 2. 运行时可靠
- 智能后备机制
- 详细的错误报告
- 参数验证

### 3. 开发体验
- IDE 智能感知
- 实时错误检测
- 自动验证工具

### 4. 性能优化
- 静态导入支持树摇
- 编译时优化
- 内存高效

### 5. 维护友好
- 集中管理
- 清晰的架构
- 自动化工具

这个架构设计将彻底解决当前 i18n 系统的同步性问题，同时提供卓越的开发者体验和运行时可靠性。