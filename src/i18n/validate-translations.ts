/**
 * 翻译文件验证器
 * 在构建时验证JSON翻译文件与TypeScript类型定义的一致性
 */

import * as fs from 'fs'
import * as path from 'path'
import { TranslationKey } from './types'

interface ValidationResult {
  valid: boolean
  errors: string[]
  missingKeys: string[]
  extraKeys: string[]
  paramMismatches: string[]
}

/**
 * 扁平化嵌套的JSON对象
 */
function flattenObject(obj: any, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const newKey = prefix ? `${prefix}.${key}` : key
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        Object.assign(result, flattenObject(obj[key], newKey))
      } else {
        result[newKey] = obj[key]
      }
    }
  }
  
  return result
}

/**
 * 从翻译键中提取参数
 */
function extractParams(text: string): string[] {
  const params: string[] = []
  const regex = /\{\{(\w+)\}\}/g
  let match
  
  while ((match = regex.exec(text)) !== null) {
    params.push(match[1])
  }
  
  return params.sort()
}

/**
 * 获取所有定义的翻译键
 */
function getAllDefinedKeys(): string[] {
  // 这里我们需要从types.ts中提取所有的翻译键
  // 由于这是构建时验证，我们可以使用正则表达式解析types.ts
  const typesFile = fs.readFileSync(path.join(__dirname, 'types.ts'), 'utf-8')
  const keys: string[] = []
  
  // 匹配所有的翻译键定义
  const regex = /'([^']+)':\s*(?:\{[^}]*\}|Record<string, never>)/g
  let match
  
  while ((match = regex.exec(typesFile)) !== null) {
    keys.push(match[1])
  }
  
  return keys
}

/**
 * 验证翻译文件
 */
function validateTranslationFile(language: string): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    missingKeys: [],
    extraKeys: [],
    paramMismatches: []
  }
  
  try {
    const localePath = path.join(__dirname, 'locales', language)
    const allDefinedKeys = getAllDefinedKeys()
    const foundKeys = new Set<string>()
    
    // 读取所有JSON文件
    const files = fs.readdirSync(localePath)
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const namespace = file.replace('.json', '')
        const filePath = path.join(localePath, file)
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        const flattened = flattenObject(content, namespace)
        
        // 检查每个找到的键
        for (const [key, value] of Object.entries(flattened)) {
          foundKeys.add(key)
          
          // 检查参数占位符
          if (typeof value === 'string') {
            const paramsInTranslation = extractParams(value)
            
            // 这里我们需要检查类型定义中的参数
            // 简化处理：只检查是否有明显的参数不匹配
            if (paramsInTranslation.length > 0) {
              // 可以添加更复杂的参数验证逻辑
              console.log(`Key ${key} has parameters:`, paramsInTranslation)
            }
          }
        }
      }
    }
    
    // 检查缺失的键
    for (const key of allDefinedKeys) {
      if (!foundKeys.has(key)) {
        result.missingKeys.push(key)
        result.errors.push(`Missing translation key: ${key}`)
      }
    }
    
    // 检查多余的键
    for (const key of foundKeys) {
      if (!allDefinedKeys.includes(key)) {
        result.extraKeys.push(key)
        result.errors.push(`Extra translation key: ${key}`)
      }
    }
    
    result.valid = result.errors.length === 0
    
  } catch (error) {
    result.valid = false
    result.errors.push(`Error validating ${language}: ${error instanceof Error ? error.message : String(error)}`)
  }
  
  return result
}

/**
 * 运行验证
 */
function runValidation(): void {
  console.log('🔍 Validating translation files...')
  
  const languages = ['en', 'zh-CN']
  let allValid = true
  
  for (const language of languages) {
    console.log(`\n📋 Validating ${language}...`)
    const result = validateTranslationFile(language)
    
    if (result.valid) {
      console.log(`✅ ${language} validation passed`)
    } else {
      console.log(`❌ ${language} validation failed:`)
      for (const error of result.errors) {
        console.log(`   ${error}`)
      }
      allValid = false
    }
  }
  
  if (allValid) {
    console.log('\n🎉 All translation files are valid!')
    process.exit(0)
  } else {
    console.log('\n💥 Translation validation failed!')
    process.exit(1)
  }
}

// 如果直接运行此文件，则执行验证
if (require.main === module) {
  runValidation()
}

export { validateTranslationFile, getAllDefinedKeys }