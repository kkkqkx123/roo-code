// npx vitest src/core/tools/__tests__/readFileTool.spec.ts

import * as path from "path"

import { countFileLines } from "../../../integrations/misc/line-counter"
import { readLines } from "../../../integrations/misc/read-lines"
import { extractTextFromFile } from "../../../integrations/misc/extract-text"
import { parseSourceCodeDefinitionsForFile } from "../../../services/tree-sitter"
import { isBinaryFile } from "isbinaryfile"
import { ReadFileToolUse, ToolParamName, ToolResponse } from "../../../shared/tools"
import { readFileTool } from "../ReadFileTool"

// Create hoisted mocks that can be used in vi.mock factories
const { addLineNumbersMock, mockReadFileWithTokenBudget, mockIsBinaryFileOptimized, toolResultMock, imageBlocksMock, mockParseSourceCodeDefinitionsForFile } = vi.hoisted(() => {
	const addLineNumbersMock = vi.fn().mockImplementation((text: string, startLine = 1) => {
		if (!text) return ""
		const lines = typeof text === "string" ? text.split("\n") : [text]
		return lines.map((line: string, i: number) => `${startLine + i} | ${line}`).join("\n")
	})
	const mockReadFileWithTokenBudget = vi.fn()
	const mockIsBinaryFileOptimized = vi.fn()
	const toolResultMock = vi.fn((text: string, images?: string[]) => {
		if (images && images.length > 0) {
			return [
				{ type: "text", text },
				...images.map((img) => {
					const [header, data] = img.split(",")
					const media_type = header.match(/:(.*?);/)?.[1] || "image/png"
					return { type: "image", source: { type: "base64", media_type, data } }
				}),
			]
		}
		return text
	})
	const imageBlocksMock = vi.fn((images?: string[]) => {
		return images
			? images.map((img) => {
					const [header, data] = img.split(",")
					const media_type = header.match(/:(.*?);/)?.[1] || "image/png"
					return { type: "image", source: { type: "base64", media_type, data } }
				})
			: []
	})
	const mockParseSourceCodeDefinitionsForFile = vi.fn()
	return { addLineNumbersMock, mockReadFileWithTokenBudget, mockIsBinaryFileOptimized, toolResultMock, imageBlocksMock, mockParseSourceCodeDefinitionsForFile }
})

vi.mock("path", async () => {
	const originalPath = await vi.importActual("path")
	return {
		default: originalPath,
		...originalPath,
		resolve: vi.fn().mockImplementation((...args) => args.join("/")),
	}
})

vi.mock("isbinaryfile")

vi.mock("../../../integrations/misc/line-counter")
vi.mock("../../../integrations/misc/read-lines")

// Mock fs/promises readFile for image tests
const fsPromises = vi.hoisted(() => ({
	readFile: vi.fn(),
	stat: vi.fn().mockResolvedValue({ size: 1024 }),
}))
vi.mock("fs/promises", () => fsPromises)

// Mock extractTextFromFile - must be mocked to prevent actual file system access
vi.mock("../../../integrations/misc/extract-text", () => ({
	extractTextFromFile: vi.fn(),
	addLineNumbers: addLineNumbersMock,
	getSupportedBinaryFormats: vi.fn(() => [".pdf", ".docx", ".ipynb"]),
}))

// Mock readFileWithTokenBudget - must be mocked to prevent actual file system access
vi.mock("../../../integrations/misc/read-file-with-budget", () => ({
	readFileWithTokenBudget: (...args: any[]) => mockReadFileWithTokenBudget(...args),
}))

// Mock isBinaryFileOptimized - must be mocked to prevent actual binary file detection
vi.mock("../../../utils/binary-file-detector", () => ({
	isBinaryFileOptimized: (...args: any[]) => mockIsBinaryFileOptimized(...args),
}))

// Mock parseSourceCodeDefinitionsForFile - must be mocked to prevent actual parsing
vi.mock("../../../services/tree-sitter", () => ({
	parseSourceCodeDefinitionsForFile: (...args: any[]) => mockParseSourceCodeDefinitionsForFile(...args),
}))

// Mock image helpers - must be mocked to prevent actual image processing
vi.mock("../helpers/imageHelpers", () => ({
	DEFAULT_MAX_IMAGE_FILE_SIZE_MB: 20,
	DEFAULT_MAX_TOTAL_IMAGE_SIZE_MB: 20,
	isSupportedImageFormat: vi.fn().mockReturnValue(true),
	validateImageForProcessing: vi.fn().mockResolvedValue({ isValid: true, notice: "" }),
	processImageFile: vi.fn().mockResolvedValue({ 
		dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
		buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"),
		notice: "Image processed successfully",
		sizeInKB: 0.1,
		sizeInMB: 0.1
	}),
	ImageMemoryTracker: class {
		private totalMemoryUsed = 0
		addMemoryUsage(size: number) {
			this.totalMemoryUsed += size
		}
		getTotalMemoryUsed() {
			return this.totalMemoryUsed
		}
		reset() {
			this.totalMemoryUsed = 0
		}
	},
}))

// Mock formatResponse - use vi.hoisted to ensure mocks are available before vi.mock
vi.mock("../../prompts/responses", () => ({
	formatResponse: {
		toolDenied: vi.fn(() => "The user denied this operation."),
		toolDeniedWithFeedback: vi.fn(
			(feedback?: string) =>
				`The user denied this operation and provided the following feedback:\n<feedback>\n${feedback}\n</feedback>`,
		),
		toolApprovedWithFeedback: vi.fn(
			(feedback?: string) =>
				`The user approved this operation and provided the following context:\n<feedback>\n${feedback}\n</feedback>`,
		),
		rooIgnoreError: vi.fn(
			(path: string) =>
				`Access to ${path} is blocked by the .rooignore file settings. You must try to continue in the task without using this file, or ask the user to update the .rooignore file.`,
		),
		toolResult: toolResultMock,
		imageBlocks: imageBlocksMock,
	},
}))

vi.mock("../../ignore/RooIgnoreController", () => ({
	RooIgnoreController: class {
		initialize() {
			return Promise.resolve()
		}
		validateAccess() {
			return true
		}
	},
}))

vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn().mockReturnValue(true),
}))

// Mock input content for tests
let mockInputContent = ""

// Global beforeEach to ensure clean mock state between all test suites
beforeEach(() => {
	// Reset the hoisted mock implementations to prevent cross-suite pollution
	toolResultMock.mockImplementation((text: string, images?: string[]) => {
		if (images && images.length > 0) {
			return [
				{ type: "text", text },
				...images.map((img) => {
					const [header, data] = img.split(",")
					const media_type = header.match(/:(.*?);/)?.[1] || "image/png"
					return { type: "image", source: { type: "base64", media_type, data } }
				}),
			]
		}
		return text
	})

	imageBlocksMock.mockImplementation((images?: string[]) => {
		return images
			? images.map((img) => {
					const [header, data] = img.split(",")
					const media_type = header.match(/:(.*?);/)?.[1] || "image/png"
					return { type: "image", source: { type: "base64", media_type, data } }
				})
			: []
	})

	// Reset addLineNumbers mock to its default implementation (prevents cross-test pollution)
	addLineNumbersMock.mockReset()
	addLineNumbersMock.mockImplementation((text: string, startLine = 1) => {
		if (!text) return ""
		const lines = typeof text === "string" ? text.split("\n") : [text]
		return lines.map((line: string, i: number) => `${startLine + i} | ${line}`).join("\n")
	})

	// Reset readFileWithTokenBudget mock with default implementation
	mockReadFileWithTokenBudget.mockClear()
	mockReadFileWithTokenBudget.mockImplementation(async (_filePath: string, _options: any) => {
		// Default: return the mockInputContent with 5 lines
		const lines = mockInputContent ? mockInputContent.split("\n") : []
		return {
			content: mockInputContent,
			tokenCount: mockInputContent.length / 4, // rough estimate
			lineCount: lines.length,
			complete: true,
		}
	})
})

// Mock i18n translation function
vi.mock("../../../i18n", () => ({
	t: vi.fn((key: string, params?: Record<string, any>) => {
		// Map translation keys to English text
		const translations: Record<string, string> = {
			"tools:readFile.imageWithSize": "Image file ({{size}} KB)",
			"tools:readFile.imageTooLarge":
				"Image file is too large ({{size}}). The maximum allowed size is {{max}} MB.",
			"tools:readFile.linesRange": " (lines {{start}}-{{end}})",
			"tools:readFile.definitionsOnly": " (definitions only)",
			"tools:readFile.maxLines": " (max {{max}} lines)",
		}

		let result = translations[key] || key

		// Simple template replacement
		if (params) {
			Object.entries(params).forEach(([param, value]) => {
				result = result.replace(new RegExp(`{{${param}}}`, "g"), String(value))
			})
		}

		return result
	}),
}))

// Shared mock setup function to ensure consistent state across all test suites
function createMockCline(): any {
	const mockProvider = {
		getState: vi.fn(),
		deref: vi.fn().mockReturnThis(),
	}

	const mockCline: any = {
		cwd: "/",
		task: "Test",
		providerRef: mockProvider,
		rooIgnoreController: {
			validateAccess: vi.fn().mockReturnValue(true),
		},
		say: vi.fn().mockResolvedValue(undefined),
		ask: vi.fn().mockResolvedValue({ response: "yesButtonClicked" }),
		presentAssistantMessage: vi.fn(),
		handleError: vi.fn().mockResolvedValue(undefined),
		pushToolResult: vi.fn(),
		removeClosingTag: vi.fn((tag, content) => content),
		fileContextTracker: {
			trackFileContext: vi.fn().mockResolvedValue(undefined),
		},
		recordToolUsage: vi.fn().mockReturnValue(undefined),
		recordToolError: vi.fn().mockReturnValue(undefined),
		didRejectTool: false,
		getTokenUsage: vi.fn().mockReturnValue({
			contextTokens: 10000,
		}),
		apiConfiguration: {
			apiProvider: "anthropic",
		},
		// CRITICAL: Always ensure image support is enabled
		api: {
			getModel: vi.fn().mockReturnValue({
				id: "test-model",
				info: {
					supportsImages: true,
					contextWindow: 200000,
					maxTokens: 4096,
					supportsPromptCache: false,
					supportsNativeTools: false,
				},
			}),
		},
		sayAndCreateMissingParamError: vi.fn((toolName: string, paramName: string) => {
			return `Missing required parameter: ${paramName}`
		}),
	}

	return { mockCline, mockProvider }
}

// Helper function to set image support without affecting shared state
function setImageSupport(mockCline: any, supportsImages: boolean | undefined): void {
	mockCline.api = {
		getModel: vi.fn().mockReturnValue({
			id: "test-model",
			info: { supportsImages },
		}),
	}
}

describe("ReadFileTool - Core Functionality", () => {
	// Test data
	const testFilePath = "test/file.txt"
	const absoluteFilePath = "/test/file.txt"
	const fileContent = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5"
	const numberedFileContent = "1 | Line 1\n2 | Line 2\n3 | Line 3\n4 | Line 4\n5 | Line 5\n"
	const sourceCodeDef = "\n\n# file.txt\n1--5 | Content"

	// Mocked functions with correct types
	const mockedCountFileLines = vi.mocked(countFileLines)
	const mockedReadLines = vi.mocked(readLines)
	const mockedExtractTextFromFile = vi.mocked(extractTextFromFile)
	const mockedIsBinaryFile = vi.mocked(isBinaryFile)
	const mockedPathResolve = vi.mocked(path.resolve)

	let mockCline: any
	let mockProvider: any
	let toolResult: ToolResponse | undefined

	beforeEach(() => {
		// Clear specific mocks (not all mocks to preserve shared state)
		mockedCountFileLines.mockClear()
		mockedExtractTextFromFile.mockClear()
		mockedIsBinaryFile.mockClear()
		mockedPathResolve.mockClear()
		addLineNumbersMock.mockClear()

		// Use shared mock setup function
		const mocks = createMockCline()
		mockCline = mocks.mockCline
		mockProvider = mocks.mockProvider

		// Explicitly disable image support for text file tests to prevent cross-suite pollution
		setImageSupport(mockCline, false)

		mockedPathResolve.mockReturnValue(absoluteFilePath)
		mockedIsBinaryFile.mockResolvedValue(false)

		mockInputContent = fileContent

		// Setup the extractTextFromFile mock implementation with the current mockInputContent
		mockedExtractTextFromFile.mockImplementation((_filePath) => {
			return Promise.resolve(addLineNumbersMock(mockInputContent))
		})

		toolResult = undefined
	})

	/**
	 * Helper function to execute the read file tool with different maxReadFileLine settings
	 */
	async function executeReadFileTool(
		params: Partial<ReadFileToolUse["params"]>,
		options: {
			maxReadFileLine?: number
			totalLines?: number
			skipAddLineNumbersCheck?: boolean
			path?: string
			start_line?: string
			end_line?: string
		} = {},
	): Promise<ToolResponse | undefined> {
		// Configure mocks based on test scenario
		const maxReadFileLine = options.maxReadFileLine ?? 500
		const totalLines = options.totalLines ?? 5

		mockProvider.getState.mockResolvedValue({ maxReadFileLine, maxImageFileSize: 20, maxTotalImageSize: 20 })
		mockedCountFileLines.mockResolvedValue(totalLines)

		// Format args string based on params
		let argsContent = `<file><path>${options.path || testFilePath}</path>`
		if (options.start_line && options.end_line) {
			argsContent += `<line_range>${options.start_line}-${options.end_line}</line_range>`
		}
		argsContent += `</file>`

		// Create a tool use object
		const toolUse: ReadFileToolUse = {
			type: "tool_use",
			name: "read_file",
			params: { args: argsContent, ...params },
			partial: false,
		}

		await readFileTool.handle(mockCline, toolUse, {
			askApproval: mockCline.ask,
			handleError: vi.fn(),
			pushToolResult: (result: ToolResponse) => {
				toolResult = result
			},
			removeClosingTag: (_: ToolParamName, content?: string) => content ?? "",
			toolProtocol: "xml",
		})

		return toolResult
	}

	describe("maxReadFileLine behavior", () => {
		it("should read entire file when maxReadFileLine is -1", async () => {
			mockInputContent = fileContent

			const result = await executeReadFileTool({}, { maxReadFileLine: -1 })

			expect(result).toContain(`<file><path>${testFilePath}</path>`)
			expect(result).toContain(`<content lines="1-5">`)
			expect(result).toContain("Line 1")
			expect(result).toContain("Line 2")
			expect(result).toContain("Line 3")
		})

		it("should show only definitions when maxReadFileLine is 0", async () => {
			mockParseSourceCodeDefinitionsForFile.mockResolvedValue("# test/file.txt\n1-5 | function test()")

			const result = await executeReadFileTool({}, { maxReadFileLine: 0, totalLines: 5 })

			expect(result).toContain("<list_code_definition_names>")
			expect(result).toContain("Showing only 0 of 5 total lines")
			expect(result).not.toContain("<content")
		})

		it("should truncate content when maxReadFileLine is positive", async () => {
			mockInputContent = fileContent
			mockedCountFileLines.mockResolvedValue(5)
			mockedReadLines.mockResolvedValue("Line 1\nLine 2")

			const result = await executeReadFileTool({}, { maxReadFileLine: 2, totalLines: 5 })

			expect(result).toContain(`<content lines="1-2">`)
			expect(result).toContain("Line 1")
			expect(result).toContain("Line 2")
			expect(result).not.toContain("Line 3")
		})
	})

	describe("line range handling", () => {
		it("should read specific line range when provided", async () => {
		mockInputContent = fileContent
		mockedReadLines.mockResolvedValue("Line 2\nLine 3\nLine 4")

		const result = await executeReadFileTool({}, { start_line: "2", end_line: "4" })

		expect(mockedReadLines).toHaveBeenCalled()
		expect(result).toContain(`<content lines="2-4">`)
		expect(result).toContain("Line 2")
		expect(result).toContain("Line 3")
		expect(result).toContain("Line 4")
	})

		it("should handle invalid line ranges gracefully", async () => {
			mockInputContent = fileContent
			mockedReadLines.mockRejectedValue(new Error("Invalid line range"))

			const result = await executeReadFileTool({}, { start_line: "10", end_line: "20" })

			expect(result).toContain("Error reading file")
		})
	})

	describe("binary file handling", () => {
		it("should extract text from supported binary formats", async () => {
			mockIsBinaryFileOptimized.mockResolvedValue(true)
			mockedExtractTextFromFile.mockResolvedValue("Extracted PDF content")

			const result = await executeReadFileTool({}, { path: "test/document.pdf" })

			expect(result).toContain("Extracted PDF content")
		})

		it("should handle unsupported binary formats", async () => {
			mockIsBinaryFileOptimized.mockResolvedValue(true)
			mockedExtractTextFromFile.mockRejectedValue(new Error("Unsupported format"))

			const result = await executeReadFileTool({}, { path: "test/unknown.pdf" })

			expect(result).toContain("Error extracting text")
		})
	})

	describe("image file support", () => {
		beforeEach(() => {
			setImageSupport(mockCline, true)
			// Mock image file detection
			mockIsBinaryFileOptimized.mockImplementation((filePath: string) => {
				return Promise.resolve(filePath.toLowerCase().endsWith('.png'))
			})
		})

		it("should process image files when model supports images", async () => {
			const result = await executeReadFileTool({}, { path: "test/image.png" })

			// Convert result to string for testing if it's an array
			const resultText = Array.isArray(result) ? result.map(item => item.type === 'text' ? item.text : '').join('') : result
			expect(resultText).toContain("Image processed successfully")
			
			// Check for image data in the array
			if (Array.isArray(result)) {
				const hasImage = result.some(item => item.type === 'image' && item.source?.data)
				expect(hasImage).toBe(true)
			}
		})

		it("should skip image processing when model doesn't support images", async () => {
			setImageSupport(mockCline, false)

			const result = await executeReadFileTool({}, { path: "test/image.png" })

			expect(result).toContain("Binary file")
			expect(result).not.toContain("data:image/png;base64")
		})
	})

	describe("user approval flow", () => {
		it("should deny access when user rejects", async () => {
			mockCline.ask.mockResolvedValue({ response: "noButtonClicked" })

			const result = await executeReadFileTool({}, { path: "test/file.txt" })

			expect(result).toContain("The user denied this operation")
		})

		it("should approve with feedback when user provides feedback", async () => {
			mockCline.ask.mockResolvedValue({ 
				response: "yesButtonClicked", 
				text: "Additional context" 
			})

			const result = await executeReadFileTool({}, { path: "test/file.txt" })

			expect(result).toContain("The user approved this operation and provided the following context")
			expect(result).toContain("Additional context")
		})
	})

	describe("error handling", () => {
		it("should handle missing file path", async () => {
			const toolUse: ReadFileToolUse = {
				type: "tool_use",
				name: "read_file",
				params: { args: "" },
				partial: false,
			}

			await readFileTool.handle(mockCline, toolUse, {
				askApproval: mockCline.ask,
				handleError: vi.fn(),
				pushToolResult: (result: ToolResponse) => {
					toolResult = result
				},
				removeClosingTag: (_: ToolParamName, content?: string) => content ?? "",
				toolProtocol: "xml",
			})

			expect(toolResult).toContain("Missing required parameter")
		})

		it("should handle blocked files by .rooignore", async () => {
			mockCline.rooIgnoreController.validateAccess.mockReturnValue(false)

			const result = await executeReadFileTool({}, { path: "blocked/file.txt" })

			expect(result).toContain("Access to blocked/file.txt is blocked by the .rooignore file settings")
		})

		it("should handle file read errors", async () => {
			// Mock the readFileWithTokenBudget to throw an error
			mockReadFileWithTokenBudget.mockRejectedValue(new Error("File not found"))

			const result = await executeReadFileTool({}, { path: "test/file.txt" })

			expect(result).toContain("Error reading file")
		})
	})

	describe("multiple file processing", () => {
		it("should handle multiple files in single request", async () => {
			mockInputContent = fileContent

			const toolUse: ReadFileToolUse = {
				type: "tool_use",
				name: "read_file",
				params: { 
					args: `<file><path>test/file1.txt</path></file><file><path>test/file2.txt</path></file>` 
				},
				partial: false,
			}

			await readFileTool.handle(mockCline, toolUse, {
				askApproval: mockCline.ask,
				handleError: vi.fn(),
				pushToolResult: (result: ToolResponse) => {
					toolResult = result
				},
				removeClosingTag: (_: ToolParamName, content?: string) => content ?? "",
				toolProtocol: "xml",
			})

			expect(toolResult).toContain("test/file1.txt")
			expect(toolResult).toContain("test/file2.txt")
			// Should ask for approval for multiple files
			expect(mockCline.ask).toHaveBeenCalled()
		})
	})
})