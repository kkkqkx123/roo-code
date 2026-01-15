import { I18nManager } from './setup'
import { TranslationKey, TranslationParams, LanguageCode } from './types'
import * as fs from 'fs'
import * as path from 'path'

// Load translations from JSON files
function loadTranslationsFromFile(language: string): any {
	const localePath = path.join(__dirname, 'locales', language)
	const translations: any = {}
	
	try {
		// Read all JSON files in the language directory
		const files = fs.readdirSync(localePath)
		
		for (const file of files) {
			if (file.endsWith('.json')) {
				const namespace = file.replace('.json', '')
				const filePath = path.join(localePath, file)
				const content = fs.readFileSync(filePath, 'utf8')
				translations[namespace] = JSON.parse(content)
			}
		}
		
		return translations
	} catch (error) {
		console.warn(`Failed to load translations for ${language}:`, error)
		return {}
	}
}

// Create i18n manager instance
const i18nManager = new I18nManager({ debug: false })

// Load English translations
const enTranslations = loadTranslationsFromFile('en')
i18nManager.registerTranslations('en', enTranslations)

// Load Chinese translations  
const zhCNTranslations = loadTranslationsFromFile('zh-CN')
i18nManager.registerTranslations('zh-CN', zhCNTranslations)

// Export type-safe translation function
export function t<K extends TranslationKey>(
	key: K,
	params?: TranslationParams[K]
): string {
	return i18nManager.t(key, params)
}

// Export language change function
export function initializeI18n(language: string = 'en'): void {
	i18nManager.changeLanguage(language as LanguageCode)
}

// Export changeLanguage function for backward compatibility
export function changeLanguage(language: string): void {
	i18nManager.changeLanguage(language as LanguageCode)
}

// Export i18n manager for advanced usage
export { i18nManager }