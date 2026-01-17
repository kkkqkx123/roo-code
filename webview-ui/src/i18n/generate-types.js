import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const localesPath = path.join(__dirname, 'locales/en')
const outputPath = path.join(__dirname, 'types.generated.ts')

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
  
  let content = `// Auto-generated type definitions for ${namespace} namespace\n`
  content += `// DO NOT EDIT MANUALLY - regenerate by running: node generate-types.js\n\n`
  content += `export interface ${namespace}Params {\n`
  
  for (const key of sortedKeys) {
    const value = key.split('.').reduce((obj, k) => obj[k], data)
    const params = typeof value === 'string' ? detectParams(value) : {}
    
    if (Object.keys(params).length > 0) {
      content += `  '${namespace}:${key}': { ${Object.entries(params).map(([k, v]) => `${k}: ${v}`).join(', ')} }\n`
    } else {
      content += `  '${namespace}:${key}': Record<string, never>\n`
    }
  }
  
  content += `}\n\n`
  content += `export type ${namespace}Key = keyof ${namespace}Params\n`
  
  return content
}

function generateAllTypes() {
  const namespaces = {}
  
  const files = fs.readdirSync(localesPath)
  for (const file of files) {
    if (file.endsWith('.json')) {
      const namespace = file.replace('.json', '')
      const filePath = path.join(localesPath, file)
      const content = fs.readFileSync(filePath, 'utf8')
      const data = JSON.parse(content)
      namespaces[namespace] = data
    }
  }
  
  let output = `// Auto-generated type definitions for webview i18n\n`
  output += `// DO NOT EDIT MANUALLY - regenerate by running: node generate-types.js\n\n\n`
  
  for (const [namespace, data] of Object.entries(namespaces)) {
    output += generateTypeDefinition(namespace, data)
    output += '\n'
  }
  
  output += `// Combined types\n`
  output += `export interface TranslationParams {\n`
  
  for (const [namespace, data] of Object.entries(namespaces)) {
    const keys = extractKeys(data)
    const sortedKeys = keys.sort()
    
    for (const key of sortedKeys) {
      const value = key.split('.').reduce((obj, k) => obj[k], data)
      const params = typeof value === 'string' ? detectParams(value) : {}
      
      if (Object.keys(params).length > 0) {
        output += `  '${namespace}:${key}': { ${Object.entries(params).map(([k, v]) => `${k}: ${v}`).join(', ')} }\n`
      } else {
        output += `  '${namespace}:${key}': Record<string, never>\n`
      }
    }
  }
  
  output += `}\n\n`
  output += `export type TranslationKey = keyof TranslationParams\n`
  
  fs.writeFileSync(outputPath, output, 'utf8')
  console.log(`Generated type definitions at: ${outputPath}`)
  console.log(`Namespaces: ${Object.keys(namespaces).join(', ')}`)
}

generateAllTypes()
