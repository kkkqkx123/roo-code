import {
  TranslationKey,
  TranslationParams,
  LanguageCode,
  TranslationDictionary,
  TranslationOptions,
  ValidationResult,
  LanguageConfig
} from './types'

/**
 * 翻译管理器 - 类型安全的国际化管理
 */
export class I18nManager {
  private currentLanguage: LanguageCode = 'en'
  private translations: Map<LanguageCode, TranslationDictionary> = new Map()
  private fallbackLanguage: LanguageCode = 'en'
  private options: TranslationOptions
  private translationCache: Map<string, string> = new Map()

  constructor(options: TranslationOptions = {}) {
    this.options = { fallback: true, debug: false, ...options }
  }

  /**
   * 注册翻译数据
   */
  registerTranslations(language: LanguageCode, translations: TranslationDictionary): void {
    this.translations.set(language, translations)
    
    if (this.options.debug) {
      console.log(`[i18n] Registered translations for: ${language}`)
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
    const opts = { ...this.options, ...options }
    const cacheKey = `${this.currentLanguage}:${key}:${JSON.stringify(params || {})}`
    
    // 检查缓存
    if (this.translationCache.has(cacheKey)) {
      return this.translationCache.get(cacheKey)!
    }
    
    try {
      // 尝试获取当前语言的翻译
      const translation = this.getTranslation(key, this.currentLanguage)
      
      if (translation) {
        const result = this.interpolate(translation, params || {})
        this.translationCache.set(cacheKey, result)
        return result
      }

      // 尝试后备语言
      if (opts.fallback && this.currentLanguage !== this.fallbackLanguage) {
        const fallbackTranslation = this.getTranslation(key, this.fallbackLanguage)
        
        if (fallbackTranslation) {
          if (opts.debug) {
            console.warn(`[i18n] Using fallback translation for: ${key}`)
          }
          const result = this.interpolate(fallbackTranslation, params || {})
          this.translationCache.set(cacheKey, result)
          return result
        }
      }

      // 生成友好的后备文本
      const fallbackResult = this.generateFallbackText(key, params)
      this.translationCache.set(cacheKey, fallbackResult)
      return fallbackResult
      
    } catch (error) {
      if (opts.debug) {
        console.error(`[i18n] Translation error for key: ${key}`, error)
      }
      const fallbackResult = this.generateFallbackText(key, params)
      this.translationCache.set(cacheKey, fallbackResult)
      return fallbackResult
    }
  }

  /**
   * 批量获取翻译
   */
  translateBatch(
    keys: TranslationKey[],
    params?: Partial<Record<TranslationKey, any>>
  ): Record<TranslationKey, string> {
    const result = {} as Record<TranslationKey, string>
    
    for (const key of keys) {
      result[key] = this.t(key, params?.[key])
    }
    
    return result
  }

  /**
   * 更改语言
   */
  changeLanguage(language: LanguageCode): void {
    if (this.translations.has(language)) {
      const oldLanguage = this.currentLanguage
      this.currentLanguage = language
      this.translationCache.clear() // 清除缓存
      
      if (this.options.debug) {
        console.log(`[i18n] Language changed: ${oldLanguage} -> ${language}`)
      }
    } else {
      if (this.options.debug) {
        console.warn(`[i18n] Language not available: ${language}`)
      }
    }
  }

  /**
   * 获取当前语言
   */
  getCurrentLanguage(): LanguageCode {
    return this.currentLanguage
  }

  /**
   * 获取语言配置
   */
  getLanguageConfig(language?: LanguageCode): LanguageConfig {
    const lang = language || this.currentLanguage
    const configs: Record<LanguageCode, LanguageConfig> = {
      'en': { code: 'en', name: 'English', direction: 'ltr' },
      'zh-CN': { code: 'zh-CN', name: '简体中文', direction: 'ltr' }
    }
    return configs[lang]
  }

  /**
   * 获取可用语言列表
   */
  getAvailableLanguages(): LanguageCode[] {
    return Array.from(this.translations.keys())
  }

  /**
   * 验证翻译完整性
   */
  validateTranslations(): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      missingKeys: [],
      unusedKeys: [],
      invalidParams: [],
      totalKeys: 0,
      coverage: 0
    }

    // 获取所有翻译键（这里简化处理，实际应该扫描代码库）
    const allKeys = this.getAllTranslationKeys()
    const definedKeys = this.extractDefinedKeys()
    
    result.totalKeys = allKeys.length
    
    // 检查缺失的键
    for (const key of allKeys) {
      if (!this.keyExists(key)) {
        result.missingKeys.push(key)
      }
    }
    
    // 检查未使用的键
    for (const key of definedKeys) {
      if (!allKeys.includes(key as TranslationKey)) {
        result.unusedKeys.push(key)
      }
    }
    
    // 计算覆盖率
    result.coverage = result.totalKeys > 0 
      ? (result.totalKeys - result.missingKeys.length) / result.totalKeys 
      : 1

    return result
  }

  /**
   * 私有方法：获取翻译
   */
  private getTranslation(key: TranslationKey, language: LanguageCode): string | null {
    const translationDict = this.translations.get(language)
    if (!translationDict) {
      return null
    }

    const keys = key.split('.')
    let current: any = translationDict

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k]
      } else {
        return null
      }
    }

    return typeof current === 'string' ? current : null
  }

  /**
   * 私有方法：插值替换
   */
  private interpolate(template: string, params: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] !== undefined ? String(params[key]) : match
    })
  }

  /**
   * 私有方法：生成后备文本
   */
  private generateFallbackText<K extends TranslationKey>(key: K, params?: TranslationParams[K]): string {
    // 提取键的最后部分
    const keyParts = key.split('.')
    const displayKey = keyParts[keyParts.length - 1]
    
    // 格式化显示文本
    const displayText = displayKey
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l: string) => l.toUpperCase())

    // 如果有参数，显示参数信息
    if (params && Object.keys(params).length > 0) {
      const paramInfo = Object.keys(params).join(', ')
      return `[${displayText}] (${paramInfo})`
    }

    return `[${displayText}]`
  }

  /**
   * 私有方法：检查键是否存在
   */
  private keyExists(key: TranslationKey): boolean {
    // 检查当前语言
    if (this.getTranslation(key, this.currentLanguage)) {
      return true
    }
    
    // 检查后备语言
    if (this.currentLanguage !== this.fallbackLanguage) {
      return this.getTranslation(key, this.fallbackLanguage) !== null
    }
    
    return false
  }

  /**
   * 私有方法：获取所有翻译键（简化版本）
   */
  private getAllTranslationKeys(): TranslationKey[] {
    // 这里应该扫描代码库获取所有实际使用的键
    // 为了演示，返回一些常用键
    return [
      'common:errors.nested_git_repos_warning',
      'common:errors.checkpoint_timeout',
      'common:errors.git_not_installed',
      'common:errors.checkpoint_no_first',
      'common:errors.checkpoint_no_previous',
      'common:errors.checkpoint_no_changes',
      'common:errors.no_workspace',
      'common:errors.save_api_config',
      'common:errors.load_api_config',
      'common:errors.delete_api_config',
      'common:errors.wait_checkpoint_long_time',
      'common:errors.init_checkpoint_fail_long_time',
      'tools:readFile.linesRange',
      'tools:readFile.imageTooLarge',
      'tools:unknownToolError',
      'mcp:errors.serverNotFound',
      'mcp:errors.toolNotFound',
      'embeddings:orchestrator.indexingRequiresWorkspace',
      'common:info.clipboard_copy',
      'common:buttons.learn_more',
      'common:confirmation.reset_state'
    ]
  }

  /**
   * 私有方法：提取定义的键
   */
  private extractDefinedKeys(): string[] {
    const keys: string[] = []
    
    for (const [lang, translations] of this.translations) {
      const langKeys = this.extractKeysFromDict(translations)
      keys.push(...langKeys)
    }
    
    return [...new Set(keys)] // 去重
  }

  /**
   * 私有方法：从字典提取键
   */
  private extractKeysFromDict(dict: TranslationDictionary, prefix = ''): string[] {
    const keys: string[] = []
    
    for (const [key, value] of Object.entries(dict)) {
      const fullKey = prefix ? `${prefix}.${key}` : key
      
      if (typeof value === 'string') {
        keys.push(fullKey)
      } else if (typeof value === 'object' && value !== null) {
        const nestedKeys = this.extractKeysFromDict(value, fullKey)
        keys.push(...nestedKeys)
      }
    }
    
    return keys
  }
}