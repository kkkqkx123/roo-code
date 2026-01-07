// pnpm --filter roo-cline test core/task/managers/__tests__/MessageManager.spec.ts

import Anthropic from "@anthropic-ai/sdk"
import * as vscode from "vscode"

import { type ClineMessage } from "@roo-code/types"
import { ContextProxy } from "../../../config/ContextProxy"
import { Task, TaskOptions } from "../../Task"

import { ClineProvider } from "../../../webview/ClineProvider"

vi.mock("../../../prompts/sections/custom-instructions")

vi.mock("p-wait-for", () => ({
	__esModule: true,
	default: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("fs/promises", () => ({
	mkdir: vi.fn().mockResolvedValue(undefined),
	writeFile: vi.fn().mockResolvedValue(undefined),
	readFile: vi.fn().mockResolvedValue(""),
	unlink: vi.fn().mockResolvedValue(undefined),
	rmdir: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("axios", () => ({
	default: {
		get: vi.fn().mockResolvedValue({ data: { data: [] } }),
		post: vi.fn(),
	},
	get: vi.fn().mockResolvedValue({ data: { data: [] } }),
	post: vi.fn(),
}))

vi.mock("../../../../utils/safeWriteJson")

vi.mock("../../../../utils/storage", () => ({
	getSettingsDirectoryPath: vi.fn().mockResolvedValue("/test/settings/path"),
	getTaskDirectoryPath: vi.fn().mockResolvedValue("/test/task/path"),
	getGlobalStoragePath: vi.fn().mockResolvedValue("/test/storage/path"),
}))

vi.mock("@modelcontextprotocol/sdk/types.js", () => ({
	CallToolResultSchema: {},
	ListResourcesResultSchema: {},
	ListResourceTemplatesResultSchema: {},
	ListToolsResultSchema: {},
	ReadResourceResultSchema: {},
	ErrorCode: {
		InvalidRequest: "InvalidRequest",
		MethodNotFound: "MethodNotFound",
		InternalError: "InternalError",
	},
	McpError: class McpError extends Error {
		code: string
		constructor(code: string, message: string) {
			super(message)
			this.code = code
			this.name = "McpError"
		}
	},
}))

vi.mock("../../../../services/browser/BrowserSession", () => ({
	BrowserSession: vi.fn().mockImplementation(() => ({
		testConnection: vi.fn().mockImplementation(async (url) => {
			if (url === "http://localhost:9222") {
				return {
					success: true,
					message: "Successfully connected to Chrome",
					endpoint: "ws://localhost:9222/devtools/browser/123",
				}
			} else {
				return {
					success: false,
					message: "Failed to connect to Chrome",
					endpoint: undefined,
				}
			}
		}),
	})),
}))

vi.mock("../../../../services/browser/browserDiscovery", () => ({
	discoverChromeHostUrl: vi.fn().mockResolvedValue("http://localhost:9222"),
	tryChromeHostUrl: vi.fn().mockImplementation(async (url) => {
		return url === "http://localhost:9222"
	}),
	testBrowserConnection: vi.fn(),
}))

const mockAddCustomInstructions = vi.fn().mockResolvedValue("Combined instructions")

;(vi.mocked(await import("../../../prompts/sections/custom-instructions")) as any).addCustomInstructions =
	mockAddCustomInstructions

vi.mock("delay", () => {
	const delayFn = (_ms: number) => Promise.resolve()
	delayFn.createDelay = () => delayFn
	delayFn.reject = () => Promise.reject(new Error("Delay rejected"))
	delayFn.range = () => Promise.resolve()
	return { default: delayFn }
})

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
	Client: vi.fn().mockImplementation(() => ({
		connect: vi.fn().mockResolvedValue(undefined),
		close: vi.fn().mockResolvedValue(undefined),
		listTools: vi.fn().mockResolvedValue({ tools: [] }),
		callTool: vi.fn().mockResolvedValue({ content: [] }),
	})),
}))

vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => ({
	StdioClientTransport: vi.fn().mockImplementation(() => ({
		connect: vi.fn().mockResolvedValue(undefined),
		close: vi.fn().mockResolvedValue(undefined),
	})),
}))

vi.mock("vscode", () => ({
	ExtensionContext: vi.fn(),
	OutputChannel: vi.fn(),
	WebviewView: vi.fn(),
	Uri: {
		joinPath: vi.fn(),
		file: vi.fn(),
	},
	CodeActionKind: {
		QuickFix: { value: "quickfix" },
		RefactorRewrite: { value: "refactor.rewrite" },
	},
	commands: {
		executeCommand: vi.fn().mockResolvedValue(undefined),
	},
	window: {
		showInformationMessage: vi.fn(),
		showWarningMessage: vi.fn(),
		showErrorMessage: vi.fn(),
		onDidChangeActiveTextEditor: vi.fn(() => ({ dispose: vi.fn() })),
	},
	workspace: {
		getConfiguration: vi.fn().mockReturnValue({
			get: vi.fn().mockReturnValue([]),
			update: vi.fn(),
		}),
		onDidChangeConfiguration: vi.fn().mockImplementation(() => ({
			dispose: vi.fn(),
		})),
		onDidSaveTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		onDidOpenTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		onDidCloseTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
	},
	env: {
		uriScheme: "vscode",
		language: "en",
		appName: "Visual Studio Code",
	},
	ExtensionMode: {
		Production: 1,
		Development: 2,
		Test: 3,
	},
	version: "1.85.0",
	extensions: {
		getExtension: vi.fn().mockReturnValue({
			packageJSON: {
				version: "1.0.0",
			},
		}),
	},
}))

vi.mock("../../../../utils/tts", () => ({
	setTtsEnabled: vi.fn(),
	setTtsSpeed: vi.fn(),
}))

vi.mock("../../../../api", () => ({
	buildApiHandler: vi.fn(),
}))

vi.mock("../../../prompts/system", () => ({
	SYSTEM_PROMPT: vi.fn().mockImplementation(async () => "mocked system prompt"),
	codeMode: "code",
}))

vi.mock("../../../../integrations/workspace/WorkspaceTracker", () => {
	return {
		default: vi.fn().mockImplementation(() => ({
			initializeFilePaths: vi.fn(),
			dispose: vi.fn(),
		})),
	}
})

vi.mock("../../Task", () => ({
	Task: vi.fn().mockImplementation((options: any) => {
		const instance = {
			api: undefined,
			abortTask: vi.fn(),
			handleWebviewAskResponse: vi.fn(),
			clineMessages: [],
			apiConversationHistory: [],
			overwriteClineMessages: vi.fn(function(this: any, newMessages: any[]) {
				this.clineMessages = newMessages
			}),
			overwriteApiConversationHistory: vi.fn(function(this: any, newHistory: any[]) {
				this.apiConversationHistory = newHistory
			}),
			getTaskNumber: vi.fn().mockReturnValue(0),
			setTaskNumber: vi.fn(),
			setParentTask: vi.fn(),
			setRootTask: vi.fn(),
			taskId: options?.historyItem?.id || "test-task-id",
			emit: vi.fn(),
			messageManager: {
				rewindToTimestamp: vi.fn(function(this: any, ts: number, options: any = {}) {
					const { includeTargetMessage = false, skipCleanup = false } = options
					const clineIndex = this.clineMessages.findIndex((m: any) => m.ts === ts)
					if (clineIndex === -1) {
						throw new Error(`Message with timestamp ${ts} not found in clineMessages`)
					}
					const cutoffIndex = includeTargetMessage ? clineIndex + 1 : clineIndex
					const removedIds = { condenseIds: new Set(), truncationIds: new Set() }
					this.messageManager.truncateClineMessages(cutoffIndex)
					this.messageManager.truncateApiHistoryWithCleanup(ts, removedIds, skipCleanup)
				}),
				truncateClineMessages: vi.fn(function(this: any, toIndex: number) {
					this.overwriteClineMessages(this.clineMessages.slice(0, toIndex))
				}),
				truncateApiHistoryWithCleanup: vi.fn(function(this: any, cutoffTs: number, removedIds: any, skipCleanup: boolean) {
					const originalHistory = this.apiConversationHistory
					const apiHistory = originalHistory.filter((m: any) => !m.ts || m.ts < cutoffTs)
					const historyChanged = apiHistory.length !== originalHistory.length || apiHistory.some((msg: any, i: number) => msg !== originalHistory[i])
					if (historyChanged) {
						this.overwriteApiConversationHistory(apiHistory)
					}
				}),
			},
		}
		instance.messageManager.rewindToTimestamp = instance.messageManager.rewindToTimestamp.bind(instance)
		instance.messageManager.truncateClineMessages = instance.messageManager.truncateClineMessages.bind(instance)
		instance.messageManager.truncateApiHistoryWithCleanup = instance.messageManager.truncateApiHistoryWithCleanup.bind(instance)
		return instance
	}),
}))

vi.mock("../../../../integrations/misc/extract-text", () => ({
	extractTextFromFile: vi.fn().mockImplementation(async (_filePath: string) => {
		const content = "const x = 1;\nconst y = 2;\nconst z = 3;"
		const lines = content.split("\n")
		return lines.map((line, index) => `${index + 1} | ${line}`).join("\n")
	}),
}))

vi.mock("../../../../api/providers/fetchers/modelCache", () => ({
	getModels: vi.fn().mockResolvedValue({}),
	flushModels: vi.fn(),
	getModelsFromCache: vi.fn().mockReturnValue(undefined),
}))

vi.mock("../../../../shared/modes", () => ({
	modes: [
		{
			slug: "code",
			name: "Code Mode",
			roleDefinition: "You are a code assistant",
			groups: ["read", "edit", "browser"],
		},
		{
			slug: "architect",
			name: "Architect Mode",
			roleDefinition: "You are an architect",
			groups: ["read", "edit"],
		},
		{
			slug: "ask",
			name: "Ask Mode",
			roleDefinition: "You are a helpful assistant",
			groups: ["read"],
		},
	],
	getModeBySlug: vi.fn().mockReturnValue({
		slug: "code",
		name: "Code Mode",
		roleDefinition: "You are a code assistant",
		groups: ["read", "edit", "browser"],
	}),
	getGroupName: vi.fn().mockImplementation((group: string) => {
		switch (group) {
			case "read":
				return "Read Tools"
			case "edit":
				return "Edit Tools"
			case "browser":
				return "Browser Tools"
			case "mcp":
				return "MCP Tools"
			default:
				return "General Tools"
		}
	}),
	defaultModeSlug: "code",
}))

vi.mock("../../../prompts/system", () => ({
	SYSTEM_PROMPT: vi.fn().mockResolvedValue("mocked system prompt"),
	codeMode: "code",
}))

vi.mock("../../../../api", () => ({
	buildApiHandler: vi.fn().mockReturnValue({
		getModel: vi.fn().mockReturnValue({
			id: "claude-3-sonnet",
		}),
	}),
}))

vi.mock("../../../../integrations/misc/extract-text", () => ({
	extractTextFromFile: vi.fn().mockImplementation(async (_filePath: string) => {
		const content = "const x = 1;\nconst y = 2;\nconst z = 3;"
		const lines = content.split("\n")
		return lines.map((line, index) => `${index + 1} | ${line}`).join("\n")
	}),
}))

vi.mock("../../../../api/providers/fetchers/modelCache", () => ({
	getModels: vi.fn().mockResolvedValue({}),
	flushModels: vi.fn(),
	getModelsFromCache: vi.fn().mockReturnValue(undefined),
}))

vi.mock("../../../webview/diff/strategies/multi-search-replace", () => ({
	MultiSearchReplaceDiffStrategy: vi.fn().mockImplementation(() => ({
		getToolDescription: () => "test",
		getName: () => "test-strategy",
		applyDiff: vi.fn(),
	})),
}))

vi.mock("@roo-code/cloud", () => ({
	CloudService: {
		hasInstance: vi.fn().mockReturnValue(true),
		get instance() {
			return {
				isAuthenticated: vi.fn().mockReturnValue(false),
			}
		},
	},
	BridgeOrchestrator: {
		isEnabled: vi.fn().mockReturnValue(false),
	},
	getRooCodeApiUrl: vi.fn().mockReturnValue("https://app.roocode.com"),
}))

afterAll(() => {
	vi.restoreAllMocks()
})

describe("MessageManager - Message Deletion and Editing", () => {
	let provider: ClineProvider
	let mockContext: vscode.ExtensionContext
	let mockOutputChannel: vscode.OutputChannel
	let mockWebviewView: vscode.WebviewView
	let mockPostMessage: any
	let defaultTaskOptions: TaskOptions

	beforeEach(() => {
		vi.clearAllMocks()

		const globalState: Record<string, string | undefined> = {
			mode: "architect",
			currentApiConfigName: "current-config",
		}

		const secrets: Record<string, string | undefined> = {}

		mockContext = {
			extensionPath: "/test/path",
			extensionUri: {} as vscode.Uri,
			globalState: {
				get: vi.fn().mockImplementation((key: string) => globalState[key]),
				update: vi
					.fn()
					.mockImplementation((key: string, value: string | undefined) => (globalState[key] = value)),
				keys: vi.fn().mockImplementation(() => Object.keys(globalState)),
			},
			secrets: {
				get: vi.fn().mockImplementation((key: string) => secrets[key]),
				store: vi.fn().mockImplementation((key: string, value: string | undefined) => (secrets[key] = value)),
				delete: vi.fn().mockImplementation((key: string) => delete secrets[key]),
			},
			subscriptions: [],
			extension: {
				packageJSON: { version: "1.0.0" },
			},
			globalStorageUri: {
				fsPath: "/test/storage/path",
			},
		} as unknown as vscode.ExtensionContext

		const mockCustomModesManager = {
			updateCustomMode: vi.fn().mockResolvedValue(undefined),
			getCustomModes: vi.fn().mockResolvedValue([]),
			dispose: vi.fn(),
		}

		mockOutputChannel = {
			appendLine: vi.fn(),
			clear: vi.fn(),
			dispose: vi.fn(),
		} as unknown as vscode.OutputChannel

		mockPostMessage = vi.fn()

		mockWebviewView = {
			webview: {
				postMessage: mockPostMessage,
				html: "",
				options: {},
				onDidReceiveMessage: vi.fn(),
				asWebviewUri: vi.fn(),
				cspSource: "vscode-webview://test-csp-source",
			},
			visible: true,
			onDidDispose: vi.fn().mockImplementation((callback) => {
				callback()
				return { dispose: vi.fn() }
			}),
			onDidChangeVisibility: vi.fn().mockImplementation(() => ({ dispose: vi.fn() })),
		} as unknown as vscode.WebviewView

		provider = new ClineProvider(mockContext, mockOutputChannel, "sidebar", new ContextProxy(mockContext))

		defaultTaskOptions = {
			provider,
			apiConfiguration: {
				apiProvider: "anthropic",
			},
		}

		provider.getMcpHub = vi.fn().mockReturnValue({
			listTools: vi.fn().mockResolvedValue([]),
			callTool: vi.fn().mockResolvedValue({ content: [] }),
			listResources: vi.fn().mockResolvedValue([]),
			readResource: vi.fn().mockResolvedValue({ contents: [] }),
			getAllServers: vi.fn().mockReturnValue([]),
		})

		;(provider as any)._customModesManager = mockCustomModesManager
	})

	describe("deleteMessage", () => {
		beforeEach(async () => {
			await provider.resolveWebviewView(mockWebviewView)
		})

		test("handles deletion with confirmation dialog", async () => {
			const mockMessages = [
				{ ts: 1000, type: "say", say: "user_feedback" },
				{ ts: 2000, type: "say", say: "tool" },
				{ ts: 3000, type: "say", say: "text" },
				{ ts: 4000, type: "say", say: "browser_action" },
				{ ts: 5000, type: "say", say: "user_feedback" },
				{ ts: 6000, type: "say", say: "user_feedback" },
			] as ClineMessage[]

			const mockApiHistory = [
				{ ts: 1000 },
				{ ts: 2000 },
				{ ts: 3000 },
				{ ts: 4000 },
				{ ts: 5000 },
				{ ts: 6000 },
			] as (Anthropic.MessageParam & { ts?: number })[]

			const mockCline = new Task(defaultTaskOptions)
			mockCline.clineMessages = mockMessages
			mockCline.apiConversationHistory = mockApiHistory
			await provider.addClineToStack(mockCline)

			;(provider as any).getTaskWithId = vi.fn().mockResolvedValue({
				historyItem: { id: "test-task-id" },
			})

			;(provider as any).createTaskWithHistoryItem = vi.fn()

			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]
			await messageHandler({ type: "deleteMessage", value: 4000 })

			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "showDeleteMessageDialog",
				messageTs: 4000,
				hasCheckpoint: false,
			})

			await messageHandler({ type: "deleteMessageConfirm", messageTs: 4000 })

			expect(mockCline.overwriteClineMessages).toHaveBeenCalledWith([
				mockMessages[0],
				mockMessages[1],
				mockMessages[2],
			])

			expect(mockCline.overwriteApiConversationHistory).toHaveBeenCalledWith([
				mockApiHistory[0],
				mockApiHistory[1],
				mockApiHistory[2],
			])

			expect((provider as any).createTaskWithHistoryItem).not.toHaveBeenCalled()
		})

		test("handles case when no current task exists", async () => {
			;(provider as any).clineStack = []

			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]
			await messageHandler({ type: "deleteMessage", value: 2000 })

			expect(mockPostMessage).not.toHaveBeenCalledWith(
				expect.objectContaining({
					type: "showDeleteMessageDialog",
				}),
			)
		})
	})

	describe("editMessage", () => {
		beforeEach(async () => {
			await provider.resolveWebviewView(mockWebviewView)
		})

		test("handles edit with confirmation dialog", async () => {
			const mockMessages = [
				{ ts: 1000, type: "say", say: "user_feedback" },
				{ ts: 2000, type: "say", say: "tool" },
				{ ts: 3000, type: "say", say: "text" },
				{ ts: 4000, type: "say", say: "browser_action" },
				{ ts: 5000, type: "say", say: "user_feedback" },
				{ ts: 6000, type: "say", say: "user_feedback" },
			] as ClineMessage[]

			const mockApiHistory = [
				{ ts: 1000 },
				{ ts: 2000 },
				{ ts: 3000 },
				{ ts: 4000 },
				{ ts: 5000 },
				{ ts: 6000 },
			] as (Anthropic.MessageParam & { ts?: number })[]

			const mockCline = new Task(defaultTaskOptions)
			mockCline.clineMessages = mockMessages
			mockCline.apiConversationHistory = mockApiHistory

			mockCline.overwriteClineMessages = vi.fn()
			mockCline.overwriteApiConversationHistory = vi.fn()
			mockCline.handleWebviewAskResponse = vi.fn()

			await provider.addClineToStack(mockCline)

			;(provider as any).getTaskWithId = vi.fn().mockResolvedValue({
				historyItem: { id: "test-task-id" },
			})

			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			await messageHandler({
				type: "submitEditedMessage",
				value: 4000,
				editedMessageContent: "Edited message content",
			})

			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "showEditMessageDialog",
				messageTs: 4000,
				text: "Edited message content",
				hasCheckpoint: false,
				images: undefined,
			})

			await messageHandler({
				type: "editMessageConfirm",
				messageTs: 4000,
				text: "Edited message content",
			})

			expect(mockCline.overwriteClineMessages).toHaveBeenCalledWith([])

			expect(mockCline.overwriteApiConversationHistory).toHaveBeenCalledWith([])

			expect((mockWebviewView.webview.onDidReceiveMessage as any).mock.calls.length).toBeGreaterThanOrEqual(1)
		})
	})

	describe("Edit Messages with Images and Attachments", () => {
		beforeEach(async () => {
			await provider.resolveWebviewView(mockWebviewView)
		})

		test("handles editing messages containing images", async () => {
			const mockMessages = [
				{ ts: 1000, type: "say", say: "user_feedback", text: "Original message" },
				{
					ts: 2000,
					type: "say",
					say: "user_feedback",
					text: "Message with image",
					images: [
						"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
					],
					value: 3000,
				},
				{ ts: 3000, type: "say", say: "text", text: "AI response" },
			] as ClineMessage[]

			const mockCline = new Task(defaultTaskOptions)
			mockCline.clineMessages = mockMessages
			mockCline.apiConversationHistory = [{ ts: 1000 }, { ts: 2000 }, { ts: 3000 }] as any[]
			mockCline.overwriteClineMessages = vi.fn()
			mockCline.overwriteApiConversationHistory = vi.fn()
			mockCline.submitUserMessage = vi.fn()

			await provider.addClineToStack(mockCline)
			;(provider as any).getTaskWithId = vi.fn().mockResolvedValue({
				historyItem: { id: "test-task-id" },
			})

			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]
			await messageHandler({
				type: "submitEditedMessage",
				value: 3000,
				editedMessageContent: "Edited message with preserved images",
			})

			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "showEditMessageDialog",
				messageTs: 3000,
				text: "Edited message with preserved images",
				hasCheckpoint: false,
				images: undefined,
			})

			await messageHandler({
				type: "editMessageConfirm",
				messageTs: 3000,
				text: "Edited message with preserved images",
			})

			expect(mockCline.overwriteClineMessages).toHaveBeenCalledWith([mockMessages[0]])
			expect(mockCline.overwriteApiConversationHistory).toHaveBeenCalledWith([{ ts: 1000 }])
			expect(mockCline.submitUserMessage).toHaveBeenCalledWith("Edited message with preserved images", undefined)
		})

		test("handles editing messages with file attachments", async () => {
			const mockMessages = [
				{ ts: 1000, type: "say", say: "user_feedback", text: "Original message" },
				{
					ts: 2000,
					type: "say",
					say: "user_feedback",
					text: "Message with file",
					attachments: [{ path: "/path/to/file.txt", type: "file" }],
					value: 3000,
				},
				{ ts: 3000, type: "say", say: "text", text: "AI response" },
			] as ClineMessage[]

			const mockCline = new Task(defaultTaskOptions)
			mockCline.clineMessages = mockMessages
			mockCline.apiConversationHistory = [{ ts: 1000 }, { ts: 2000 }, { ts: 3000 }] as any[]
			mockCline.overwriteClineMessages = vi.fn()
			mockCline.overwriteApiConversationHistory = vi.fn()
			mockCline.submitUserMessage = vi.fn()

			await provider.addClineToStack(mockCline)
			;(provider as any).getTaskWithId = vi.fn().mockResolvedValue({
				historyItem: { id: "test-task-id" },
			})

			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]
			await messageHandler({
				type: "submitEditedMessage",
				value: 3000,
				editedMessageContent: "Edited message with file attachment",
			})

			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "showEditMessageDialog",
				messageTs: 3000,
				text: "Edited message with file attachment",
				hasCheckpoint: false,
				images: undefined,
			})

			await messageHandler({
				type: "editMessageConfirm",
				messageTs: 3000,
				text: "Edited message with file attachment",
			})

			expect(mockCline.overwriteClineMessages).toHaveBeenCalled()
			expect(mockCline.submitUserMessage).toHaveBeenCalledWith("Edited message with file attachment", undefined)
		})
	})

	describe("Network Failure Scenarios", () => {
		beforeEach(async () => {
			;(vscode.window.showInformationMessage as any) = vi.fn()
			await provider.resolveWebviewView(mockWebviewView)
		})

		test("handles network timeout during edit submission", async () => {
			const mockCline = new Task(defaultTaskOptions)
			mockCline.clineMessages = [
				{ ts: 1000, type: "say", say: "user_feedback", text: "Original message", value: 2000 },
				{ ts: 2000, type: "say", say: "text", text: "AI response" },
			] as ClineMessage[]
			mockCline.apiConversationHistory = [{ ts: 1000 }, { ts: 2000 }] as any[]
			mockCline.overwriteClineMessages = vi.fn()
			mockCline.overwriteApiConversationHistory = vi.fn()
			mockCline.handleWebviewAskResponse = vi.fn().mockRejectedValue(new Error("Network timeout"))

			await provider.addClineToStack(mockCline)
			;(provider as any).getTaskWithId = vi.fn().mockResolvedValue({
				historyItem: { id: "test-task-id" },
			})

			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			await expect(
				messageHandler({
					type: "submitEditedMessage",
					value: 2000,
					editedMessageContent: "Edited message",
				}),
			).resolves.toBeUndefined()

			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "showEditMessageDialog",
				messageTs: 2000,
				text: "Edited message",
				hasCheckpoint: false,
				images: undefined,
			})

			await messageHandler({ type: "editMessageConfirm", messageTs: 2000, text: "Edited message" })

			expect(mockCline.overwriteClineMessages).toHaveBeenCalled()
		})

		test("handles connection drops during edit operation", async () => {
			const mockCline = new Task(defaultTaskOptions)
			mockCline.clineMessages = [
				{ ts: 1000, type: "say", say: "user_feedback", text: "Original message", value: 2000 },
				{ ts: 2000, type: "say", say: "text", text: "AI response" },
			] as ClineMessage[]
			mockCline.apiConversationHistory = [{ ts: 1000 }, { ts: 2000 }] as any[]
			mockCline.overwriteClineMessages = vi.fn().mockRejectedValue(new Error("Connection lost"))
			mockCline.overwriteApiConversationHistory = vi.fn()
			mockCline.handleWebviewAskResponse = vi.fn()

			await provider.addClineToStack(mockCline)
			;(provider as any).getTaskWithId = vi.fn().mockResolvedValue({
				historyItem: { id: "test-task-id" },
			})

			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			await expect(
				messageHandler({
					type: "submitEditedMessage",
					value: 2000,
					editedMessageContent: "Edited message",
				}),
			).resolves.toBeUndefined()

			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "showEditMessageDialog",
				messageTs: 2000,
				text: "Edited message",
				hasCheckpoint: false,
				images: undefined,
			})

			await messageHandler({ type: "editMessageConfirm", messageTs: 2000, text: "Edited message" })

			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("errors.message.error_editing_message")
		})
	})

	describe("Concurrent Edit Operations", () => {
		beforeEach(async () => {
			;(vscode.window.showInformationMessage as any) = vi.fn()
			await provider.resolveWebviewView(mockWebviewView)
		})

		test("handles race conditions with simultaneous edits", async () => {
			const mockCline = new Task(defaultTaskOptions)
			mockCline.clineMessages = [
				{ ts: 1000, type: "say", say: "user_feedback", text: "Message 1", value: 2000 },
				{ ts: 2000, type: "say", say: "text", text: "AI response 1" },
				{ ts: 3000, type: "say", say: "user_feedback", text: "Message 2", value: 4000 },
				{ ts: 4000, type: "say", say: "text", text: "AI response 2" },
			] as ClineMessage[]
			mockCline.apiConversationHistory = [{ ts: 1000 }, { ts: 2000 }, { ts: 3000 }, { ts: 4000 }] as any[]
			mockCline.overwriteClineMessages = vi.fn()
			mockCline.overwriteApiConversationHistory = vi.fn()
			mockCline.handleWebviewAskResponse = vi.fn()

			await provider.addClineToStack(mockCline)
			;(provider as any).getTaskWithId = vi.fn().mockResolvedValue({
				historyItem: { id: "test-task-id" },
			})

			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			const edit1Promise = messageHandler({
				type: "submitEditedMessage",
				value: 2000,
				editedMessageContent: "Edited message 1",
			})

			const edit2Promise = messageHandler({
				type: "submitEditedMessage",
				value: 4000,
				editedMessageContent: "Edited message 2",
			})

			await Promise.all([edit1Promise, edit2Promise])

			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "showEditMessageDialog",
				messageTs: 2000,
				text: "Edited message 1",
				hasCheckpoint: false,
				images: undefined,
			})
			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "showEditMessageDialog",
				messageTs: 4000,
				text: "Edited message 2",
				hasCheckpoint: false,
				images: undefined,
			})

			await messageHandler({ type: "editMessageConfirm", messageTs: 2000, text: "Edited message 1" })
			await messageHandler({ type: "editMessageConfirm", messageTs: 4000, text: "Edited message 2" })

			expect(mockCline.overwriteClineMessages).toHaveBeenCalled()
		})
	})

	describe("Edit Permissions and Authorization", () => {
		beforeEach(async () => {
			;(vscode.window.showInformationMessage as any) = vi.fn()
			await provider.resolveWebviewView(mockWebviewView)
		})

		test("handles edit permission failures", async () => {
			vi.spyOn(provider, "getCurrentTask").mockReturnValue(undefined)

			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			await messageHandler({
				type: "submitEditedMessage",
				value: 2000,
				editedMessageContent: "Edited message",
			})

			expect(vscode.window.showInformationMessage).not.toHaveBeenCalled()
		})

		test("handles authorization failures during edit", async () => {
			const mockCline = new Task(defaultTaskOptions)
			mockCline.clineMessages = [
				{ ts: 1000, type: "say", say: "user_feedback", text: "Original message", value: 2000 },
				{ ts: 2000, type: "say", say: "text", text: "AI response" },
			] as ClineMessage[]
			mockCline.apiConversationHistory = [{ ts: 1000 }, { ts: 2000 }] as any[]
			mockCline.overwriteClineMessages = vi.fn().mockRejectedValue(new Error("Unauthorized"))
			mockCline.overwriteApiConversationHistory = vi.fn()
			mockCline.handleWebviewAskResponse = vi.fn()

			await provider.addClineToStack(mockCline)
			;(provider as any).getTaskWithId = vi.fn().mockResolvedValue({
				historyItem: { id: "test-task-id" },
			})

			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			await messageHandler({
				type: "submitEditedMessage",
				value: 2000,
				editedMessageContent: "Edited message",
			})

			await messageHandler({
				type: "editMessageConfirm",
				messageTs: 2000,
				text: "Edited message",
			})

			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("errors.message.error_editing_message")
		})
	})

	describe("Malformed Requests and Invalid Formats", () => {
		beforeEach(async () => {
			await provider.resolveWebviewView(mockWebviewView)
		})

		test("handles malformed edit requests", async () => {
			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			await messageHandler({
				type: "submitEditedMessage",
				editedMessageContent: "Edited message",
			})

			await messageHandler({
				type: "submitEditedMessage",
				value: "invalid",
				editedMessageContent: "Edited message",
			})

			await messageHandler({
				type: "submitEditedMessage",
				value: 2000,
			})

			expect(vscode.window.showInformationMessage).not.toHaveBeenCalled()
		})

		test("handles invalid message formats", async () => {
			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			await expect(messageHandler(null)).rejects.toThrow()

			await expect(messageHandler(undefined)).rejects.toThrow()

			await expect(
				messageHandler({
					value: 2000,
					editedMessageContent: "Edited message",
				}),
			).resolves.toBeUndefined()

			expect(vscode.window.showInformationMessage).not.toHaveBeenCalled()
		})

		test("handles invalid timestamp values", async () => {
			;(vscode.window.showInformationMessage as any) = vi.fn()

			const mockCline = new Task(defaultTaskOptions)
			mockCline.clineMessages = [
				{ ts: 1000, type: "say", say: "user_feedback", text: "Original message" },
				{ ts: 2000, type: "say", say: "text", text: "AI response" },
			] as ClineMessage[]
			mockCline.apiConversationHistory = [{ ts: 1000 }, { ts: 2000 }] as any[]

			await provider.addClineToStack(mockCline)

			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			await messageHandler({
				type: "deleteMessage",
				value: -1000,
			})

			await messageHandler({
				type: "deleteMessage",
				value: 0,
			})
		})
	})

	describe("Operations on Deleted or Non-existent Messages", () => {
		beforeEach(async () => {
			;(vscode.window.showInformationMessage as any) = vi.fn()
			await provider.resolveWebviewView(mockWebviewView)
		})

		test("handles edit operations on deleted messages", async () => {
			const mockCline = new Task(defaultTaskOptions)
			mockCline.clineMessages = [
				{ ts: 1000, type: "say", say: "user_feedback", text: "Existing message" },
			] as ClineMessage[]
			mockCline.apiConversationHistory = [{ ts: 1000 }] as any[]
			mockCline.overwriteClineMessages = vi.fn()
			mockCline.overwriteApiConversationHistory = vi.fn()
			mockCline.handleWebviewAskResponse = vi.fn()

			await provider.addClineToStack(mockCline)
			;(provider as any).getTaskWithId = vi.fn().mockResolvedValue({
				historyItem: { id: "test-task-id" },
			})

			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			await messageHandler({
				type: "submitEditedMessage",
				value: 5000,
				editedMessageContent: "Edited non-existent message",
			})

			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "showEditMessageDialog",
				messageTs: 5000,
				text: "Edited non-existent message",
				hasCheckpoint: false,
				images: undefined,
			})

			await messageHandler({
				type: "editMessageConfirm",
				messageTs: 5000,
				text: "Edited non-existent message",
			})

			expect(mockCline.overwriteClineMessages).not.toHaveBeenCalled()
			expect(mockCline.handleWebviewAskResponse).not.toHaveBeenCalled()
		})

		test("handles delete operations on non-existent messages", async () => {
			const mockCline = new Task(defaultTaskOptions)
			mockCline.clineMessages = [
				{ ts: 1000, type: "say", say: "user_feedback", text: "Existing message" },
			] as ClineMessage[]
			mockCline.apiConversationHistory = [{ ts: 1000 }] as any[]
			mockCline.overwriteClineMessages = vi.fn()
			mockCline.overwriteApiConversationHistory = vi.fn()

			await provider.addClineToStack(mockCline)
			;(provider as any).getTaskWithId = vi.fn().mockResolvedValue({
				historyItem: { id: "test-task-id" },
			})

			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			await messageHandler({
				type: "deleteMessage",
				value: 5000,
			})

			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "showDeleteMessageDialog",
				messageTs: 5000,
				hasCheckpoint: false,
			})

			await messageHandler({ type: "deleteMessageConfirm", messageTs: 5000 })

			expect(mockCline.overwriteClineMessages).not.toHaveBeenCalled()
		})
	})

	describe("Resource Cleanup During Failed Operations", () => {
		beforeEach(async () => {
			;(vscode.window.showInformationMessage as any) = vi.fn()
			await provider.resolveWebviewView(mockWebviewView)
		})

		test("validates proper cleanup during failed edit operations", async () => {
			const mockCline = new Task(defaultTaskOptions)
			mockCline.clineMessages = [
				{ ts: 1000, type: "say", say: "user_feedback", text: "Original message", value: 2000 },
				{ ts: 2000, type: "say", say: "text", text: "AI response" },
			] as ClineMessage[]
			mockCline.apiConversationHistory = [{ ts: 1000 }, { ts: 2000 }] as any[]
			mockCline.overwriteClineMessages = vi.fn().mockRejectedValue(new Error("Operation failed"))
			mockCline.overwriteApiConversationHistory = vi.fn()
			mockCline.handleWebviewAskResponse = vi.fn()

			await provider.addClineToStack(mockCline)
			;(provider as any).getTaskWithId = vi.fn().mockResolvedValue({
				historyItem: { id: "test-task-id" },
			})

			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			await messageHandler({
				type: "submitEditedMessage",
				value: 2000,
				editedMessageContent: "Edited message",
			})

			await messageHandler({
				type: "editMessageConfirm",
				messageTs: 2000,
				text: "Edited message",
			})

			expect(mockCline.overwriteClineMessages).toHaveBeenCalled()
		})

		test("handles user cancellation gracefully", async () => {
			const mockCline = new Task(defaultTaskOptions)
			mockCline.clineMessages = [
				{ ts: 1000, type: "say", say: "user_feedback", text: "Message to edit" },
				{ ts: 2000, type: "say", say: "text", text: "AI response" },
			] as ClineMessage[]
			mockCline.apiConversationHistory = [{ ts: 1000 }, { ts: 2000 }] as any[]
			mockCline.overwriteClineMessages = vi.fn()
			mockCline.overwriteApiConversationHistory = vi.fn()
			mockCline.handleWebviewAskResponse = vi.fn()

			await provider.addClineToStack(mockCline)

			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			await messageHandler({
				type: "submitEditedMessage",
				value: 2000,
				editedMessageContent: "Edited message",
			})

			expect(mockCline.overwriteClineMessages).not.toHaveBeenCalled()
			expect(mockCline.overwriteApiConversationHistory).not.toHaveBeenCalled()
			expect(mockCline.handleWebviewAskResponse).not.toHaveBeenCalled()
			expect(vscode.window.showErrorMessage).not.toHaveBeenCalled()
		})
	})

	describe("Edge Cases with Message Timestamps", () => {
		beforeEach(async () => {
			;(vscode.window.showInformationMessage as any) = vi.fn()
			await provider.resolveWebviewView(mockWebviewView)
		})

		test("handles messages with identical timestamps", async () => {
			const mockCline = new Task(defaultTaskOptions)
			mockCline.clineMessages = [
				{ ts: 1000, type: "say", say: "user_feedback", text: "Message 1" },
				{ ts: 1000, type: "say", say: "text", text: "Message 2 (same timestamp)" },
				{ ts: 1000, type: "say", say: "user_feedback", text: "Message 3 (same timestamp)" },
				{ ts: 2000, type: "say", say: "text", text: "Message 4" },
			] as ClineMessage[]
			mockCline.apiConversationHistory = [{ ts: 1000 }, { ts: 1000 }, { ts: 1000 }, { ts: 2000 }] as any[]
			mockCline.overwriteClineMessages = vi.fn()
			mockCline.overwriteApiConversationHistory = vi.fn()

			await provider.addClineToStack(mockCline)
			;(provider as any).getTaskWithId = vi.fn().mockResolvedValue({
				historyItem: { id: "test-task-id" },
			})

			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			await messageHandler({ type: "deleteMessage", value: 1000 })

			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "showDeleteMessageDialog",
				messageTs: 1000,
				hasCheckpoint: false,
			})

			await messageHandler({ type: "deleteMessageConfirm", messageTs: 1000 })

			expect(mockCline.overwriteClineMessages).toHaveBeenCalled()
		})

		test("handles messages with future timestamps", async () => {
			const futureTimestamp = Date.now() + 100000
			const mockCline = new Task(defaultTaskOptions)
			mockCline.clineMessages = [
				{ ts: 1000, type: "say", say: "user_feedback", text: "Past message" },
				{
					ts: futureTimestamp,
					type: "say",
					say: "user_feedback",
					text: "Future message",
					value: futureTimestamp + 1000,
				},
				{ ts: futureTimestamp + 1000, type: "say", say: "text", text: "AI response" },
			] as ClineMessage[]
			mockCline.apiConversationHistory = [
				{ ts: 1000 },
				{ ts: futureTimestamp },
				{ ts: futureTimestamp + 1000 },
			] as any[]
			mockCline.overwriteClineMessages = vi.fn()
			mockCline.overwriteApiConversationHistory = vi.fn()
			mockCline.submitUserMessage = vi.fn()

			await provider.addClineToStack(mockCline)
			;(provider as any).getTaskWithId = vi.fn().mockResolvedValue({
				historyItem: { id: "test-task-id" },
			})

			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			await messageHandler({
				type: "submitEditedMessage",
				value: futureTimestamp + 1000,
				editedMessageContent: "Edited future message",
			})

			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "showEditMessageDialog",
				messageTs: futureTimestamp + 1000,
				text: "Edited future message",
				hasCheckpoint: false,
				images: undefined,
			})

			await messageHandler({
				type: "editMessageConfirm",
				messageTs: futureTimestamp + 1000,
				text: "Edited future message",
			})

			expect(mockCline.overwriteClineMessages).toHaveBeenCalled()
			expect(mockCline.submitUserMessage).toHaveBeenCalled()
		})
	})

	describe("Large Message Payloads", () => {
		beforeEach(async () => {
			;(vscode.window.showInformationMessage as any) = vi.fn()
			await provider.resolveWebviewView(mockWebviewView)
		})

		test("handles editing messages with large text content", async () => {
			const largeText = "A".repeat(10000)
			const mockMessages = [
				{ ts: 1000, type: "say", say: "user_feedback", text: largeText, value: 2000 },
				{ ts: 2000, type: "say", say: "text", text: "AI response" },
			] as ClineMessage[]

			const mockCline = new Task(defaultTaskOptions)
			mockCline.clineMessages = mockMessages
			mockCline.apiConversationHistory = [{ ts: 1000 }, { ts: 2000 }] as any[]
			mockCline.overwriteClineMessages = vi.fn()
			mockCline.overwriteApiConversationHistory = vi.fn()
			mockCline.submitUserMessage = vi.fn()

			await provider.addClineToStack(mockCline)
			;(provider as any).getTaskWithId = vi.fn().mockResolvedValue({
				historyItem: { id: "test-task-id" },
			})

			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			const largeEditedContent = "B".repeat(15000)
			await messageHandler({
				type: "submitEditedMessage",
				value: 2000,
				editedMessageContent: largeEditedContent,
			})

			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "showEditMessageDialog",
				messageTs: 2000,
				text: largeEditedContent,
				hasCheckpoint: false,
				images: undefined,
			})

			await messageHandler({ type: "editMessageConfirm", messageTs: 2000, text: largeEditedContent })

			expect(mockCline.overwriteClineMessages).toHaveBeenCalled()
			expect(mockCline.submitUserMessage).toHaveBeenCalledWith(largeEditedContent, undefined)
		})

		test("handles deleting messages with large payloads", async () => {
			const largeText = "X".repeat(50000)
			const mockMessages = [
				{ ts: 1000, type: "say", say: "user_feedback", text: "Small message" },
				{ ts: 2000, type: "say", say: "user_feedback", text: largeText },
				{ ts: 3000, type: "say", say: "text", text: "AI response" },
				{ ts: 4000, type: "say", say: "user_feedback", text: "Another large message: " + largeText },
			] as ClineMessage[]

			const mockCline = new Task(defaultTaskOptions)
			mockCline.clineMessages = mockMessages
			mockCline.apiConversationHistory = [{ ts: 1000 }, { ts: 2000 }, { ts: 3000 }, { ts: 4000 }] as any[]
			mockCline.overwriteClineMessages = vi.fn()
			mockCline.overwriteApiConversationHistory = vi.fn()

			await provider.addClineToStack(mockCline)
			;(provider as any).getTaskWithId = vi.fn().mockResolvedValue({
				historyItem: { id: "test-task-id" },
			})

			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			await messageHandler({ type: "deleteMessage", value: 3000 })

			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "showDeleteMessageDialog",
				messageTs: 3000,
				hasCheckpoint: false,
			})

			await messageHandler({ type: "deleteMessageConfirm", messageTs: 3000 })

			expect(mockCline.overwriteClineMessages).toHaveBeenCalledWith([mockMessages[0], mockMessages[1]])
			expect(mockCline.overwriteApiConversationHistory).toHaveBeenCalledWith([{ ts: 1000 }, { ts: 2000 }])
		})
	})

	describe("Error Messaging and User Feedback", () => {
		beforeEach(async () => {
			await provider.resolveWebviewView(mockWebviewView)
		})

		test("provides user feedback for successful operations", async () => {
			const mockCline = new Task(defaultTaskOptions)
			mockCline.clineMessages = [
				{ ts: 1000, type: "say", say: "user_feedback", text: "Message to delete" },
				{ ts: 2000, type: "say", say: "text", text: "AI response" },
			] as ClineMessage[]
			mockCline.apiConversationHistory = [{ ts: 1000 }, { ts: 2000 }] as any[]
			mockCline.overwriteClineMessages = vi.fn()
			mockCline.overwriteApiConversationHistory = vi.fn()

			await provider.addClineToStack(mockCline)
			;(provider as any).getTaskWithId = vi.fn().mockResolvedValue({
				historyItem: { id: "test-task-id" },
			})
			;(provider as any).createTaskWithHistoryItem = vi.fn()

			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			await messageHandler({ type: "deleteMessage", value: 2000 })

			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "showDeleteMessageDialog",
				messageTs: 2000,
				hasCheckpoint: false,
			})

			await messageHandler({ type: "deleteMessageConfirm", messageTs: 2000 })

			expect(mockCline.overwriteClineMessages).toHaveBeenCalled()
			expect(vscode.window.showErrorMessage).not.toHaveBeenCalled()
		})

		test("handles user cancellation gracefully", async () => {
			const mockCline = new Task(defaultTaskOptions)
			mockCline.clineMessages = [
				{ ts: 1000, type: "say", say: "user_feedback", text: "Message to edit" },
				{ ts: 2000, type: "say", say: "text", text: "AI response" },
			] as ClineMessage[]
			mockCline.apiConversationHistory = [{ ts: 1000 }, { ts: 2000 }] as any[]
			mockCline.overwriteClineMessages = vi.fn()
			mockCline.overwriteApiConversationHistory = vi.fn()
			mockCline.handleWebviewAskResponse = vi.fn()

			await provider.addClineToStack(mockCline)

			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			await messageHandler({
				type: "submitEditedMessage",
				value: 2000,
				editedMessageContent: "Edited message",
			})

			expect(mockCline.overwriteClineMessages).not.toHaveBeenCalled()
			expect(mockCline.overwriteApiConversationHistory).not.toHaveBeenCalled()
			expect(mockCline.handleWebviewAskResponse).not.toHaveBeenCalled()
			expect(vscode.window.showErrorMessage).not.toHaveBeenCalled()
		})
	})
})
