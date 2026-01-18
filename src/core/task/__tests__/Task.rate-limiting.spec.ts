// npx vitest core/task/__tests__/Task.rate-limiting.spec.ts

import * as vscode from "vscode"

import type { GlobalState, ProviderSettings } from "@shared/types"

import { Task } from "../Task"
import { ClineProvider } from "../../webview/ClineProvider"
import { ApiStreamChunk } from "../../../api/transform/stream"

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

describe("Cline - Subtask Rate Limiting", () => {
	let mockProvider: any
	let mockApiConfig: any
	let mockDelay: ReturnType<typeof vi.fn>

	beforeEach(() => {
		vi.clearAllMocks()
		Task.resetGlobalApiRequestTime()

		mockApiConfig = {
			apiProvider: "anthropic",
			apiKey: "test-key",
			rateLimitSeconds: 5,
		}

		mockProvider = {
			context: {
				globalStorageUri: { fsPath: "/test/storage" },
			},
			getState: vi.fn().mockResolvedValue({
				apiConfiguration: mockApiConfig,
			}),
			getMcpHub: vi.fn().mockReturnValue({
				getServers: vi.fn().mockReturnValue([]),
			}),
			say: vi.fn(),
			postStateToWebview: vi.fn().mockResolvedValue(undefined),
			postMessageToWebview: vi.fn().mockResolvedValue(undefined),
			updateTaskHistory: vi.fn().mockResolvedValue(undefined),
		}

		mockDelay = delay as ReturnType<typeof vi.fn>
		mockDelay.mockClear()
	})

	it("should enforce rate limiting across parent and subtask", async () => {
		const getStateSpy = vi.spyOn(mockProvider, "getState")

		const parent = new Task({
			provider: mockProvider,
			apiConfiguration: mockApiConfig,
			task: "parent task",
			startTask: false,
		})

		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield { type: "text", text: "parent response" }
			},
			async next() {
				return { done: true, value: { type: "text", text: "parent response" } }
			},
			async return() {
				return { done: true, value: undefined }
			},
			async throw(e: any) {
				throw e
			},
			[Symbol.asyncDispose]: async () => {},
		} as AsyncGenerator<ApiStreamChunk>

		vi.spyOn(parent.api, "createMessage").mockReturnValue(mockStream)

		const parentIterator = parent.attemptApiRequest()
		await parentIterator.next()

		expect(mockDelay).not.toHaveBeenCalled()

		const child = new Task({
			provider: mockProvider,
			apiConfiguration: mockApiConfig,
			task: "child task",
			parentTask: parent,
			rootTask: parent,
			startTask: false,
		})

		const childMockStream = {
			async *[Symbol.asyncIterator]() {
				yield { type: "text", text: "child response" }
			},
			async next() {
				return { done: true, value: { type: "text", text: "child response" } }
			},
			async return() {
				return { done: true, value: undefined }
			},
			async throw(e: any) {
				throw e
			},
			[Symbol.asyncDispose]: async () => {},
		} as AsyncGenerator<ApiStreamChunk>

		vi.spyOn(child.api, "createMessage").mockReturnValue(childMockStream)

		const childIterator = child.attemptApiRequest()
		await childIterator.next()

		expect(mockDelay).toHaveBeenCalledTimes(mockApiConfig.rateLimitSeconds)
		expect(mockDelay).toHaveBeenCalledWith(1000)
	}, 10000)

	it("should not apply rate limiting if enough time has passed", async () => {
		const parent = new Task({
			provider: mockProvider,
			apiConfiguration: mockApiConfig,
			task: "parent task",
			startTask: false,
		})

		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield { type: "text", text: "response" }
			},
			async next() {
				return { done: true, value: { type: "text", text: "response" } }
			},
			async return() {
				return { done: true, value: undefined }
			},
			async throw(e: any) {
				throw e
			},
			[Symbol.asyncDispose]: async () => {},
		} as AsyncGenerator<ApiStreamChunk>

		vi.spyOn(parent.api, "createMessage").mockReturnValue(mockStream)

		const parentIterator = parent.attemptApiRequest()
		await parentIterator.next()

		const originalPerformanceNow = performance.now
		const mockTime = performance.now() + (mockApiConfig.rateLimitSeconds + 1) * 1000
		performance.now = vi.fn(() => mockTime)

		const child = new Task({
			provider: mockProvider,
			apiConfiguration: mockApiConfig,
			task: "child task",
			parentTask: parent,
			rootTask: parent,
			startTask: false,
		})

		vi.spyOn(child.api, "createMessage").mockReturnValue(mockStream)

		const childIterator = child.attemptApiRequest()
		await childIterator.next()

		expect(mockDelay).not.toHaveBeenCalled()

		performance.now = originalPerformanceNow
	})

	it("should share rate limiting across multiple subtasks", async () => {
		const parent = new Task({
			provider: mockProvider,
			apiConfiguration: mockApiConfig,
			task: "parent task",
			startTask: false,
		})

		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield { type: "text", text: "response" }
			},
			async next() {
				return { done: true, value: { type: "text", text: "response" } }
			},
			async return() {
				return { done: true, value: undefined }
			},
			async throw(e: any) {
				throw e
			},
			[Symbol.asyncDispose]: async () => {},
		} as AsyncGenerator<ApiStreamChunk>

		vi.spyOn(parent.api, "createMessage").mockReturnValue(mockStream)

		const parentIterator = parent.attemptApiRequest()
		await parentIterator.next()

		const child1 = new Task({
			provider: mockProvider,
			apiConfiguration: mockApiConfig,
			task: "child task 1",
			parentTask: parent,
			rootTask: parent,
			startTask: false,
		})

		vi.spyOn(child1.api, "createMessage").mockReturnValue(mockStream)

		const child1Iterator = child1.attemptApiRequest()
		await child1Iterator.next()

		const firstDelayCount = mockDelay.mock.calls.length
		expect(firstDelayCount).toBe(mockApiConfig.rateLimitSeconds)

		mockDelay.mockClear()

		const child2 = new Task({
			provider: mockProvider,
			apiConfiguration: mockApiConfig,
			task: "child task 2",
			parentTask: parent,
			rootTask: parent,
			startTask: false,
		})

		vi.spyOn(child2.api, "createMessage").mockReturnValue(mockStream)

		const child2Iterator = child2.attemptApiRequest()
		await child2Iterator.next()

		expect(mockDelay).toHaveBeenCalledTimes(mockApiConfig.rateLimitSeconds)
	}, 15000)

	it("should handle rate limiting with zero rate limit", async () => {
		mockApiConfig.rateLimitSeconds = 0
		mockProvider.getState.mockResolvedValue({
			apiConfiguration: mockApiConfig,
		})

		const parent = new Task({
			provider: mockProvider,
			apiConfiguration: mockApiConfig,
			task: "parent task",
			startTask: false,
		})

		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield { type: "text", text: "response" }
			},
			async next() {
				return { done: true, value: { type: "text", text: "response" } }
			},
			async return() {
				return { done: true, value: undefined }
			},
			async throw(e: any) {
				throw e
			},
			[Symbol.asyncDispose]: async () => {},
		} as AsyncGenerator<ApiStreamChunk>

		vi.spyOn(parent.api, "createMessage").mockReturnValue(mockStream)

		const parentIterator = parent.attemptApiRequest()
		await parentIterator.next()

		const child = new Task({
			provider: mockProvider,
			apiConfiguration: mockApiConfig,
			task: "child task",
			parentTask: parent,
			rootTask: parent,
			startTask: false,
		})

		vi.spyOn(child.api, "createMessage").mockReturnValue(mockStream)

		const childIterator = child.attemptApiRequest()
		await childIterator.next()

		expect(mockDelay).not.toHaveBeenCalled()
	})

	it("should update global timestamp even when no rate limiting is needed", async () => {
		const task = new Task({
			provider: mockProvider,
			apiConfiguration: mockApiConfig,
			task: "test task",
			startTask: false,
		})

		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield { type: "text", text: "response" }
			},
			async next() {
				return { done: true, value: { type: "text", text: "response" } }
			},
			async return() {
				return { done: true, value: undefined }
			},
			async throw(e: any) {
				throw e
			},
			[Symbol.asyncDispose]: async () => {},
		} as AsyncGenerator<ApiStreamChunk>

		vi.spyOn(task.api, "createMessage").mockReturnValue(mockStream)

		const iterator = task.attemptApiRequest()
		await iterator.next()

		const globalTimestamp = (Task as any).lastGlobalApiRequestTime
		expect(globalTimestamp).toBeDefined()
		expect(globalTimestamp).toBeGreaterThan(0)
	})
})
