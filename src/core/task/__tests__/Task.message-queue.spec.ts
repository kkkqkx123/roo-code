// npx vitest core/task/__tests__/Task.message-queue.spec.ts

import * as os from "os"
import * as path from "path"

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

describe("Cline - Queued message processing after condense", () => {
	function createProvider(): any {
		const storageUri = { fsPath: path.join(os.tmpdir(), "test-storage") }
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

		const output = {
			appendLine: vi.fn(),
			append: vi.fn(),
			clear: vi.fn(),
			show: vi.fn(),
			hide: vi.fn(),
			dispose: vi.fn(),
		}

		const provider = new ClineProvider(ctx, output as any, "sidebar", new ContextProxy(ctx)) as any
		provider.postMessageToWebview = vi.fn().mockResolvedValue(undefined)
		provider.postStateToWebview = vi.fn().mockResolvedValue(undefined)
		provider.getState = vi.fn().mockResolvedValue({})
		return provider
	}

	const apiConfig: ProviderSettings = {
		apiProvider: "anthropic",
		apiModelId: "claude-3-5-sonnet-20241022",
		apiKey: "test-api-key",
	} as any

	it("processes queued message after condense completes", async () => {
		const provider = createProvider()
		const task = new Task({
			provider,
			apiConfiguration: apiConfig,
			task: "initial task",
			startTask: false,
		})

		vi.spyOn(task as any, "getSystemPrompt").mockResolvedValue("system")
		const submitSpy = vi.spyOn(task, "submitUserMessage").mockResolvedValue(undefined)

		task.messageQueueManager.getMessageQueueService().addMessage("queued text", ["img1.png"])

		vi.useFakeTimers()
		await task.condenseContext()

		vi.runAllTimers()
		vi.useRealTimers()

		expect(submitSpy).toHaveBeenCalledWith("queued text", ["img1.png"])
		expect(task.messageQueueManager.getMessageQueueService().isEmpty()).toBe(true)
	})

	it("does not cross-drain queues between separate tasks", async () => {
		const providerA = createProvider()
		const providerB = createProvider()

		const taskA = new Task({
			provider: providerA,
			apiConfiguration: apiConfig,
			task: "task A",
			startTask: false,
		})
		const taskB = new Task({
			provider: providerB,
			apiConfiguration: apiConfig,
			task: "task B",
			startTask: false,
		})

		vi.spyOn(taskA as any, "getSystemPrompt").mockResolvedValue("system")
		vi.spyOn(taskB as any, "getSystemPrompt").mockResolvedValue("system")

		const spyA = vi.spyOn(taskA, "submitUserMessage").mockResolvedValue(undefined)
		const spyB = vi.spyOn(taskB, "submitUserMessage").mockResolvedValue(undefined)

		taskA.messageQueueManager.getMessageQueueService().addMessage("A message")
		taskB.messageQueueManager.getMessageQueueService().addMessage("B message")

		vi.useFakeTimers()
		await taskA.condenseContext()
		vi.runAllTimers()
		vi.useRealTimers()

		expect(spyA).toHaveBeenCalledWith("A message", undefined)
		expect(spyB).not.toHaveBeenCalled()
		expect(taskB.messageQueueManager.getMessageQueueService().isEmpty()).toBe(false)

		vi.useFakeTimers()
		await taskB.condenseContext()
		vi.runAllTimers()
		vi.useRealTimers()

		expect(spyB).toHaveBeenCalledWith("B message", undefined)
		expect(taskB.messageQueueManager.getMessageQueueService().isEmpty()).toBe(true)
	})
})
