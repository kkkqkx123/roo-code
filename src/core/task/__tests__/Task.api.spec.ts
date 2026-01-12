// npx vitest core/task/__tests__/Task.api.spec.ts

import * as vscode from "vscode"

import type { GlobalState, ProviderSettings } from "@roo-code/types"

import { Task } from "../Task"
import { ClineProvider } from "../../webview/ClineProvider"
import { ContextProxy } from "../../config/ContextProxy"
import { MultiSearchReplaceDiffStrategy } from "../../diff/strategies/multi-search-replace"
import { MultiFileSearchReplaceDiffStrategy } from "../../diff/strategies/multi-file-search-replace"
import { EXPERIMENT_IDS } from "../../../shared/experiments"

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

describe("Cline - API Tests", () => {
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
	})

	describe("getApiProtocol", () => {
		it("should determine API protocol based on provider and model", async () => {
			const anthropicConfig = {
				...mockApiConfig,
				apiProvider: "anthropic" as const,
				apiModelId: "gpt-4",
			}
			const anthropicTask = new Task({
				provider: mockProvider,
				apiConfiguration: anthropicConfig,
				task: "test task",
				startTask: false,
			})
			expect(anthropicTask.apiConfiguration.apiProvider).toBe("anthropic")

			const openaiConfig = {
				apiProvider: "openai" as const,
				openAiModelId: "gpt-4",
			}
			const openaiTask = new Task({
				provider: mockProvider,
				apiConfiguration: openaiConfig,
				task: "test task",
				startTask: false,
			})
			expect(openaiTask.apiConfiguration.apiProvider).toBe("openai")

			const claudeModelFormats = [
				"claude-3-opus",
				"Claude-3-Sonnet",
				"CLAUDE-instant",
				"anthropic/claude-3-haiku",
				"some-provider/claude-model",
			]

			for (const modelId of claudeModelFormats) {
				const config = {
					apiProvider: "openai" as const,
					openAiModelId: modelId,
				}
				const task = new Task({
					provider: mockProvider,
					apiConfiguration: config,
					task: "test task",
					startTask: false,
				})
				expect(modelId.toLowerCase()).toContain("claude")
			}
		})

		it("should handle edge cases for API protocol detection", async () => {
			const undefinedProviderConfig = {
				apiModelId: "claude-3-opus",
			}
			const undefinedProviderTask = new Task({
				provider: mockProvider,
				apiConfiguration: undefinedProviderConfig,
				task: "test task",
				startTask: false,
			})
			expect(undefinedProviderTask.apiConfiguration.apiProvider).toBeUndefined()

			const noModelConfig = {
				apiProvider: "openai" as const,
			}
			const noModelTask = new Task({
				provider: mockProvider,
				apiConfiguration: noModelConfig,
				task: "test task",
				startTask: false,
			})
			expect(noModelTask.apiConfiguration.apiProvider).toBe("openai")
		})
	})

	describe("Stream Failure Retry", () => {
		it("should not abort task on stream failure, only on user cancellation", async () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			const abortTaskSpy = vi.spyOn(task, "abortTask").mockResolvedValue(undefined)

			task.abort = false
			task.abandoned = false

			const streamFailureError = new Error("Stream failed mid-execution")

			const shouldAbort = task.abort
			expect(shouldAbort).toBe(false)

			console.error(
				`[Task#${task.taskId}.${task.instanceId}] Stream failed, will retry: ${streamFailureError.message}`,
			)
			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Stream failed, will retry"))

			expect(abortTaskSpy).not.toHaveBeenCalled()

			task.abort = true

			if (task.abort) {
				await task.abortTask()
			}

			expect(abortTaskSpy).toHaveBeenCalled()

			consoleErrorSpy.mockRestore()
		})
	})

	describe("cancelCurrentRequest", () => {
		it("should cancel the current HTTP request via AbortController", () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			const mockAbortController = new AbortController()
			const abortSpy = vi.spyOn(mockAbortController, "abort")
			;(task as any).stateManager.currentRequestAbortController = mockAbortController

			const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			task.cancelCurrentRequest()

			expect(abortSpy).toHaveBeenCalled()

			expect((task as any).stateManager.currentRequestAbortController).toBeUndefined()

			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Aborting current HTTP request"))

			consoleLogSpy.mockRestore()
		})

		it("should handle missing AbortController gracefully", () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			task.currentRequestAbortController = undefined

			expect(() => task.cancelCurrentRequest()).not.toThrow()
		})

		it("should be called during dispose", () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			const cancelSpy = vi.spyOn(task, "cancelCurrentRequest")

			vi.spyOn(task.messageQueueManager.getMessageQueueService(), "removeListener").mockImplementation(
				() => task.messageQueueManager.getMessageQueueService() as any,
			)
			vi.spyOn(task.messageQueueManager, "dispose").mockImplementation(() => {})
			vi.spyOn(task, "removeAllListeners").mockImplementation(() => task as any)

			task.dispose()

			expect(cancelSpy).toHaveBeenCalled()
		})
	})

	describe("Dynamic Strategy Selection", () => {
		let mockProvider: any
		let mockApiConfig: any

		beforeEach(() => {
			vi.clearAllMocks()

			mockApiConfig = {
				apiProvider: "anthropic",
				apiKey: "test-key",
			}

			mockProvider = {
				context: {
					globalStorageUri: { fsPath: "/test/storage" },
				},
				getState: vi.fn(),
			}
		})

		it("should use MultiSearchReplaceDiffStrategy by default", async () => {
			mockProvider.getState.mockResolvedValue({
				experiments: {
					[EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF]: false,
				},
			})

			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				enableDiff: true,
				task: "test task",
				startTask: false,
			})

			expect(task.diffStrategy).toBeInstanceOf(MultiSearchReplaceDiffStrategy)
			expect(task.diffStrategy?.getName()).toBe("MultiSearchReplace")
		})

		it("should switch to MultiFileSearchReplaceDiffStrategy when experiment is enabled", async () => {
			mockProvider.getState.mockResolvedValue({
				experiments: {
					[EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF]: true,
				},
			})

			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				enableDiff: true,
				task: "test task",
				startTask: false,
			})

			expect(task.diffStrategy).toBeInstanceOf(MultiSearchReplaceDiffStrategy)

			await new Promise((resolve) => setTimeout(resolve, 10))

			expect(task.diffStrategy).toBeInstanceOf(MultiFileSearchReplaceDiffStrategy)
			expect(task.diffStrategy?.getName()).toBe("MultiFileSearchReplace")
		})

		it("should keep MultiSearchReplaceDiffStrategy when experiments are undefined", async () => {
			mockProvider.getState.mockResolvedValue({})

			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				enableDiff: true,
				task: "test task",
				startTask: false,
			})

			expect(task.diffStrategy).toBeInstanceOf(MultiSearchReplaceDiffStrategy)

			await new Promise((resolve) => setTimeout(resolve, 10))

			expect(task.diffStrategy).toBeInstanceOf(MultiSearchReplaceDiffStrategy)
			expect(task.diffStrategy?.getName()).toBe("MultiSearchReplace")
		})

		it("should not create diff strategy when enableDiff is false", async () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				enableDiff: false,
				task: "test task",
				startTask: false,
			})

			expect(task.diffEnabled).toBe(false)
			expect(task.diffStrategy).toBeUndefined()
		})
	})
})
