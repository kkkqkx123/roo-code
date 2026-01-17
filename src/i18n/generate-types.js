import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const localesPath = path.join(__dirname, 'locales')
const outputPath = path.join(__dirname, 'types.ts')

function extractKeys(obj, prefix = '') {
  const keys = []
  
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    
    if (typeof value === 'string') {
      keys.push(fullKey)
    } else if (typeof value === 'object' && value !== null) {
      keys.push(...extractKeys(value, fullKey))
    }
  }
  
  return keys
}

function detectParams(template) {
  const params = {}
  const regex = /\{\{(\w+)\}\}/g
  let match
  
  while ((match = regex.exec(template)) !== null) {
    params[match[1]] = 'string'
  }
  
  return params
}

function generateTypeDefinition(namespace, data) {
  const keys = extractKeys(data)
  const sortedKeys = keys.sort()
  
  let content = `  // ${namespace} namespace\n`
  
  for (const key of sortedKeys) {
    const value = key.split('.').reduce((obj, k) => obj[k], data)
    const params = typeof value === 'string' ? detectParams(value) : {}
    
    if (Object.keys(params).length > 0) {
      content += `  '${namespace}:${key}': { ${Object.entries(params).map(([k, v]) => `${k}: ${v}`).join(', ')} }\n`
    } else {
      content += `  '${namespace}:${key}': Record<string, never>\n`
    }
  }
  
  return content
}

function generateAllTypes() {
  const namespaces = {}
  
  const enPath = path.join(localesPath, 'en')
  const files = fs.readdirSync(enPath)
  
  for (const file of files) {
    if (file.endsWith('.json')) {
      const namespace = file.replace('.json', '')
      const filePath = path.join(enPath, file)
      const content = fs.readFileSync(filePath, 'utf8')
      const data = JSON.parse(content)
      namespaces[namespace] = data
    }
  }
  
  let output = `/**\n * 类型安全的国际化翻译键定义\n * 定义所有可用的翻译键及其参数类型\n * \n * ⚠️ 此文件由 generate-types.js 自动生成，请勿手动编辑\n * 如需修改翻译，请编辑 locales/ 目录下的 JSON 文件，然后运行: node generate-types.js\n */\n\n`
  output += `/**\n * 翻译参数接口 - 定义每个翻译键的参数类型\n */\nexport interface TranslationParams {\n`
  
  for (const [namespace, data] of Object.entries(namespaces)) {
    output += generateTypeDefinition(namespace, data)
  }
  
  output += `}\n\n`
  output += `/**\n * 翻译键类型 - 所有可用的翻译键\n */\nexport type TranslationKey = keyof TranslationParams\n\n`
  output += `/**\n * 语言代码类型\n */\nexport type LanguageCode = 'en' | 'zh-CN'\n\n`
  output += `/**\n * 翻译函数类型\n */\nexport type TranslationFunction = <K extends TranslationKey>(key: K, params?: TranslationParams[K]) => string\n\n`
  output += `/**\n * 翻译字典类型 - 支持嵌套结构\n */\nexport interface TranslationDictionary {\n  [key: string]: string | TranslationDictionary\n}\n\n`
  output += `/**\n * 翻译选项接口\n */\nexport interface TranslationOptions {\n  /**\n   * 是否启用回退到默认语言\n   */\n  fallback?: boolean\n  /**\n   * 是否启用调试模式\n   */\n  debug?: boolean\n  /**\n   * 自定义格式化函数\n   */\n  formatter?: (text: string, params?: Record<string, any>) => string\n  /**\n   * 是否启用缓存\n   */\n  cache?: boolean\n}\n\n`
  output += `/**\n * 验证结果接口\n */\nexport interface ValidationResult {\n  /**\n   * 验证是否通过\n   */\n  valid: boolean\n  /**\n   * 错误信息\n   */\n  errors: string[]\n  /**\n   * 缺失的翻译键\n   */\n  missingKeys: string[]\n  /**\n   * 未使用的翻译键\n   */\n  unusedKeys: string[]\n  /**\n   * 无效的参数\n   */\n  invalidParams: string[]\n  /**\n   * 总键数\n   */\n  totalKeys: number\n  /**\n   * 覆盖率（0-1之间）\n   */\n  coverage: number\n}\n\n`
  output += `/**\n * 语言配置接口\n */\nexport interface LanguageConfig {\n  code: LanguageCode\n  name: string\n  direction: 'ltr' | 'rtl'\n}\n`
  
  fs.writeFileSync(outputPath, output, 'utf8')

  const totalKeys = Object.values(namespaces).reduce((sum, data) => sum + extractKeys(data).length, 0)
  /* global console */
  console.log(`Generated type definitions at: ${outputPath}`)
  console.log(`Namespaces: ${Object.keys(namespaces).join(', ')}`)
  console.log(`Total keys: ${totalKeys}`)
}

generateAllTypes()
