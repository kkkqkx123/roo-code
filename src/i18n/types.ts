/**
 * 类型安全的国际化翻译键定义
 * 定义所有可用的翻译键及其参数类型
 * 
 * ⚠️ 此文件由 generate-types.js 自动生成，请勿手动编辑
 * 如需修改翻译，请编辑 locales/ 目录下的 JSON 文件，然后运行: node generate-types.js
 */

/**
 * 翻译参数接口 - 定义每个翻译键的参数类型
 */
export interface TranslationParams {
  // common namespace
  'common:answers.keep': Record<string, never>
  'common:answers.no': Record<string, never>
  'common:answers.remove': Record<string, never>
  'common:answers.yes': Record<string, never>
  'common:buttons.edit': Record<string, never>
  'common:buttons.learn_more': Record<string, never>
  'common:buttons.save': Record<string, never>
  'common:commands.preventCompletionWithOpenTodos.description': Record<string, never>
  'common:confirmation.delete_config_profile': Record<string, never>
  'common:confirmation.delete_custom_mode_with_rules': Record<string, never>
  'common:confirmation.reset_state': Record<string, never>
  'common:customModes.errors.deleteFailed': { error: string }
  'common:customModes.errors.invalidFormat': Record<string, never>
  'common:customModes.errors.modeNotFound': Record<string, never>
  'common:customModes.errors.noWorkspaceForProject': Record<string, never>
  'common:customModes.errors.resetFailed': { error: string }
  'common:customModes.errors.rulesCleanupFailed': { rulesFolderPath: string }
  'common:customModes.errors.schemaValidationError': { issues: string }
  'common:customModes.errors.updateFailed': { error: string }
  'common:customModes.errors.yamlParseError': { line: string }
  'common:customModes.scope.global': Record<string, never>
  'common:customModes.scope.project': Record<string, never>
  'common:docsLink.label': Record<string, never>
  'common:docsLink.url': Record<string, never>
  'common:errors.api.invalidKeyInvalidChars': Record<string, never>
  'common:errors.attempt_completion_tool_failed': Record<string, never>
  'common:errors.cannot_access_path': { path: string, error: string }
  'common:errors.cerebras.accessForbidden': Record<string, never>
  'common:errors.cerebras.authenticationFailed': Record<string, never>
  'common:errors.cerebras.completionError': { error: string }
  'common:errors.cerebras.genericError': { status: string, message: string }
  'common:errors.cerebras.noResponseBody': Record<string, never>
  'common:errors.cerebras.rateLimitExceeded': Record<string, never>
  'common:errors.cerebras.serverError': { status: string }
  'common:errors.checkpoint_diff_since_first': Record<string, never>
  'common:errors.checkpoint_diff_to_current': Record<string, never>
  'common:errors.checkpoint_diff_with_next': Record<string, never>
  'common:errors.checkpoint_failed': Record<string, never>
  'common:errors.checkpoint_no_changes': Record<string, never>
  'common:errors.checkpoint_no_first': Record<string, never>
  'common:errors.checkpoint_no_previous': Record<string, never>
  'common:errors.checkpoint_timeout': Record<string, never>
  'common:errors.claudeCode.apiKeyModelPlanMismatch': Record<string, never>
  'common:errors.claudeCode.errorOutput': { output: string }
  'common:errors.claudeCode.notAuthenticated': Record<string, never>
  'common:errors.claudeCode.processExited': { exitCode: string }
  'common:errors.claudeCode.processExitedWithError': { exitCode: string, output: string }
  'common:errors.claudeCode.stoppedWithReason': { reason: string }
  'common:errors.command_already_exists': { commandName: string }
  'common:errors.command_not_found': { name: string }
  'common:errors.command_template_content': Record<string, never>
  'common:errors.command_timeout': { seconds: string }
  'common:errors.condense_context_grew': Record<string, never>
  'common:errors.condense_failed': Record<string, never>
  'common:errors.condense_handler_invalid': Record<string, never>
  'common:errors.condense_not_enough_messages': Record<string, never>
  'common:errors.condensed_recently': Record<string, never>
  'common:errors.could_not_open_file': { errorMessage: string }
  'common:errors.could_not_open_file_generic': Record<string, never>
  'common:errors.create_api_config': Record<string, never>
  'common:errors.create_command_failed': Record<string, never>
  'common:errors.custom_storage_path_unusable': { path: string }
  'common:errors.delete_api_config': Record<string, never>
  'common:errors.delete_command': Record<string, never>
  'common:errors.delete_rules_folder_failed': { rulesFolderPath: string, error: string }
  'common:errors.enhance_prompt': Record<string, never>
  'common:errors.error_copying_image': { errorMessage: string }
  'common:errors.error_opening_image': { error: string }
  'common:errors.error_saving_image': { errorMessage: string }
  'common:errors.failed_delete_repo': { error: string }
  'common:errors.failed_remove_directory': { error: string }
  'common:errors.gemini.generate_complete_prompt': { error: string }
  'common:errors.gemini.generate_stream': { error: string }
  'common:errors.gemini.sources': Record<string, never>
  'common:errors.gemini.thinking_complete_no_output': Record<string, never>
  'common:errors.gemini.thinking_complete_recitation': Record<string, never>
  'common:errors.gemini.thinking_complete_safety': Record<string, never>
  'common:errors.gemini.thinking_complete_truncated': Record<string, never>
  'common:errors.get_system_prompt': Record<string, never>
  'common:errors.git_not_installed': Record<string, never>
  'common:errors.hmr_not_running': Record<string, never>
  'common:errors.init_checkpoint_fail_long_time': { timeout: string }
  'common:errors.invalid_data_uri': Record<string, never>
  'common:errors.invalid_mode': { mode: string }
  'common:errors.list_api_config': Record<string, never>
  'common:errors.load_api_config': Record<string, never>
  'common:errors.message.cannot_delete_invalid_timestamp': Record<string, never>
  'common:errors.message.cannot_delete_missing_timestamp': Record<string, never>
  'common:errors.message.error_deleting_message': { error: string }
  'common:errors.message.error_editing_message': { error: string }
  'common:errors.message.invalid_timestamp_for_deletion': Record<string, never>
  'common:errors.message.message_not_found': { messageTs: string }
  'common:errors.message.no_active_task_to_delete': Record<string, never>
  'common:errors.missing_param': { paramName: string, toolName: string, relPath: string }
  'common:errors.mistake_limit_guidance': Record<string, never>
  'common:errors.mode_import_failed': { error: string }
  'common:errors.nested_git_repos_warning': { path: string }
  'common:errors.no_internet': Record<string, never>
  'common:errors.no_workspace': Record<string, never>
  'common:errors.no_workspace_for_project_command': Record<string, never>
  'common:errors.open_command_file': Record<string, never>
  'common:errors.rename_api_config': Record<string, never>
  'common:errors.reset_support_prompt': Record<string, never>
  'common:errors.retrieve_current_mode': Record<string, never>
  'common:errors.save_api_config': Record<string, never>
  'common:errors.search_commits': Record<string, never>
  'common:errors.settings_import_failed': { error: string }
  'common:errors.share_auth_required': Record<string, never>
  'common:errors.share_no_active_task': Record<string, never>
  'common:errors.share_not_enabled': Record<string, never>
  'common:errors.share_task_failed': Record<string, never>
  'common:errors.share_task_not_found': Record<string, never>
  'common:errors.update_server_timeout': Record<string, never>
  'common:errors.update_support_prompt': Record<string, never>
  'common:errors.url_fetch_error_with_url': { url: string, error: string }
  'common:errors.url_fetch_failed': { error: string }
  'common:errors.url_forbidden': Record<string, never>
  'common:errors.url_not_found': Record<string, never>
  'common:errors.url_page_not_found': Record<string, never>
  'common:errors.url_request_aborted': Record<string, never>
  'common:errors.url_timeout': Record<string, never>
  'common:errors.violated_organization_allowlist': Record<string, never>
  'common:errors.wait_checkpoint_long_time': { timeout: string }
  'common:extension.description': Record<string, never>
  'common:extension.name': Record<string, never>
  'common:info.auto_import_success': { filename: string }
  'common:info.clipboard_copy': Record<string, never>
  'common:info.custom_storage_path_set': { path: string }
  'common:info.default_storage_path': Record<string, never>
  'common:info.history_cleanup': { count: string }
  'common:info.image_copied_to_clipboard': Record<string, never>
  'common:info.image_saved': { path: string }
  'common:info.mode_exported': { mode: string }
  'common:info.mode_imported': Record<string, never>
  'common:info.no_changes': Record<string, never>
  'common:info.organization_share_link_copied': Record<string, never>
  'common:info.path_copied_to_clipboard': Record<string, never>
  'common:info.public_share_link_copied': Record<string, never>
  'common:info.settings_imported': Record<string, never>
  'common:info.share_link_copied': Record<string, never>
  'common:input.task_placeholder': Record<string, never>
  'common:input.task_prompt': Record<string, never>
  'common:interruption.responseInterruptedByApiError': Record<string, never>
  'common:interruption.responseInterruptedByUser': Record<string, never>
  'common:items.one': Record<string, never>
  'common:items.other': { count: string }
  'common:items.zero': Record<string, never>
  'common:marketplace.mode.rulesCleanupFailed': { rulesFolderPath: string }
  'common:number_format.billion_suffix': Record<string, never>
  'common:number_format.million_suffix': Record<string, never>
  'common:number_format.thousand_suffix': Record<string, never>
  'common:prompts.deleteMode.confirm': Record<string, never>
  'common:prompts.deleteMode.description': { scope: string, rulesFolderPath: string }
  'common:prompts.deleteMode.descriptionNoRules': Record<string, never>
  'common:prompts.deleteMode.title': Record<string, never>
  'common:storage.enter_absolute_path': Record<string, never>
  'common:storage.enter_valid_path': Record<string, never>
  'common:storage.path_placeholder': Record<string, never>
  'common:storage.prompt_custom_path': Record<string, never>
  'common:tasks.canceled': Record<string, never>
  'common:tasks.deleted': Record<string, never>
  'common:tasks.incomplete': { taskNumber: string }
  'common:tasks.no_messages': { taskNumber: string }
  'common:warnings.auto_import_failed': { error: string }
  'common:warnings.missing_task_files': Record<string, never>
  'common:warnings.no_terminal_content': Record<string, never>
  'common:welcome': { name: string, count: string }
  // embeddings namespace
  'embeddings:authenticationFailed': Record<string, never>
  'embeddings:failedMaxAttempts': { attempts: string }
  'embeddings:failedWithError': { attempts: string, errorMessage: string }
  'embeddings:failedWithStatus': { attempts: string, statusCode: string, errorMessage: string }
  'embeddings:openai.invalidResponseFormat': Record<string, never>
  'embeddings:orchestrator.failedDuringInitialScan': { errorMessage: string }
  'embeddings:orchestrator.failedToConnect': { errorMessage: string }
  'embeddings:orchestrator.fileWatcherStarted': Record<string, never>
  'embeddings:orchestrator.fileWatcherStopped': Record<string, never>
  'embeddings:orchestrator.indexingFailedCritical': Record<string, never>
  'embeddings:orchestrator.indexingFailedNoBlocks': Record<string, never>
  'embeddings:orchestrator.indexingRequiresWorkspace': Record<string, never>
  'embeddings:orchestrator.unexpectedError': { errorMessage: string }
  'embeddings:orchestrator.unknownError': Record<string, never>
  'embeddings:rateLimitRetry': { delayMs: string, attempt: string, maxRetries: string }
  'embeddings:scanner.failedToProcessBatchWithError': { maxRetries: string, errorMessage: string }
  'embeddings:scanner.unknownErrorDeletingPoints': { filePath: string }
  'embeddings:scanner.unknownErrorProcessingFile': { filePath: string }
  'embeddings:serviceFactory.codeIndexingNotConfigured': Record<string, never>
  'embeddings:serviceFactory.geminiConfigMissing': Record<string, never>
  'embeddings:serviceFactory.invalidEmbedderType': { embedderProvider: string }
  'embeddings:serviceFactory.openAiCompatibleConfigMissing': Record<string, never>
  'embeddings:serviceFactory.openAiConfigMissing': Record<string, never>
  'embeddings:serviceFactory.qdrantUrlMissing': Record<string, never>
  'embeddings:serviceFactory.vectorDimensionNotDetermined': { modelId: string, provider: string }
  'embeddings:serviceFactory.vectorDimensionNotDeterminedOpenAiCompatible': { modelId: string, provider: string }
  'embeddings:textExceedsTokenLimit': { index: string, itemTokens: string, maxTokens: string }
  'embeddings:textWithPrefixExceedsTokenLimit': { text: string, prefix: string, tokenLimit: string }
  'embeddings:unknownError': Record<string, never>
  'embeddings:validation.apiKeyRequired': Record<string, never>
  'embeddings:validation.authenticationFailed': Record<string, never>
  'embeddings:validation.baseUrlRequired': Record<string, never>
  'embeddings:validation.configurationError': Record<string, never>
  'embeddings:validation.connectionFailed': Record<string, never>
  'embeddings:validation.invalidApiKey': Record<string, never>
  'embeddings:validation.invalidBaseUrl': Record<string, never>
  'embeddings:validation.invalidEmbedderConfig': Record<string, never>
  'embeddings:validation.invalidEndpoint': Record<string, never>
  'embeddings:validation.invalidModel': Record<string, never>
  'embeddings:validation.invalidResponse': Record<string, never>
  'embeddings:validation.modelNotAvailable': Record<string, never>
  'embeddings:validation.serviceUnavailable': Record<string, never>
  'embeddings:vectorStore.qdrantConnectionFailed': { qdrantUrl: string, errorMessage: string }
  'embeddings:vectorStore.vectorDimensionMismatch': { errorMessage: string }
  // mcp namespace
  'mcp:errors.create_json': { error: string }
  'mcp:errors.disconnect_servers_partial': { count: string }
  'mcp:errors.failed_update_project': Record<string, never>
  'mcp:errors.invalidJsonArgument': { toolName: string }
  'mcp:errors.invalid_settings_format': Record<string, never>
  'mcp:errors.invalid_settings_syntax': Record<string, never>
  'mcp:errors.invalid_settings_validation': { errorMessages: string }
  'mcp:errors.refresh_after_disable': Record<string, never>
  'mcp:errors.refresh_after_enable': Record<string, never>
  'mcp:errors.serverNotFound': { serverName: string, availableServers: string }
  'mcp:errors.toolDisabled': { toolName: string, serverName: string, availableTools: string }
  'mcp:errors.toolNotFound': { toolName: string, serverName: string, availableTools: string }
  'mcp:info.all_refreshed': Record<string, never>
  'mcp:info.already_refreshing': Record<string, never>
  'mcp:info.global_servers_active': { mcpServers: string }
  'mcp:info.project_config_deleted': Record<string, never>
  'mcp:info.project_servers_active': { mcpServers: string }
  'mcp:info.refreshing_all': Record<string, never>
  'mcp:info.server_connected': { serverName: string }
  'mcp:info.server_deleted': { serverName: string }
  'mcp:info.server_not_found': { serverName: string }
  'mcp:info.server_restarting': { serverName: string }
  // tools namespace
  'tools:codebaseSearch.approval': { query: string }
  'tools:generateImage.failedWithMessage': { message: string }
  'tools:generateImage.failedWithStatus': { status: string }
  'tools:generateImage.invalidImageData': Record<string, never>
  'tools:generateImage.invalidImageFormat': Record<string, never>
  'tools:generateImage.noImageGenerated': Record<string, never>
  'tools:generateImage.unknownError': Record<string, never>
  'tools:newTask.errors.policy_restriction': Record<string, never>
  'tools:readFile.definitionsOnly': Record<string, never>
  'tools:readFile.imageTooLarge': { size: string, max: string }
  'tools:readFile.imageWithSize': { size: string }
  'tools:readFile.linesRange': { start: string, end: string }
  'tools:readFile.maxLines': { max: string }
  'tools:toolRepetitionLimitReached': { toolName: string }
  'tools:unknownToolError': { toolName: string }
}

/**
 * 翻译键类型 - 所有可用的翻译键
 */
export type TranslationKey = keyof TranslationParams

/**
 * 语言代码类型
 */
export type LanguageCode = 'en' | 'zh-CN'

/**
 * 翻译函数类型
 */
export type TranslationFunction = <K extends TranslationKey>(key: K, params?: TranslationParams[K]) => string

/**
 * 翻译字典类型 - 支持嵌套结构
 */
export interface TranslationDictionary {
  [key: string]: string | TranslationDictionary
}

/**
 * 翻译选项接口
 */
export interface TranslationOptions {
  /**
   * 是否启用回退到默认语言
   */
  fallback?: boolean
  /**
   * 是否启用调试模式
   */
  debug?: boolean
  /**
   * 自定义格式化函数
   */
  formatter?: (text: string, params?: Record<string, any>) => string
  /**
   * 是否启用缓存
   */
  cache?: boolean
}

/**
 * 验证结果接口
 */
export interface ValidationResult {
  /**
   * 验证是否通过
   */
  valid: boolean
  /**
   * 错误信息
   */
  errors: string[]
  /**
   * 缺失的翻译键
   */
  missingKeys: string[]
  /**
   * 未使用的翻译键
   */
  unusedKeys: string[]
  /**
   * 无效的参数
   */
  invalidParams: string[]
  /**
   * 总键数
   */
  totalKeys: number
  /**
   * 覆盖率（0-1之间）
   */
  coverage: number
}

/**
 * 语言配置接口
 */
export interface LanguageConfig {
  code: LanguageCode
  name: string
  direction: 'ltr' | 'rtl'
}
