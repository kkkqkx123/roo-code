// npx vitest core/state/__tests__/StateCoordinator.sticky-mode.spec.ts

import * as vscode from "vscode"
import { ClineProvider } from "../../webview/ClineProvider"
import { ContextProxy } from "../../config/ContextProxy"
import { Task } from "../../task/Task"
import type { HistoryItem, ProviderName } from "@roo-code/types"

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
}))

let taskIdCounter = 0

vi.mock("../../task/Task", () => ({
	Task: vi.fn().mockImplementation((options) => ({
		taskId: options.taskId || `test-task-id-${++taskIdCounter}`,
		saveClineMessages: vi.fn(),
		clineMessages: [],
		apiConversationHistory: [],
		overwriteClineMessages: vi.fn(),
		overwriteApiConversationHistory: vi.fn(),
		abortTask: vi.fn(),
		handleWebviewAskResponse: vi.fn(),
		getTaskNumber: vi.fn().mockReturnValue(0),
		setTaskNumber: vi.fn(),
		setParentTask: vi.fn(),
		setRootTask: vi.fn(),
		emit: vi.fn(),
		parentTask: options.parentTask,
		updateApiConfiguration: vi.fn(),
	})),
}))

vi.mock("../../prompts/sections/custom-instructions")

vi.mock("../../../utils/safeWriteJson")

vi.mock("../../../api", () => ({
	buildApiHandler: vi.fn().mockReturnValue({
		getModel: vi.fn().mockReturnValue({
			id: "claude-3-sonnet",
		}),
	}),
}))

vi.mock("../../../integrations/workspace/WorkspaceTracker", () => ({
	default: vi.fn().mockImplementation(() => ({
		initializeFilePaths: vi.fn(),
		dispose: vi.fn(),
	})),
}))

vi.mock("../../diff/strategies/multi-search-replace", () => ({
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

vi.mock("../../../shared/modes", () => ({
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
	],
	getModeBySlug: vi.fn().mockReturnValue({
		slug: "code",
		name: "Code Mode",
		roleDefinition: "You are a code assistant",
		groups: ["read", "edit", "browser"],
	}),
	defaultModeSlug: "code",
}))

vi.mock("../../prompts/system", () => ({
	SYSTEM_PROMPT: vi.fn().mockResolvedValue("mocked system prompt"),
	codeMode: "code",
}))

vi.mock("../../../api/providers/fetchers/modelCache", () => ({
	getModels: vi.fn().mockResolvedValue({}),
	flushModels: vi.fn(),
	getModelsFromCache: vi.fn().mockReturnValue(undefined),
}))

vi.mock("../../../integrations/misc/extract-text", () => ({
	extractTextFromFile: vi.fn().mockResolvedValue("Mock file content"),
}))

vi.mock("p-wait-for", () => ({
	default: vi.fn().mockImplementation(async () => Promise.resolve()),
}))

vi.mock("fs/promises", () => ({
	mkdir: vi.fn().mockResolvedValue(undefined),
	writeFile: vi.fn().mockResolvedValue(undefined),
	readFile: vi.fn().mockResolvedValue(""),
	unlink: vi.fn().mockResolvedValue(undefined),
	rmdir: vi.fn().mockResolvedValue(undefined),
}))

describe("StateCoordinator - Sticky Mode", () => {
	let provider: ClineProvider
	let mockContext: vscode.ExtensionContext
	let mockOutputChannel: vscode.OutputChannel
	let mockWebviewView: vscode.WebviewView
	let mockPostMessage: any

	beforeEach(() => {
		vi.clearAllMocks()

		const globalState: Record<string, string | undefined> = {
			mode: "code",
			currentApiConfigName: "test-config",
		}

		const secrets: Record<string, string | undefined> = {}

		mockContext = {
			extensionPath: "/test/path",
			extensionUri: {} as vscode.Uri,
			globalState: {
				get: vi.fn().mockImplementation((key: string) => globalState[key]),
				update: vi.fn().mockImplementation((key: string, value: string | undefined) => {
					globalState[key] = value
					return Promise.resolve()
				}),
				keys: vi.fn().mockImplementation(() => Object.keys(globalState)),
			},
			secrets: {
				get: vi.fn().mockImplementation((key: string) => secrets[key]),
				store: vi.fn().mockImplementation((key: string, value: string | undefined) => {
					secrets[key] = value
					return Promise.resolve()
				}),
				delete: vi.fn().mockImplementation((key: string) => {
					delete secrets[key]
					return Promise.resolve()
				}),
			},
			subscriptions: [],
			extension: {
				packageJSON: { version: "1.0.0" },
			},
			globalStorageUri: {
				fsPath: "/test/storage/path",
			},
		} as unknown as vscode.ExtensionContext

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

		provider.getMcpHub = vi.fn().mockReturnValue({
			listTools: vi.fn().mockResolvedValue([]),
			callTool: vi.fn().mockResolvedValue({ content: [] }),
			listResources: vi.fn().mockResolvedValue([]),
			readResource: vi.fn().mockResolvedValue({ contents: [] }),
			getAllServers: vi.fn().mockReturnValue([]),
		})
	})

	describe("handleModeSwitch", () => {
		beforeEach(async () => {
			await provider.resolveWebviewView(mockWebviewView)
		})

		it("should save mode to task metadata when switching modes", async () => {
			const mockTask = new Task({
				provider,
				apiConfiguration: { apiProvider: "anthropic" },
			})

			const taskId = (mockTask as any).taskId || "test-task-id"

			vi.spyOn(provider as any, "getGlobalState").mockReturnValue([
				{
					id: taskId,
					ts: Date.now(),
					task: "Test task",
					number: 1,
					tokensIn: 0,
					tokensOut: 0,
					cacheWrites: 0,
					cacheReads: 0,
					totalCost: 0,
				},
			])

			const updateTaskHistorySpy = vi.spyOn(provider, "updateTaskHistory").mockImplementation(() => Promise.resolve([]))

			await provider.addClineToStack(mockTask)

			await provider.handleModeSwitch("architect")

			expect(mockContext.globalState.update).toHaveBeenCalledWith("mode", "architect")

			expect(updateTaskHistorySpy).toHaveBeenCalledWith(
				expect.objectContaining({
					id: taskId,
					mode: "architect",
				}),
			)
		})

		it("should update task's taskMode property when switching modes", async () => {
			const mockTask = {
				taskId: "test-task-id",
				taskMode: "code",
				emit: vi.fn(),
				saveClineMessages: vi.fn(),
				clineMessages: [],
				apiConversationHistory: [],
				updateApiConfiguration: vi.fn(),
			}

			await provider.addClineToStack(mockTask as any)

			vi.spyOn(provider as any, "getGlobalState").mockReturnValue([
				{
					id: mockTask.taskId,
					ts: Date.now(),
					task: "Test task",
					number: 1,
					tokensIn: 0,
					tokensOut: 0,
					cacheWrites: 0,
					cacheReads: 0,
					totalCost: 0,
				},
			])

			vi.spyOn(provider, "updateTaskHistory").mockImplementation(() => Promise.resolve([]))

			await provider.handleModeSwitch("architect")

			expect((mockTask as any)._taskMode).toBe("architect")

			expect(mockTask.emit).toHaveBeenCalledWith("taskModeSwitched", mockTask.taskId, "architect")
		})

		it("should update task history with new mode when active task exists", async () => {
			const mockTask = new Task({
				provider,
				apiConfiguration: { apiProvider: "anthropic" },
			})

			const taskId = (mockTask as any).taskId || "test-task-id"

			vi.spyOn(provider as any, "getGlobalState").mockReturnValue([
				{
					id: taskId,
					ts: Date.now(),
					task: "Test task",
					number: 1,
					tokensIn: 0,
					tokensOut: 0,
					cacheWrites: 0,
					cacheReads: 0,
					totalCost: 0,
				},
			])

			const updateTaskHistorySpy = vi.spyOn(provider, "updateTaskHistory").mockImplementation(() => Promise.resolve([]))

			await provider.addClineToStack(mockTask)

			await provider.handleModeSwitch("architect")

			expect(updateTaskHistorySpy).toHaveBeenCalledWith(
				expect.objectContaining({
					id: taskId,
					mode: "architect",
				}),
			)
		})
	})

	describe("createTaskWithHistoryItem", () => {
		it("should restore mode from history item when reopening task", async () => {
			await provider.resolveWebviewView(mockWebviewView)

			const historyItem: HistoryItem = {
				id: "test-task-id",
				number: 1,
				ts: Date.now(),
				task: "Test task",
				tokensIn: 100,
				tokensOut: 200,
				cacheWrites: 0,
				cacheReads: 0,
				totalCost: 0.001,
				mode: "architect",
			}

			const updateGlobalStateSpy = vi.spyOn(provider as any, "updateGlobalState").mockResolvedValue(undefined)

			await provider.createTaskWithHistoryItem(historyItem)

			expect(updateGlobalStateSpy).toHaveBeenCalledWith("mode", "architect")
		})

		it("should use current mode if history item has no saved mode", async () => {
			await provider.resolveWebviewView(mockWebviewView)

			mockContext.globalState.get = vi.fn().mockImplementation((key: string) => {
				if (key === "mode") return "code"
				return undefined
			})

			const historyItem: HistoryItem = {
				id: "test-task-id",
				number: 1,
				ts: Date.now(),
				task: "Test task",
				tokensIn: 100,
				tokensOut: 200,
				cacheWrites: 0,
				cacheReads: 0,
				totalCost: 0.001,
			}

			vi.spyOn(provider, "getTaskWithId").mockResolvedValue({
				task: undefined,
				historyItem,
			})

			const handleModeSwitchSpy = vi.spyOn(provider, "handleModeSwitch").mockResolvedValue()

			await provider.createTaskWithHistoryItem(historyItem)

			expect(handleModeSwitchSpy).not.toHaveBeenCalled()
		})
	})

	describe("Task metadata persistence", () => {
		it("should include mode in task metadata when creating history items", async () => {
			await provider.resolveWebviewView(mockWebviewView)

			await provider.setValue("mode", "debug")

			const mockTask = new Task({
				provider,
				apiConfiguration: { apiProvider: "anthropic" },
			})

			const taskId = (mockTask as any).taskId || "test-task-id"

			vi.spyOn(provider as any, "getGlobalState").mockReturnValue([
				{
					id: taskId,
					ts: Date.now(),
					task: "Test task",
					number: 1,
					tokensIn: 0,
					tokensOut: 0,
					cacheWrites: 0,
					cacheReads: 0,
					totalCost: 0,
				},
			])

			let updatedHistoryItem: any
			vi.spyOn(provider, "updateTaskHistory").mockImplementation((item) => {
				updatedHistoryItem = item
				return Promise.resolve([item])
			})

			await provider.addClineToStack(mockTask)

			await provider.handleModeSwitch("debug")

			expect(updatedHistoryItem).toBeDefined()
			expect(updatedHistoryItem.mode).toBe("debug")
		})
	})

	describe("Integration with new_task tool", () => {
		it("should preserve parent task mode when creating subtasks", async () => {
			await provider.resolveWebviewView(mockWebviewView)

			await provider.setValue("mode", "architect")

			const parentTask = new Task({
				provider,
				apiConfiguration: { apiProvider: "anthropic" },
			})

			const parentTaskId = (parentTask as any).taskId || "parent-task-id"

			const taskModes: Record<string, string> = {
				[parentTaskId]: "architect",
			}

			const getGlobalStateMock = vi.spyOn(provider as any, "getGlobalState")
			getGlobalStateMock.mockImplementation((key) => {
				if (key === "taskHistory") {
					return Object.entries(taskModes).map(([id, mode]) => ({
						id,
						ts: Date.now(),
						task: `Task ${id}`,
						number: 1,
						tokensIn: 0,
						tokensOut: 0,
						cacheWrites: 0,
						cacheReads: 0,
						totalCost: 0,
						mode,
					}))
				}
				return []
			})

			const updateTaskHistoryMock = vi.spyOn(provider, "updateTaskHistory")
			updateTaskHistoryMock.mockImplementation((item) => {
				if (item.id && item.mode !== undefined) {
					taskModes[item.id] = item.mode
				}
				return Promise.resolve([])
			})

			await provider.addClineToStack(parentTask)

			const subtask = new Task({
				provider,
				apiConfiguration: { apiProvider: "anthropic" },
				parentTask: parentTask,
			})
			const subtaskId = (subtask as any).taskId || "subtask-id"

			taskModes[subtaskId] = "architect"

			const getCurrentTaskMock = vi.spyOn(provider, "getCurrentTask")
			getCurrentTaskMock.mockReturnValue(parentTask as any)

			await provider.addClineToStack(subtask)

			getCurrentTaskMock.mockReturnValue(subtask as any)

			await provider.handleModeSwitch("code")

			expect(taskModes[parentTaskId]).toBe("architect")

			expect(taskModes[subtaskId]).toBe("code")
		})
	})

	describe("Error handling", () => {
		it("should handle errors gracefully when saving mode fails", async () => {
			await provider.resolveWebviewView(mockWebviewView)

			const mockTask = new Task({
				provider,
				apiConfiguration: { apiProvider: "anthropic" },
			})
			vi.spyOn(mockTask as any, "saveClineMessages").mockRejectedValue(new Error("Save failed"))

			await provider.addClineToStack(mockTask)

			await expect(provider.handleModeSwitch("architect")).resolves.not.toThrow()

			expect(mockContext.globalState.update).toHaveBeenCalledWith("mode", "architect")
		})

		it("should handle null/undefined mode gracefully", async () => {
			await provider.resolveWebviewView(mockWebviewView)

			const historyItem: HistoryItem = {
				id: "test-task-id",
				number: 1,
				ts: Date.now(),
				task: "Test task",
				tokensIn: 100,
				tokensOut: 200,
				cacheWrites: 0,
				cacheReads: 0,
				totalCost: 0.001,
				mode: null as any,
			}

			vi.spyOn(provider, "getTaskWithId").mockResolvedValue({
				task: undefined,
				historyItem,
			})

			const handleModeSwitchSpy = vi.spyOn(provider, "handleModeSwitch").mockResolvedValue()

			await expect(provider.createTaskWithHistoryItem(historyItem)).resolves.not.toThrow()

			expect(handleModeSwitchSpy).not.toHaveBeenCalledWith(null)
		})

		it("should restore API configuration when restoring task from history with mode", async () => {
			const codeApiConfig = { apiProvider: "anthropic" as ProviderName, anthropicApiKey: "code-key" }
			const architectApiConfig = { apiProvider: "openai" as ProviderName, openAiApiKey: "architect-key" }

			await provider.upsertProviderProfile("code-config", codeApiConfig)
			await provider.upsertProviderProfile("architect-config", architectApiConfig)

			const codeConfigId = provider.getProviderProfileEntry("code-config")?.id
			const architectConfigId = provider.getProviderProfileEntry("architect-config")?.id

			await provider.providerSettingsManager.setModeConfig("code", codeConfigId!)
			await provider.providerSettingsManager.setModeConfig("architect", architectConfigId!)

			await provider.handleModeSwitch("code")

			const historyItem: HistoryItem = {
				id: "test-task-id",
				number: 1,
				ts: Date.now(),
				task: "Test task",
				tokensIn: 100,
				tokensOut: 200,
				cacheWrites: 0,
				cacheReads: 0,
				totalCost: 0.001,
				mode: "architect",
			}

			await provider.createTaskWithHistoryItem(historyItem)

			const state = await provider.getState()
			expect(state.mode).toBe("architect")
		})
	})
})
