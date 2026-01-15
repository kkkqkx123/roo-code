/**
 * TypeScript AST-based i18n validation script
 * Validates JSON translation files against TypeScript type definitions
 * 
 * Usage:
 *   node scripts/validate-i18n-types.js [--locale=<locale>] [--fix]
 * 
 * Options:
 *   --locale=<locale>  Only validate specific locale (e.g., --locale=zh-CN)
 *   --fix              Auto-fix missing keys with English translations
 *   --verbose          Show detailed validation results
 */

const ts = require("typescript")
const fs = require("fs")
const path = require("path")

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
	if (arg === "--help") {
		acc.help = true
	} else if (arg.startsWith("--locale=")) {
		acc.locale = arg.split("=")[1]
	} else if (arg === "--fix") {
		acc.fix = true
	} else if (arg === "--verbose") {
		acc.verbose = true
	}
	return acc
}, {})

// Display help
if (args.help) {
	console.log(`
TypeScript i18n Type Validator

Validates JSON translation files against TypeScript type definitions using AST parsing.

Usage:
  node scripts/validate-i18n-types.js [options]

Options:
  --locale=<locale>  Only validate specific locale (e.g., --locale=zh-CN)
  --fix              Auto-fix missing keys with English translations
  --verbose          Show detailed validation results
  --help             Show this help message

This script ensures:
- All TypeScript-defined translation keys exist in JSON files
- No extra keys in JSON files that aren't defined in TypeScript
- Parameter consistency between types and translations
`)
	process.exit(0)
}

// Configuration
const LOCALES_DIR = path.join(__dirname, "../src/i18n/locales")
const TYPES_FILE = path.join(__dirname, "../src/i18n/types.ts")

/**
 * Parse TypeScript file and extract translation key definitions
 */
function parseTypeScriptDefinitions() {
	const sourceFile = ts.createSourceFile(
		TYPES_FILE,
		fs.readFileSync(TYPES_FILE, "utf-8"),
		ts.ScriptTarget.Latest,
		true
	)

	const translationKeys = new Map() // key -> { namespace, key, params }
	let currentNamespace = null

	function visit(node) {
		// Look for interface properties
		if (ts.isPropertySignature(node) && node.name && ts.isStringLiteral(node.name)) {
			const fullKey = node.name.text
			const paramType = extractParameterType(node.type)
			
			// Parse namespace and key
			const [namespace, ...keyParts] = fullKey.split(":")
			const key = keyParts.join(":")
			
			if (!translationKeys.has(namespace)) {
				translationKeys.set(namespace, new Map())
			}
			
			translationKeys.get(namespace).set(key, {
				fullKey,
				namespace,
				key,
				params: paramType,
				node
			})
		}
		
		ts.forEachChild(node, visit)
	}

	// Find TranslationParams interface
	function findTranslationParamsInterface(node) {
		if (ts.isInterfaceDeclaration(node) && node.name.text === "TranslationParams") {
			visit(node)
			return
		}
		ts.forEachChild(node, findTranslationParamsInterface)
	}
	
	findTranslationParamsInterface(sourceFile)
	
	return translationKeys
}

/**
 * Extract parameter type information from TypeScript type node
 */
function extractParameterType(typeNode) {
	if (!typeNode) return null
	
	if (ts.isTypeLiteralNode(typeNode)) {
		const params = {}
		for (const member of typeNode.members) {
			if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
				const paramName = member.name.text
				const isOptional = !!member.questionToken
				
				if (ts.isUnionTypeNode(member.type)) {
					// Handle union types like string | number
					params[paramName] = {
						type: "union",
						types: member.type.types.map(t => t.getText()),
						optional: isOptional
					}
				} else if (member.type.kind >= ts.SyntaxKind.FirstKeyword && member.type.kind <= ts.SyntaxKind.LastKeyword) {
					// Handle primitive types
					params[paramName] = {
						type: member.type.kind === ts.SyntaxKind.StringKeyword ? "string" :
							member.type.kind === ts.SyntaxKind.NumberKeyword ? "number" :
							member.type.kind === ts.SyntaxKind.BooleanKeyword ? "boolean" : "unknown",
						optional: isOptional
					}
				} else if (ts.isTypeReferenceNode(member.type)) {
					// Handle type references like Record<string, never>
					params[paramName] = {
						type: member.type.getText(),
						optional: isOptional
					}
				} else {
					// Handle other types
					params[paramName] = {
						type: member.type.getText(),
						optional: isOptional
					}
				}
			}
		}
		return params
	} else if (ts.isTypeReferenceNode(typeNode) && typeNode.typeName.getText() === "Record") {
		// Handle Record<string, never> (no parameters needed)
		return {}
	}
	
	return null
}

/**
 * Extract parameter placeholders from translation text
 */
function extractParameters(text) {
	const params = new Set()
	const regex = /\{\{(\w+)\}\}/g
	let match
	
	while ((match = regex.exec(text)) !== null) {
		params.add(match[1])
	}
	
	return Array.from(params).sort()
}

/**
 * Load and parse JSON translation files
 */
function loadTranslationFiles(locale) {
	const localeDir = path.join(LOCALES_DIR, locale)
	const translations = new Map()
	
	if (!fs.existsSync(localeDir)) {
		throw new Error(`Locale directory not found: ${localeDir}`)
	}
	
	const files = fs.readdirSync(localeDir)
	
	for (const file of files) {
		if (file.endsWith(".json")) {
			const namespace = file.replace(".json", "")
			const filePath = path.join(localeDir, file)
			const content = JSON.parse(fs.readFileSync(filePath, "utf-8"))
			
			// Flatten nested structure
			const flattened = flattenTranslations(content, namespace)
			translations.set(namespace, flattened)
		}
	}
	
	return translations
}

/**
 * Flatten nested translation object
 */
function flattenTranslations(obj, namespace, prefix = "") {
	const result = new Map()
	
	for (const [key, value] of Object.entries(obj)) {
		const fullKey = prefix ? `${prefix}.${key}` : key
		
		if (typeof value === "object" && value !== null && !Array.isArray(value)) {
			// Recursively flatten nested objects
			const nested = flattenTranslations(value, namespace, fullKey)
			for (const [nestedKey, nestedValue] of nested) {
				result.set(nestedKey, nestedValue)
			}
		} else {
			// Store translation value and parameters
			const params = typeof value === "string" ? extractParameters(value) : []
			result.set(fullKey, {
				value,
				params,
				namespace,
				fullKey: `${namespace}:${fullKey}`
			})
		}
	}
	
	return result
}

/**
 * Validate translations against type definitions
 */
function validateTranslations(typeDefs, translations, locale) {
	const result = {
		valid: true,
		errors: [],
		warnings: [],
		missingKeys: [],
		extraKeys: [],
		paramMismatches: [],
		summary: {
			totalTypeKeys: 0,
			totalJsonKeys: 0,
			missingKeys: 0,
			extraKeys: 0,
			paramMismatches: 0
		}
	}
	
	// Count total keys
	for (const [namespace, keys] of typeDefs) {
		result.summary.totalTypeKeys += keys.size
	}
	
	for (const [namespace, keys] of translations) {
		result.summary.totalJsonKeys += keys.size
	}
	
	// Check for missing keys (in type definitions but not in JSON)
	for (const [namespace, typeKeys] of typeDefs) {
		const jsonKeys = translations.get(namespace) || new Map()
		
		for (const [key, typeInfo] of typeKeys) {
			if (!jsonKeys.has(key)) {
				result.missingKeys.push({
					namespace,
					key,
					fullKey: typeInfo.fullKey,
					message: `Missing translation: ${typeInfo.fullKey}`
				})
				result.errors.push(`Missing translation: ${typeInfo.fullKey}`)
			}
		}
	}
	
	// Check for extra keys (in JSON but not in type definitions)
	for (const [namespace, jsonKeys] of translations) {
		const typeKeys = typeDefs.get(namespace) || new Map()
		
		for (const [key, jsonInfo] of jsonKeys) {
			if (!typeKeys.has(key)) {
				result.extraKeys.push({
					namespace,
					key,
					fullKey: jsonInfo.fullKey,
					message: `Extra translation not in type definitions: ${jsonInfo.fullKey}`
				})
				result.warnings.push(`Extra translation not in type definitions: ${jsonInfo.fullKey}`)
			}
		}
	}
	
	// Check parameter consistency
	for (const [namespace, typeKeys] of typeDefs) {
		const jsonKeys = translations.get(namespace) || new Map()
		
		for (const [key, typeInfo] of typeKeys) {
			const jsonInfo = jsonKeys.get(key)
			if (!jsonInfo) continue
			
			// Compare parameters
			if (typeInfo.params && Object.keys(typeInfo.params).length > 0) {
				const typeParams = Object.keys(typeInfo.params).sort()
				const jsonParams = jsonInfo.params
				
				// Check if JSON has all required parameters
				const missingParams = typeParams.filter(p => !jsonParams.includes(p))
				const extraParams = jsonParams.filter(p => !typeParams.includes(p))
				
				if (missingParams.length > 0 || extraParams.length > 0) {
					result.paramMismatches.push({
						namespace,
						key,
						fullKey: typeInfo.fullKey,
						typeParams,
						jsonParams,
						missingParams,
						extraParams,
						message: `Parameter mismatch for ${typeInfo.fullKey}: expected [${typeParams.join(", ")}], found [${jsonParams.join(", ")}]`
					})
					result.errors.push(`Parameter mismatch for ${typeInfo.fullKey}`)
				}
			} else if (jsonInfo.params.length > 0) {
				// Type says no params but JSON has params
				result.paramMismatches.push({
					namespace,
					key,
					fullKey: typeInfo.fullKey,
					typeParams: [],
					jsonParams: jsonInfo.params,
					missingParams: [],
					extraParams: jsonInfo.params,
					message: `Unexpected parameters in ${typeInfo.fullKey}: [${jsonInfo.params.join(", ")}]`
				})
				result.errors.push(`Unexpected parameters in ${typeInfo.fullKey}`)
			}
		}
	}
	
	// Update summary
	result.summary.missingKeys = result.missingKeys.length
	result.summary.extraKeys = result.extraKeys.length
	result.summary.paramMismatches = result.paramMismatches.length
	
	// Determine overall validity
	result.valid = result.errors.length === 0
	
	return result
}

/**
 * Auto-fix missing translations with English translations
 */
function autoFixMissingTranslations(typeDefs, locale, missingKeys) {
	console.log(`\n🔧 Auto-fixing ${missingKeys.length} missing translations for ${locale}...`)
	
	// Load English translations as template
	const englishTranslations = loadTranslationFiles("en")
	const localeDir = path.join(LOCALES_DIR, locale)
	
	// Group missing keys by namespace
	const missingByNamespace = new Map()
	for (const missing of missingKeys) {
		if (!missingByNamespace.has(missing.namespace)) {
			missingByNamespace.set(missing.namespace, [])
		}
		missingByNamespace.get(missing.namespace).push(missing)
	}
	
	// Fix each namespace
	for (const [namespace, missingList] of missingByNamespace) {
		const namespaceFile = path.join(localeDir, `${namespace}.json`)
		let namespaceContent = {}
		
		// Load existing content or create new
		if (fs.existsSync(namespaceFile)) {
			namespaceContent = JSON.parse(fs.readFileSync(namespaceFile, "utf-8"))
		}
		
		// Get English translations for this namespace
		const englishNamespace = englishTranslations.get(namespace) || new Map()
		
		// Add missing translations
		for (const missing of missingList) {
			const englishTranslation = englishNamespace.get(missing.key)
			if (englishTranslation) {
				// Convert flat key back to nested structure
				setNestedValue(namespaceContent, missing.key, englishTranslation.value)
				console.log(`  ✓ Fixed: ${missing.fullKey}`)
			} else {
				console.log(`  ⚠ No English template for: ${missing.fullKey}`)
			}
		}
		
		// Write back to file
		fs.writeFileSync(namespaceFile, JSON.stringify(namespaceContent, null, 2) + "\n")
	}
	
	console.log(`✅ Auto-fix completed for ${locale}`)
}

/**
 * Set nested value in object
 */
function setNestedValue(obj, path, value) {
	const parts = path.split(".")
	let current = obj
	
	for (let i = 0; i < parts.length - 1; i++) {
		const part = parts[i]
		if (!current[part]) {
			current[part] = {}
		}
		current = current[part]
	}
	
	current[parts[parts.length - 1]] = value
}

/**
 * Main validation function
 */
function main() {
	console.log("🔍 TypeScript i18n Type Validator")
	console.log("=====================================")
	
	try {
		// Parse TypeScript definitions
		console.log("\n📋 Parsing TypeScript definitions...")
		const typeDefs = parseTypeScriptDefinitions()
		console.log(`✅ Found ${Array.from(typeDefs.values()).reduce((sum, map) => sum + map.size, 0)} type definitions`)
		
		if (args.verbose) {
			console.log("\nType definitions by namespace:")
			for (const [namespace, keys] of typeDefs) {
				console.log(`  ${namespace}: ${keys.size} keys`)
			}
		}
		
		// Determine locales to validate
		const locales = args.locale ? [args.locale] : fs.readdirSync(LOCALES_DIR)
			.filter(dir => fs.statSync(path.join(LOCALES_DIR, dir)).isDirectory())
			.filter(dir => dir !== "en") // Skip English as reference
		
		console.log(`\n🌍 Validating locales: ${locales.join(", ")}`)
		
		let hasErrors = false
		
		// Validate each locale
		for (const locale of locales) {
			console.log(`\n📄 Validating ${locale}...`)
			
			try {
				// Load translation files
				const translations = loadTranslationFiles(locale)
				
				if (args.verbose) {
					console.log(`  Loaded ${Array.from(translations.values()).reduce((sum, map) => sum + map.size, 0)} translations`)
				}
				
				// Validate
				const result = validateTranslations(typeDefs, translations, locale)
				
				// Display results
				console.log(`  ✅ Type keys: ${result.summary.totalTypeKeys}`)
				console.log(`  📋 JSON keys: ${result.summary.totalJsonKeys}`)
				
				if (result.missingKeys.length > 0) {
					console.log(`  ❌ Missing keys: ${result.missingKeys.length}`)
					if (args.verbose) {
						result.missingKeys.forEach(item => console.log(`    - ${item.message}`))
					}
					console.log(`\n📋 Missing keys:`)
					for (const missing of result.missingKeys) {
						console.log(`  - ${missing.fullKey}`)
					}
				}
				
				if (result.extraKeys.length > 0) {
					console.log(`  ⚠️  Extra keys: ${result.extraKeys.length}`)
					if (args.verbose) {
						result.extraKeys.forEach(item => console.log(`    - ${item.message}`))
					}
					console.log(`\n⚠️  Extra keys:`)
					for (const extra of result.extraKeys) {
						console.log(`  - ${extra.fullKey}`)
					}
				}
				
				if (result.paramMismatches.length > 0) {
					console.log(`  ❌ Parameter mismatches: ${result.paramMismatches.length}`)
					if (args.verbose) {
						result.paramMismatches.forEach(item => console.log(`    - ${item.message}`))
					}
					console.log(`\n❌ Parameter mismatches:`)
					for (const mismatch of result.paramMismatches) {
						console.log(`  - ${mismatch.message}`)
					}
				}
				
				if (!result.valid) {
					hasErrors = true
					
					// Auto-fix if requested
					if (args.fix && result.missingKeys.length > 0) {
						autoFixMissingTranslations(typeDefs, locale, result.missingKeys)
					}
				} else {
					console.log(`  ✅ ${locale} is valid!`)
				}
				
			} catch (error) {
				console.error(`  ❌ Error validating ${locale}: ${error.message}`)
				hasErrors = true
			}
		}
		
		// Final result
		console.log("\n" + "=".repeat(50))
		if (hasErrors) {
			console.log("❌ Validation failed!")
			if (!args.fix) {
				console.log("💡 Run with --fix to auto-fix missing translations")
			}
			process.exit(1)
		} else {
			console.log("✅ All validations passed!")
			process.exit(0)
		}
		
	} catch (error) {
		console.error("❌ Fatal error:", error.message)
		console.error(error.stack)
		process.exit(1)
	}
}

// Run the validation
main()