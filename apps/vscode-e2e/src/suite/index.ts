import * as path from "path"
import { readdir } from "fs/promises"
import Mocha from "mocha"
import * as vscode from "vscode"

async function findTestFiles(dir: string, pattern: string): Promise<string[]> {
	const results: string[] = []
	const entries = await readdir(dir, { withFileTypes: true })
	
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name)
		if (entry.isDirectory() && !entry.name.startsWith('.')) {
			const subFiles = await findTestFiles(fullPath, pattern)
			results.push(...subFiles)
		} else if (entry.isFile() && entry.name.endsWith('.test.js')) {
			const relativePath = path.relative(process.cwd(), fullPath)
			if (pattern === '**/**.test.js' || relativePath.includes(pattern.replace('**/', '').replace('.js', ''))) {
				results.push(relativePath)
			}
		}
	}
	
	return results
}

import type { RooCodeAPI } from "@roo-code/types"

import { waitFor } from "./utils"

export async function run() {
	const extension = vscode.extensions.getExtension<RooCodeAPI>("RooVeterinaryInc.roo-cline")

	if (!extension) {
		throw new Error("Extension not found")
	}

	const api = extension.isActive ? extension.exports : await extension.activate()

	await api.setConfiguration({
		apiProvider: "openai" as const,
		openAiApiKey: process.env.OPENROUTER_API_KEY!,
		openAiModelId: "gpt-4",
	})

	await vscode.commands.executeCommand("roo-cline.SidebarProvider.focus")
	await waitFor(() => api.isReady())

	globalThis.api = api

	const mochaOptions: Mocha.MochaOptions = {
		ui: "tdd",
		timeout: 20 * 60 * 1_000, // 20m
	}

	if (process.env.TEST_GREP) {
		mochaOptions.grep = process.env.TEST_GREP
		console.log(`Running tests matching pattern: ${process.env.TEST_GREP}`)
	}

	const mocha = new Mocha(mochaOptions)
	const cwd = path.resolve(__dirname, "..")

	let testFiles: string[]

	if (process.env.TEST_FILE) {
		const specificFile = process.env.TEST_FILE.endsWith(".js")
			? process.env.TEST_FILE
			: `${process.env.TEST_FILE}.js`

		testFiles = await findTestFiles(cwd, `**/${specificFile}`)
		console.log(`Running specific test file: ${specificFile}`)
	} else {
		testFiles = await findTestFiles(cwd, "**/**.test.js")
	}

	if (testFiles.length === 0) {
		throw new Error(`No test files found matching criteria: ${process.env.TEST_FILE || "all tests"}`)
	}

	testFiles.forEach((testFile) => mocha.addFile(path.resolve(cwd, testFile)))

	return new Promise<void>((resolve, reject) =>
		mocha.run((failures) => (failures === 0 ? resolve() : reject(new Error(`${failures} tests failed.`)))),
	)
}
