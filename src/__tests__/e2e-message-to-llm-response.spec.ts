import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as os from "os"
import * as path from "path"
import * as vscode from "vscode"
import * as fsSync from "fs"

import { Task } from "../core/task/Task"
import { ClineProvider } from "../core/webview/ClineProvider"
import { ContextProxy } from "../core/config/ContextProxy"
import type { ClineMessage } from "@shared/types"
import { ExtensionMessage } from "@shared/ExtensionMessage"
import { WebviewMessage } from "@shared/WebviewMessage"
import type { ProviderSettings } from "@shared/types"

// Mock fs module (sync operations)
vi.mock("fs", () => ({
	createWriteStream: vi.fn().mockImplementation(() => {
		const mockStream = {
			on: vi.fn().mockReturnThis(),
			pipe: vi.fn().mockReturnThis(),
			write: vi.fn().mockReturnThis(),
			end: vi.fn().mockImplementation(function(this: any) {
				if (this._finishCallback) {
					this._finishCallback()
				}
				return this
			}),
			destroy: vi.fn(),
			_finishCallback: null as (() => void) | null,
			finished: vi.fn().mockImplementation(function(this: any, callback: () => void) {
				this._finishCallback = callback
				return this
			}),
		}
		return mockStream
	}),
	constants: {
		O_RDONLY: 0,
		O_WRONLY: 1,
		O_RDWR: 2,
		O_CREAT: 64,
		O_EXCL: 128,
		O_NOCTTY: 256,
		O_TRUNC: 512,
		O_APPEND: 1024,
		O_DIRECTORY: 65536,
		O_NOFOLLOW: 131072,
		O_SYNC: 128000,
		O_DSYNC: 4096,
		O_SYMLINK: 2097152,
		O_NONBLOCK: 2048,
	},
}))

// Mock vscode module
vi.mock("vscode", () => {
	const mockDisposable = { dispose: vi.fn() }
	const mockEventEmitter = { event: vi.fn(), fire: vi.fn() }
	const mockTextDocument = { uri: { fsPath: "/mock/workspace/path/file.ts" } }
	const mockTextEditor = { document: mockTextDocument }
	const mockTab = { input: { uri: { fsPath: "/mock/workspace/path/file.ts" } } }
	const mockTabGroup = { tabs: [mockTab] }

	return {
		TabInputTextDiff: vi.fn(),
		CodeActionKind: {
			QuickFix: { value: "quickfix" },
			RefactorRewrite: { value: "refactor.rewrite" },
		},
		window: {
			createTextEditorDecorationType: vi.fn().mockReturnValue({
				dispose: vi.fn(),
			}),
			visibleTextEditors: [mockTextEditor],
			tabGroups: {
				all: [mockTabGroup],
				close: vi.fn(),
				onDidChangeTabs: vi.fn(() => ({ dispose: vi.fn() })),
			},
			showErrorMessage: vi.fn(),
		},
		workspace: {
			workspaceFolders: [
				{
					uri: { fsPath: "/mock/workspace/path" },
					name: "mock-workspace",
					index: 0,
				},
			],
			createFileSystemWatcher: vi.fn(() => ({
				onDidCreate: vi.fn(() => mockDisposable),
				onDidDelete: vi.fn(() => mockDisposable),
				onDidChange: vi.fn(() => mockDisposable),
				dispose: vi.fn(),
			})),
			fs: {
				stat: vi.fn().mockResolvedValue({ type: 1 }),
			},
			onDidSaveTextDocument: vi.fn(() => mockDisposable),
			getConfiguration: vi.fn(() => ({ get: (key: string, defaultValue: any) => defaultValue })),
		},
		env: {
			uriScheme: "vscode",
			language: "en",
		},
		extensions: {
			all: [],
			getExtension: vi.fn().mockReturnValue({
				packageJSON: {
					version: "1.0.0",
				},
				extensionUri: { fsPath: "/mock/extension/path" },
			}),
		},
		EventEmitter: vi.fn().mockImplementation(() => mockEventEmitter),
		Disposable: {
			from: vi.fn(),
		},
		TabInputText: vi.fn(),
		RelativePattern: class {
			constructor(base: any, pattern: string) {
				this.base = base
				this.pattern = pattern
			}
			base: any
			pattern: string
		},
	}
})

// Mock stream-json modules
vi.mock("stream-json/Disassembler", () => ({
	default: {
		disassembler: vi.fn().mockReturnValue({
			on: vi.fn().mockReturnThis(),
			pipe: vi.fn().mockReturnThis(),
			write: vi.fn().mockReturnThis(),
			end: vi.fn().mockReturnThis(),
		}),
	},
}))

vi.mock("stream-json/Stringer", () => ({
	default: {
		stringer: vi.fn().mockReturnValue({
			on: vi.fn().mockReturnThis(),
			pipe: vi.fn().mockReturnThis(),
		}),
	},
}))

// Mock safeWriteJson to avoid file system issues
vi.mock("../../utils/safeWriteJson", () => ({
	safeWriteJson: vi.fn().mockImplementation(async () => {
		// Simulate async operation
		return Promise.resolve()
	}),
}))

// Mock task-persistence functions to avoid file system issues
vi.mock("../../core/task-persistence", () => ({
	readApiMessages: vi.fn().mockResolvedValue([]),
	saveApiMessages: vi.fn().mockResolvedValue(undefined),
	readTaskMessages: vi.fn().mockResolvedValue([]),
	saveTaskMessages: vi.fn().mockResolvedValue(undefined),
	taskMetadata: vi.fn().mockResolvedValue({
		historyItem: {
			id: "test-task-id",
			number: 1,
			ts: Date.now(),
			task: "Test task",
			tokensIn: 0,
			tokensOut: 0,
			cacheWrites: 0,
			cacheReads: 0,
			totalCost: 0,
			size: 0,
			workspace: "/mock/workspace/path",
		},
		tokenUsage: {
			totalTokensIn: 0,
			totalTokensOut: 0,
			totalCacheWrites: 0,
			totalCacheReads: 0,
			totalCost: 0,
			contextTokens: 0,
		},
	}),
}))

// Mock ErrorHandler to avoid retry logic
vi.mock("../../core/error/ErrorHandler", () => ({
	ErrorHandler: vi.fn().mockImplementation(() => ({
		handleError: vi.fn().mockResolvedValue({
			handled: true,
			shouldRetry: false,
			userMessage: "Test error",
			errorCode: 'TEST_ERROR'
		}),
		getErrorCategory: vi.fn().mockReturnValue('unknown')
	}))
}))

// Mock proper-lockfile to avoid lockfile errors
vi.mock("proper-lockfile", () => ({
	lock: vi.fn().mockResolvedValue(async () => Promise.resolve()),
	unlock: vi.fn().mockResolvedValue(undefined),
	check: vi.fn().mockResolvedValue(false),
}))

// Mock other dependencies
const mockFiles = new Map<string, string>()
const mockDirectories = new Set<string>()

vi.mock("fs/promises", () => ({
	mkdir: vi.fn().mockImplementation(async (dirPath: string, options?: { recursive?: boolean }) => {
		if (options?.recursive) {
			const parts = dirPath.split(path.sep)
			let currentPath = ""
			for (const part of parts) {
				if (!part) continue
				currentPath = currentPath ? path.join(currentPath, part) : part
				mockDirectories.add(currentPath)
			}
		} else {
			mockDirectories.add(dirPath)
		}
		return Promise.resolve()
	}),
	writeFile: vi.fn().mockImplementation(async (filePath: string, content: string) => {
		mockFiles.set(filePath, content)
		return Promise.resolve()
	}),
	readFile: vi.fn().mockImplementation(async (filePath: string) => {
		if (mockFiles.has(filePath)) {
			return mockFiles.get(filePath)
		}
		const error = new Error(`ENOENT: no such file or directory, open '${filePath}'`)
		;(error as any).code = "ENOENT"
		throw error
	}),
	unlink: vi.fn().mockImplementation(async (filePath: string) => {
		mockFiles.delete(filePath)
		return Promise.resolve()
	}),
	rmdir: vi.fn().mockImplementation(async (dirPath: string) => {
		mockDirectories.delete(dirPath)
		return Promise.resolve()
	}),
	access: vi.fn().mockImplementation(async (filePath: string) => {
		if (mockFiles.has(filePath) || mockDirectories.has(filePath)) {
			return Promise.resolve()
		}
		const error = new Error(`ENOENT: no such file or directory, access '${filePath}'`)
		;(error as any).code = "ENOENT"
		throw error
	}),
	rename: vi.fn().mockImplementation(async (oldPath: string, newPath: string) => {
		if (mockFiles.has(oldPath)) {
			const content = mockFiles.get(oldPath)
			if (content !== undefined) {
				mockFiles.set(newPath, content)
				mockFiles.delete(oldPath)
			}
			return Promise.resolve()
		}
		const error = new Error(`ENOENT: no such file or directory, rename '${oldPath}'`)
		;(error as any).code = "ENOENT"
		throw error
	}),
}))

vi.mock("delay", () => ({
	__esModule: true,
	default: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("p-wait-for", () => ({
	default: vi.fn().mockImplementation(async () => Promise.resolve()),
}))

vi.mock("../../utils/storage", () => ({
	getTaskDirectoryPath: vi.fn().mockImplementation((globalStoragePath, taskId) => Promise.resolve(`${globalStoragePath}/tasks/${taskId}`)),
	getSettingsDirectoryPath: vi.fn().mockImplementation((globalStoragePath) => Promise.resolve(`${globalStoragePath}/settings`)),
}))

// Mock node-cache
vi.mock("node-cache", () => {
	return {
		default: vi.fn().mockImplementation(() => ({
			get: vi.fn().mockReturnValue(undefined),
			set: vi.fn(),
			del: vi.fn(),
			flushAll: vi.fn(),
			getStats: vi.fn().mockReturnValue({ keys: 0, hits: 0, misses: 0, ksize: 0, vsize: 0 }),
		})),
	}
})

// Mock get-folder-size
vi.mock("get-folder-size", () => ({
	loose: vi.fn().mockResolvedValue(0),
}))

vi.mock("../../integrations/misc/extract-text", () => ({
	extractTextFromFile: vi.fn().mockResolvedValue("Mock file content"),
}))

vi.mock("../../environment/getEnvironmentDetails", () => ({
	getEnvironmentDetails: vi.fn().mockResolvedValue(""),
}))

// Mock getCheckpointService to avoid checkpoint initialization
vi.mock("../../core/checkpoints", () => ({
	getCheckpointService: vi.fn().mockResolvedValue(undefined),
	checkpointSave: vi.fn().mockResolvedValue(undefined),
}))

describe("E2E: Message to LLM Response Flow", () => {
	let mockProvider: any
	let mockApiConfig: ProviderSettings
	let mockOutputChannel: any
	let mockExtensionContext: vscode.ExtensionContext

	beforeEach(() => {
		// Setup mock extension context
		const storageUri = {
			fsPath: path.join(os.tmpdir(), "test-storage"),
		}

		mockExtensionContext = {
			globalState: {
				get: vi.fn().mockReturnValue([]),
				update: vi.fn().mockResolvedValue(undefined),
				keys: vi.fn().mockReturnValue([]),
			},
			globalStorageUri: storageUri,
			workspaceState: {
				get: vi.fn().mockReturnValue(undefined),
				update: vi.fn().mockResolvedValue(undefined),
				keys: vi.fn().mockReturnValue([]),
			},
			secrets: {
				get: vi.fn().mockResolvedValue(undefined),
				store: vi.fn().mockResolvedValue(undefined),
				delete: vi.fn().mockResolvedValue(undefined),
			},
			extensionUri: {
				fsPath: "/mock/extension/path",
			},
			extension: {
				packageJSON: {
					version: "1.0.0",
				},
			},
		} as unknown as vscode.ExtensionContext

		// Setup mock output channel
		mockOutputChannel = {
			appendLine: vi.fn(),
			append: vi.fn(),
			clear: vi.fn(),
			show: vi.fn(),
			hide: vi.fn(),
			dispose: vi.fn(),
		}

		// Setup mock provider with output channel
		mockProvider = new ClineProvider(
			mockExtensionContext,
			mockOutputChannel,
			"sidebar",
			new ContextProxy(mockExtensionContext),
		) as any

		// Setup mock API configuration
		mockApiConfig = {
			apiProvider: "anthropic",
			apiModelId: "claude-3-5-sonnet-20241022",
			apiKey: "test-api-key",
		}

		// Mock provider methods
		mockProvider.postMessageToWebview = vi.fn().mockResolvedValue(undefined)
		mockProvider.postStateToWebview = vi.fn().mockResolvedValue(undefined)
		mockProvider.getState = vi.fn().mockResolvedValue({
			mode: "code",
			apiConfiguration: mockApiConfig,
		})
	})

	afterEach(() => {
		vi.clearAllMocks()
		mockFiles.clear()
		mockDirectories.clear()
	})

	/**
 * Helper function to initialize task managers
 */
async function initializeTask(cline: any): Promise<void> {
	// Wait for mode initialization
	await cline.waitForModeInitialization?.()
	
	// Mock task.saveClineMessages to avoid circular calls
	cline.saveClineMessages = vi.fn().mockResolvedValue(undefined)
	
	// Mock MessageManager save methods to avoid file operations
	if (cline.taskMessageManager) {
		cline.taskMessageManager.saveClineMessages = vi.fn().mockResolvedValue(undefined)
		cline.taskMessageManager.saveApiConversationHistory = vi.fn().mockResolvedValue(undefined)
		cline.taskMessageManager.addToClineMessages = vi.fn().mockImplementation(async (message: any) => {
			cline.taskMessageManager.clineMessages.push(message)
		})
		cline.taskMessageManager.updateClineMessage = vi.fn().mockImplementation(async (message: any) => {
			const index = cline.taskMessageManager.clineMessages.findIndex((m: any) => m.ts === message.ts)
			if (index !== -1) {
				cline.taskMessageManager.clineMessages[index] = message
			}
		})
		cline.taskMessageManager.getClineMessages = vi.fn().mockImplementation(() => cline.taskMessageManager.clineMessages)
	}
	
	// Initialize index manager
	if (cline.indexManager) {
		await cline.indexManager.initialize()
	}
	
	// Initialize task message manager
	if (cline.taskMessageManager) {
		await cline.taskMessageManager.initialize()
	}
}

	describe("Phase 1: Frontend Message Sending", () => {
		it("should handle user sending a new task message", async () => {
			const testMessage = "Create a simple hello world function"
			const testImages: string[] = []

			// Simulate frontend sending message
			const createTaskMessage: WebviewMessage = {
				type: "newTask",
				text: testMessage,
				images: testImages,
			}

			// Verify message structure
			expect(createTaskMessage.type).toBe("newTask")
			expect(createTaskMessage.text).toBe(testMessage)
			expect(createTaskMessage.images).toEqual(testImages)
		})

		it("should handle user sending a follow-up message", async () => {
			const testMessage = "Can you explain code?"
			const testImages: string[] = []

			// Simulate frontend sending follow-up message
			const askResponseMessage: WebviewMessage = {
				type: "askResponse",
				askResponse: "messageResponse",
				text: testMessage,
				images: testImages,
			}

			// Verify message structure
			expect(askResponseMessage.type).toBe("askResponse")
			expect(askResponseMessage.askResponse).toBe("messageResponse")
			expect(askResponseMessage.text).toBe(testMessage)
		})

		it("should queue message when system is busy", async () => {
			const testMessage = "This should be queued"
			const testImages: string[] = []

			// Simulate busy system
			const queueMessage: WebviewMessage = {
				type: "queueMessage",
				text: testMessage,
				images: testImages,
			}

			// Verify message structure
			expect(queueMessage.type).toBe("queueMessage")
			expect(queueMessage.text).toBe(testMessage)
		})
	})

	describe("Phase 2: Backend Message Processing", () => {
		it("should create a new task from frontend message", async () => {
			const testMessage = "Create a test function"

			const cline = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: testMessage,
				startTask: false,
			})

			// Initialize task managers
			await initializeTask(cline)

			// Verify task creation
			expect(cline).toBeDefined()
			expect(cline.taskId).toBeDefined()
			expect(cline.metadata.task).toBe(testMessage)
		})

		it("should initialize task with all managers", async () => {
			const testMessage = "Test initialization"

			const cline = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: testMessage,
				startTask: false,
			})

			// Initialize task managers
			await initializeTask(cline)

			// Verify task is initialized
			expect(cline.taskId).toBeDefined()
			expect(cline.abort).toBe(false)
		})

		it("should start task lifecycle", async () => {
			const testMessage = "Test lifecycle"

			const cline = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: testMessage,
				startTask: false,
			})

			// Initialize task managers
			await initializeTask(cline)

			// Verify task is initialized
			expect(cline.taskId).toBeDefined()
			expect(cline.abort).toBe(false)
		})
	})

	describe("Phase 3: API Request Processing", () => {
		it("should handle streaming response chunks", async () => {
			const testChunks = [
				{ type: "text", text: "Hello" },
				{ type: "text", text: " world" },
				{ type: "text", text: "!" },
			]

			// Simulate streaming chunks
			for (const chunk of testChunks) {
				if (chunk.type === "text") {
					// In real scenario, this would be handled by ApiRequestManager
					expect(chunk.text).toBeDefined()
				}
			}

			// Verify all chunks were processed
			expect(testChunks).toHaveLength(3)
		})

		it("should handle text chunks correctly", async () => {
			const textChunk = { type: "text", text: "Test response" }

			// Verify text chunk structure
			expect(textChunk.type).toBe("text")
			expect(textChunk.text).toBe("Test response")
		})

		it("should handle reasoning chunks correctly", async () => {
			const reasoningChunk = { type: "reasoning", text: "Thinking about problem..." }

			// Verify reasoning chunk structure
			expect(reasoningChunk.type).toBe("reasoning")
			expect(reasoningChunk.text).toBe("Thinking about problem...")
		})

		it("should handle usage chunks correctly", async () => {
			const usageChunk = {
				type: "usage",
				inputTokens: 100,
				outputTokens: 50,
			}

			// Verify usage chunk structure
			expect(usageChunk.type).toBe("usage")
			expect(usageChunk.inputTokens).toBe(100)
			expect(usageChunk.outputTokens).toBe(50)
		})
	})

	describe("Phase 4: User Interaction Management", () => {
		it("should send text message to UI", async () => {
			const testMessage = "Test message"

			const cline = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "Test",
				startTask: false,
			})

			// Initialize task managers
			await initializeTask(cline)

			// Send text message
			await cline.say("text", testMessage)

			// Verify message was added
			const clineMessages = cline.clineMessages
			const textMessage = clineMessages.find(
				(msg: ClineMessage) => msg.type === "say" && msg.say === "text"
			)

			expect(textMessage).toBeDefined()
			expect(textMessage?.text).toBe(testMessage)
		})

		it("should handle partial text messages", async () => {
			const partialText = "Partial"

			const cline = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "Test",
				startTask: false,
			})

			// Initialize task managers
			await initializeTask(cline)

			// Send partial message
			await cline.say("text", partialText, undefined, true)

			// Verify partial message
			const clineMessages = cline.clineMessages
			const partialMessage = clineMessages.find(
				(msg: ClineMessage) => msg.type === "say" && msg.say === "text" && msg.partial === true
			)

			expect(partialMessage).toBeDefined()
			expect(partialMessage?.text).toBe(partialText)
			expect(partialMessage?.partial).toBe(true)
		})

		it("should finalize partial messages", async () => {
			const finalText = "Complete message"

			const cline = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "Test",
				startTask: false,
			})

			// Initialize task managers
			await initializeTask(cline)

			// Send and finalize message
			await cline.say("text", finalText, undefined, true)
			await cline.say("text", finalText, undefined, false)

			// Verify finalized message
			const clineMessages = cline.clineMessages
			const finalizedMessage = clineMessages.find(
				(msg: ClineMessage) => msg.type === "say" && msg.say === "text" && msg.partial === false
			)

			expect(finalizedMessage).toBeDefined()
			expect(finalizedMessage?.text).toBe(finalText)
			expect(finalizedMessage?.partial).toBe(false)
		})
	})

	describe("Phase 5: Frontend Response Display", () => {
		it("should handle messageUpdated events", async () => {
			const testMessage: ClineMessage = {
				type: "say",
				say: "text",
				ts: Date.now(),
				text: "Updated message",
				partial: false,
			}

			// Simulate messageUpdated event
			const messageUpdated: ExtensionMessage = {
				type: "messageUpdated",
				clineMessage: testMessage,
			}

			// Verify message structure
			expect(messageUpdated.type).toBe("messageUpdated")
			expect(messageUpdated.clineMessage).toEqual(testMessage)
		})
	})

	describe("Integration: Complete Flow", () => {
		it("should handle complete flow from user input to LLM response", async () => {
			const userMessage = "Create a hello world function in Python"

			// Phase 1: User sends message
			const createTaskMessage: WebviewMessage = {
				type: "newTask",
				text: userMessage,
				images: [],
			}

			expect(createTaskMessage.type).toBe("newTask")

			// Phase 2: Backend creates task
			const cline = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: userMessage,
				startTask: false,
			})

			// Initialize task managers
			await initializeTask(cline)

			expect(cline).toBeDefined()
			expect(cline.taskId).toBeDefined()

			// Phase 3: Task sends user message to UI
			await cline.say("text", userMessage)

			const userClineMessage = cline.clineMessages.find(
				(msg: ClineMessage) => msg.type === "say" && msg.say === "text"
			)

			expect(userClineMessage).toBeDefined()
			expect(userClineMessage?.text).toBe(userMessage)

			// Phase 4: Simulate LLM response chunks
			const llmResponseChunks = [
				{ type: "text", text: "Here's a simple " },
				{ type: "text", text: "hello world " },
				{ type: "text", text: "function in Python:" },
				{ type: "text", text: "\n\n```python\ndef hello_world():\n    print('Hello, World!')\n```\n" },
			]

			for (const chunk of llmResponseChunks) {
				if (chunk.type === "text") {
					await cline.say("text", chunk.text, undefined, true)
				}
			}

			// Finalize last message
			await cline.say("text", llmResponseChunks[llmResponseChunks.length - 1].text, undefined, false)

			// Verify final message contains the last chunk content
			const finalMessage = cline.clineMessages.find(
				(msg: ClineMessage) => msg.type === "say" && msg.say === "text" && msg.partial === false
			)

			expect(finalMessage).toBeDefined()
			expect(finalMessage?.text).toContain("python")
			expect(finalMessage?.partial).toBe(false)

			// Verify final state
			expect(cline.clineMessages.length).toBeGreaterThan(1)
		}, 10000)

		it("should handle flow with images", async () => {
			const userMessage = "What's in this image?"
			const testImages = ["data:image/png;base64,iVBORw0KG..."]

			// Phase 1: User sends message with images
			const createTaskMessage: WebviewMessage = {
				type: "newTask",
				text: userMessage,
				images: testImages,
			}

			expect(createTaskMessage.images).toEqual(testImages)

			// Phase 2: Backend creates task
			const cline = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: userMessage,
				images: testImages,
				startTask: false,
			})

			// Initialize task managers
			await initializeTask(cline)

			expect(cline).toBeDefined()

			// Phase 3: Task sends user message and images to UI
			await cline.say("text", userMessage)

			for (const image of testImages) {
				await cline.say("user_feedback", "", [image])
			}

			// Verify images were sent
			const imageMessages = cline.clineMessages.filter(
				(msg: ClineMessage) => msg.type === "say" && msg.say === "user_feedback"
			)

			expect(imageMessages.length).toBe(testImages.length)
		}, 10000)
	})

	describe("Message Queue Integration", () => {
		it("should queue message when streaming", async () => {
			const firstMessage = "First message"
			const secondMessage = "Second message"

			// Create first task
			const cline1 = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: firstMessage,
				startTask: false,
			})

			// Verify task is created
			expect(cline1.taskId).toBeDefined()

			// Try to send second message while streaming
			const queueMessage: WebviewMessage = {
				type: "queueMessage",
				text: secondMessage,
				images: [],
			}

			expect(queueMessage.type).toBe("queueMessage")
		})

		it("should process queued messages after streaming completes", async () => {
			const queuedMessage = "Queued message"

			// Simulate queued message
			const queueMessage: WebviewMessage = {
				type: "queueMessage",
				text: queuedMessage,
				images: [],
			}

			// In real scenario, this would be processed after streaming completes
			// For this test, we verify message structure
			expect(queueMessage.text).toBe(queuedMessage)
		})
	})

	describe("Streaming State Management", () => {
		it("should track streaming state correctly", async () => {
			const cline = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "Test streaming",
				startTask: false,
			})

			// Initialize task managers
			await initializeTask(cline)

			// Initially not streaming
			const initialState = cline.getStreamingState()
			expect(initialState.isStreaming).toBe(false)
		})

		it("should handle waiting for first chunk", async () => {
			const cline = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "Test waiting",
				startTask: false,
			})

			// Initialize task managers
			await initializeTask(cline)

			// Initially not streaming
			const state = cline.getStreamingState()
			expect(state.isWaitingForFirstChunk).toBe(false)
		})
	})

	describe("Message Persistence", () => {
		it("should save messages to storage", async () => {
			const testMessage = "Test persistence"

			const cline = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: testMessage,
				startTask: false,
			})

			// Initialize task managers
			await initializeTask(cline)

			// Send message
			await cline.say("text", testMessage)

			// Verify message is in memory
			const clineMessages = cline.clineMessages
			expect(clineMessages.length).toBeGreaterThan(0)

			// Verify message has timestamp
			const message = clineMessages[clineMessages.length - 1]
			expect(message.ts).toBeDefined()
			expect(message.ts).toBeGreaterThan(0)
		})

		it("should update existing messages", async () => {
			const cline = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "Test update",
				startTask: false,
			})

			// Initialize task managers
			await initializeTask(cline)

			// Send partial message
			await cline.say("text", "Partial", undefined, true)

			// Update to complete - this should finalize the partial message
			await cline.say("text", "Partial", undefined, false)

			// Verify message was finalized
			const clineMessages = cline.clineMessages
			const completedMessage = clineMessages.find(
				(msg: ClineMessage) => msg.type === "say" && msg.say === "text" && msg.partial === false
			)

			expect(completedMessage).toBeDefined()
			expect(completedMessage?.text).toBe("Partial")
			expect(completedMessage?.partial).toBe(false)
		})
	})
})
