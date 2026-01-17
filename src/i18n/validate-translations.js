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
  const typesFile = fs.readFileSync(path.join(__dirname, 'types.ts'), 'utf8')
  const keys = []
  
  const regex = /'([^']+)':\s*(?:\{[^}]*\}|Record<string, never>)/g
  let match
  
  while ((match = regex.exec(typesFile)) !== null) {
    keys.push(match[1])
  }
  
  return keys
}

/**
 * 验证单个JSON文件
 */
function validateJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    JSON.parse(content)
    return { valid: true, error: null }
  } catch (error) {
    return { valid: false, error: error.message }
  }
}

/**
 * 验证翻译文件
 */
function validateTranslationFile(language) {
  const result = {
    valid: true,
    errors: [],
    warnings: [],
    missingKeys: [],
    extraKeys: []
  }
  
  try {
    const localePath = path.join(__dirname, 'locales', language)
    const allDefinedKeys = getAllDefinedKeys()
    const foundKeys = new Set()
    
    if (!fs.existsSync(localePath)) {
      result.valid = false
      result.errors.push(`语言目录不存在: ${localePath}`)
      return result
    }
    
    const files = fs.readdirSync(localePath)
    
    for (const file of files) {
      if (!file.endsWith('.json')) {
        continue
      }
      
      const namespace = file.replace('.json', '')
      const filePath = path.join(localePath, file)
      
      const jsonValidation = validateJsonFile(filePath)
      if (!jsonValidation.valid) {
        result.valid = false
        result.errors.push(`JSON格式错误 (${file}): ${jsonValidation.error}`)
        continue
      }
      
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      const flattened = flattenObject(content, namespace)
      
      for (const key of Object.keys(flattened)) {
        foundKeys.add(key)
      }
    }
    
    for (const key of allDefinedKeys) {
      if (!foundKeys.has(key)) {
        result.missingKeys.push(key)
        result.errors.push(`缺失翻译键: ${key}`)
      }
    }
    
    for (const key of foundKeys) {
      if (!allDefinedKeys.includes(key)) {
        result.extraKeys.push(key)
        result.warnings.push(`多余翻译键: ${key}`)
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
 * 验证所有语言
 */
function validateAllLanguages() {
  const localesPath = path.join(__dirname, 'locales')
  const languages = fs.readdirSync(localesPath).filter(dir => 
    fs.statSync(path.join(localesPath, dir)).isDirectory()
  )
  
  let allValid = true
  const results = {}
  
  for (const language of languages) {
    console.log(`\n📋 验证 ${language}...`)
    results[language] = validateTranslationFile(language)
    
    if (results[language].valid) {
      console.log(`✅ ${language} 验证通过`)
      if (results[language].warnings.length > 0) {
        console.log(`⚠️  警告:`)
        for (const warning of results[language].warnings) {
          console.log(`   ${warning}`)
        }
      }
    } else {
      console.log(`❌ ${language} 验证失败:`)
      for (const error of results[language].errors) {
        console.log(`   ${error}`)
      }
      allValid = false
    }
  }
  
  console.log(`\n🔍 检查语言间一致性...`)
  const enKeys = new Set(Object.keys(flattenAllTranslations('en')))
  const otherLanguages = languages.filter(lang => lang !== 'en')
  
  for (const language of otherLanguages) {
    const langKeys = new Set(Object.keys(flattenAllTranslations(language)))
    const missingInLang = [...enKeys].filter(key => !langKeys.has(key))
    const extraInLang = [...langKeys].filter(key => !enKeys.has(key))
    
    if (missingInLang.length > 0) {
      console.log(`⚠️  ${language} 缺失以下翻译键（英文存在）:`)
      for (const key of missingInLang) {
        console.log(`   ${key}`)
      }
      allValid = false
    }
    
    if (extraInLang.length > 0) {
      console.log(`⚠️  ${language} 有以下多余翻译键（英文不存在）:`)
      for (const key of extraInLang) {
        console.log(`   ${key}`)
      }
      allValid = false
    }
  }
  
  return allValid
}

/**
 * 扁平化所有翻译
 */
function flattenAllTranslations(language) {
  const localePath = path.join(__dirname, 'locales', language)
  const result = {}
  
  const files = fs.readdirSync(localePath)
  for (const file of files) {
    if (file.endsWith('.json')) {
      const namespace = file.replace('.json', '')
      const filePath = path.join(localePath, file)
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      Object.assign(result, flattenObject(content, namespace))
    }
  }
  
  return result
}

/**
 * 运行验证
 */
function runValidation() {
  console.log('🔍 正在验证翻译文件...')
  console.log('=====================================')
  
  const allValid = validateAllLanguages()
  
  console.log('\n=====================================')
  
  if (allValid) {
    console.log('🎉 所有翻译文件验证通过！')
    process.exit(0)
  } else {
    console.log('💥 翻译验证失败！')
    console.log('\n💡 提示:')
    console.log('   1. 运行 "node generate-types.js" 重新生成类型定义')
    console.log('   2. 确保所有语言都包含相同的翻译键')
    console.log('   3. 检查 JSON 文件格式是否正确')
    process.exit(1)
  }
}

runValidation()
