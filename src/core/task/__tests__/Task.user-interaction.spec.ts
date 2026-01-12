// npx vitest core/task/__tests__/Task.user-interaction.spec.ts

import * as vscode from "vscode"

import type { GlobalState, ProviderSettings } from "@roo-code/types"

import { Task } from "../Task"
import { ClineProvider } from "../../webview/ClineProvider"
import { ContextProxy } from "../../config/ContextProxy"

vi.mock("delay", () => ({
	__esModule: true,
	default: vi.fn().mockResolvedValue(undefined),
}))

import delay from "delay"

vi.mock("execa", () => ({
	execa: vi.fn(),
}))

vi.mock("fs/promises", async (importOriginal) => {
	const actual = (await importOriginal()) as Record<string, any>
	const mockFunctions = {
		mkdir: vi.fn().mockResolvedValue(undefined),
		writeFile: vi.fn().mockResolvedValue(undefined),
		readFile: vi.fn().mockResolvedValue("[]"),
		unlink: vi.fn().mockResolvedValue(undefined),
		rmdir: vi.fn().mockResolvedValue(undefined),
		access: vi.fn().mockResolvedValue(undefined),
		rename: vi.fn().mockResolvedValue(undefined),
	}

	return {
		...actual,
		...mockFunctions,
		default: mockFunctions,
	}
})

vi.mock("p-wait-for", () => ({
	default: vi.fn().mockImplementation(async () => Promise.resolve()),
}))

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
	}
})

vi.mock("../../mentions", () => ({
	parseMentions: vi.fn().mockImplementation((text) => {
		return Promise.resolve(`processed: ${text}`)
	}),
	openMention: vi.fn(),
	getLatestTerminalOutput: vi.fn(),
}))

vi.mock("../../../integrations/misc/extract-text", () => ({
	extractTextFromFile: vi.fn().mockResolvedValue("Mock file content"),
}))

vi.mock("../../environment/getEnvironmentDetails", () => ({
	getEnvironmentDetails: vi.fn().mockResolvedValue(""),
}))

vi.mock("../../ignore/RooIgnoreController")

vi.mock("../../condense", async (importOriginal) => {
	const actual = (await importOriginal()) as any
	return {
		...actual,
		summarizeConversation: vi.fn().mockResolvedValue({
			messages: [{ role: "user", content: [{ type: "text", text: "continued" }], ts: Date.now() }],
			summary: "summary",
			cost: 0,
			newContextTokens: 1,
		}),
	}
})

vi.mock("../../../utils/storage", () => ({
	getTaskDirectoryPath: vi
		.fn()
		.mockImplementation((globalStoragePath, taskId) => Promise.resolve(`${globalStoragePath}/tasks/${taskId}`)),
	getSettingsDirectoryPath: vi
		.fn()
		.mockImplementation((globalStoragePath) => Promise.resolve(`${globalStoragePath}/settings`)),
}))

vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn().mockReturnValue(false),
}))

describe("Cline - User Interaction", () => {
	let mockProvider: any
	let mockApiConfig: ProviderSettings
	let mockOutputChannel: any

	beforeEach(() => {
		vi.clearAllMocks()

		mockOutputChannel = {
			appendLine: vi.fn(),
			append: vi.fn(),
			show: vi.fn(),
			clear: vi.fn(),
			dispose: vi.fn(),
		}

		const storageUri = { fsPath: "/mock/storage/path" }
		const ctx = {
			globalState: {
				get: vi.fn().mockImplementation((_key: keyof GlobalState) => undefined),
				update: vi.fn().mockResolvedValue(undefined),
				keys: vi.fn().mockReturnValue([]),
			},
			globalStorageUri: storageUri,
			workspaceState: {
				get: vi.fn().mockImplementation((_key) => undefined),
				update: vi.fn().mockResolvedValue(undefined),
				keys: vi.fn().mockReturnValue([]),
			},
			secrets: {
				get: vi.fn().mockResolvedValue(undefined),
				store: vi.fn().mockResolvedValue(undefined),
				delete: vi.fn().mockResolvedValue(undefined),
			},
			extensionUri: { fsPath: "/mock/extension/path" },
			extension: { packageJSON: { version: "1.0.0" } },
		} as unknown as vscode.ExtensionContext

		mockProvider = new ClineProvider(ctx, mockOutputChannel, "sidebar", new ContextProxy(ctx))

		mockApiConfig = {
			apiProvider: "anthropic",
			apiModelId: "claude-3-5-sonnet-20241022",
			anthropicBaseUrl: "https://api.anthropic.com",
			anthropicApiKey: "test-key",
			anthropicModelId: "claude-3-5-sonnet-20241022",
		} as ProviderSettings

		mockProvider.postMessageToWebview = vi.fn().mockResolvedValue(undefined)
	})

	describe("submitUserMessage", () => {
		it("should always route through webview sendMessage invoke", async () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "initial task",
				startTask: false,
			})

			task.clineMessages = [
				{
					ts: Date.now(),
					type: "say",
					say: "text",
					text: "Initial message",
				},
			]

			task.submitUserMessage("test message", ["image1.png"])

			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "invoke",
				invoke: "sendMessage",
				text: "test message",
				images: ["image1.png"],
			})
		})

		it("should handle empty messages gracefully", async () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "initial task",
				startTask: false,
			})

			task.submitUserMessage("", [])

			expect(mockProvider.postMessageToWebview).not.toHaveBeenCalled()

			task.submitUserMessage("   ", [])
			expect(mockProvider.postMessageToWebview).not.toHaveBeenCalled()
		})

		it("should route through webview for both new and existing tasks", async () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "initial task",
				startTask: false,
			})

			task.clineMessages = []
			task.submitUserMessage("new task", ["image1.png"])

			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "invoke",
				invoke: "sendMessage",
				text: "new task",
				images: ["image1.png"],
			})

			mockProvider.postMessageToWebview.mockClear()

			task.clineMessages = [
				{
					ts: Date.now(),
					type: "say",
					say: "text",
					text: "Initial message",
				},
			]
			task.submitUserMessage("follow-up message", ["image2.png"])

			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "invoke",
				invoke: "sendMessage",
				text: "follow-up message",
				images: ["image2.png"],
			})
		})

		it("should handle undefined provider gracefully", async () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "initial task",
				startTask: false,
			})

			// Mock the MessageQueueManager's providerRef instead of task.providerRef
			Object.defineProperty(task.messageQueueManager, "providerRef", {
				value: { deref: () => undefined },
				writable: false,
				configurable: true,
			})

			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			task.submitUserMessage("test message")

			expect(consoleErrorSpy).toHaveBeenCalledWith("[MessageQueueManager#submitUserMessage] Provider reference lost")
			expect(mockProvider.postMessageToWebview).not.toHaveBeenCalled()

			consoleErrorSpy.mockRestore()
		})
	})
})
