#!/usr/bin/env node

/**
 * 翻译文件验证器
 * 验证JSON翻译文件与类型定义的一致性
 */

const fs = require('fs')
const path = require('path')

/**
 * 扁平化嵌套的JSON对象
 */
function flattenObject(obj, prefix = '') {
  const result = {}
  
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
 * 从types.ts文件中提取所有翻译键
 */
function getAllDefinedKeys() {
  const typesFile = fs.readFileSync(path.join(__dirname, 'types.ts'), 'utf-8')
  const keys = []
  
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
function validateTranslationFile(language) {
  const result = {
    valid: true,
    errors: [],
    missingKeys: [],
    extraKeys: []
  }
  
  try {
    const localePath = path.join(__dirname, 'locales', language)
    const allDefinedKeys = getAllDefinedKeys()
    const foundKeys = new Set()
    
    // 读取所有JSON文件
    const files = fs.readdirSync(localePath)
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const namespace = file.replace('.json', '')
        const filePath = path.join(localePath, file)
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        const flattened = flattenObject(content, namespace)
        
        // 收集所有找到的键
        for (const key of Object.keys(flattened)) {
          foundKeys.add(key)
        }
      }
    }
    
    // 检查缺失的键
    for (const key of allDefinedKeys) {
      if (!foundKeys.has(key)) {
        result.missingKeys.push(key)
        result.errors.push(`缺失翻译键: ${key}`)
      }
    }
    
    // 检查多余的键
    for (const key of foundKeys) {
      if (!allDefinedKeys.includes(key)) {
        result.extraKeys.push(key)
        result.errors.push(`多余翻译键: ${key}`)
      }
    }
    
    result.valid = result.errors.length === 0
    
  } catch (error) {
    result.valid = false
    result.errors.push(`验证${language}时出错: ${error.message}`)
  }
  
  return result
}

/**
 * 运行验证
 */
function runValidation() {
  console.log('🔍 正在验证翻译文件...')
  
  const languages = ['en', 'zh-CN']
  let allValid = true
  
  for (const language of languages) {
    console.log(`\n📋 验证 ${language}...`)
    const result = validateTranslationFile(language)
    
    if (result.valid) {
      console.log(`✅ ${language} 验证通过`)
    } else {
      console.log(`❌ ${language} 验证失败:`)
      for (const error of result.errors) {
        console.log(`   ${error}`)
      }
      allValid = false
    }
  }
  
  if (allValid) {
    console.log('\n🎉 所有翻译文件验证通过！')
    process.exit(0)
  } else {
    console.log('\n💥 翻译验证失败！')
    process.exit(1)
  }
}

// 运行验证
runValidation()