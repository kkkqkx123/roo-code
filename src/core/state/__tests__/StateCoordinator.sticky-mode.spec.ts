// npx vitest core/state/__tests__/StateCoordinator.sticky-mode.spec.ts

import * as vscode from "vscode"
import { ClineProvider } from "../../webview/ClineProvider"
import { ContextProxy } from "../../config/ContextProxy"
import { Task } from "../../task/Task"
import type { HistoryItem, ProviderName } from "@shared/types"

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
	extensions: {
		getExtension: vi.fn().mockReturnValue({
			packageJSON: {
				version: "2.0.0",
			},
		}),
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
		getBrowserSession: vi.fn().mockReturnValue({
			isSessionActive: vi.fn().mockReturnValue(false),
		}),
		_taskMode: options.taskMode || "code",
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
		{
			slug: "debug",
			name: "Debug Mode",
			roleDefinition: "You are a debugger",
			groups: ["read", "edit", "browser"],
		},
	],
	getModeBySlug: vi.fn().mockImplementation((slug: string) => {
		const modes = [
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
				slug: "debug",
				name: "Debug Mode",
				roleDefinition: "You are a debugger",
				groups: ["read", "edit", "browser"],
			},
		]
		return modes.find((m) => m.slug === slug)
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

vi.mock("../StateCoordinator", () => ({
	StateCoordinator: vi.fn().mockImplementation(() => ({
		updateTaskHistory: vi.fn().mockImplementation((item) => {
			return Promise.resolve([item])
		}),
		getStateToPostToWebview: vi.fn().mockResolvedValue({
			mode: "code",
			currentApiConfigName: "test-config",
		}),
		getState: vi.fn().mockResolvedValue({
			mode: "code",
			currentApiConfigName: "test-config",
		}),
		setValue: vi.fn().mockResolvedValue(undefined),
		setValues: vi.fn().mockResolvedValue(undefined),
		resetState: vi.fn().mockResolvedValue(undefined),
		updateApiConfiguration: vi.fn().mockResolvedValue(undefined),
		updateGlobalState: vi.fn().mockResolvedValue(undefined),
		setTaskManager: vi.fn().mockResolvedValue(undefined),
		applyTerminalSettings: vi.fn().mockResolvedValue(undefined),
	})),
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

		// Add missing methods that are being spied on in tests
		;(provider as any).getGlobalState = vi.fn()
		;(provider as any).updateGlobalState = vi.fn().mockResolvedValue(undefined)

		provider.getMcpHub = vi.fn().mockReturnValue({
			listTools: vi.fn().mockResolvedValue([]),
			callTool: vi.fn().mockResolvedValue({ content: [] }),
			listResources: vi.fn().mockResolvedValue([]),
			readResource: vi.fn().mockResolvedValue({ contents: [] }),
			getAllServers: vi.fn().mockReturnValue([]),
		})

		// Mock the context proxy to return task history and properly handle setValue
		const mockContextProxy = {
			getValues: vi.fn().mockReturnValue({
				taskHistory: [],
				mode: "code",
				currentApiConfigName: "test-config",
			}),
			setValue: vi.fn().mockImplementation(async (key: string, value: any) => {
				if (key === "mode") {
					await mockContext.globalState.update("mode", value)
				} else if (key === "listApiConfigMeta") {
					await mockContext.globalState.update("listApiConfigMeta", value)
				}
			}),
			setValues: vi.fn().mockResolvedValue(undefined),
		}
		;(provider as any).contextProxy = mockContextProxy



		// Mock task manager methods - create a proper task stack
		const taskStack: any[] = []
		;(provider as any).taskManager = {
			getCurrentTask: vi.fn().mockImplementation(() => taskStack[taskStack.length - 1]),
			addClineToStack: vi.fn().mockImplementation((task) => {
				taskStack.push(task)
			}),
			removeClineFromStack: vi.fn().mockImplementation(() => {
				return taskStack.pop()
			}),
			createTaskWithHistoryItem: vi.fn().mockImplementation((historyItem) => {
				return Promise.resolve(new Task({
					provider,
					apiConfiguration: { apiProvider: "anthropic" },
				}))
			}),
		}
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

			// Set up task history in global state
			const taskHistory = [
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
			]
			
			// Update the global state to include task history
			;(provider as any).getGlobalState.mockImplementation((key: string) => {
				if (key === "taskHistory") {
					return taskHistory
				}
				return undefined
			})

			// Mock task manager to return our task as current task
			;(provider as any).taskManager.getCurrentTask.mockReturnValue(mockTask)

			// Mock context proxy to return the task history
			;(provider as any).contextProxy.getValues.mockReturnValue({
				taskHistory: taskHistory,
				mode: "code",
				currentApiConfigName: "test-config",
			})

			const updateTaskHistorySpy = vi.spyOn(provider.stateCoordinator, "updateTaskHistory")

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
				getBrowserSession: vi.fn().mockReturnValue({
					isSessionActive: vi.fn().mockReturnValue(false),
				}),
			}

			// Mock task manager to return our task as current task
			;(provider as any).taskManager.getCurrentTask.mockReturnValue(mockTask)

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

			const updateTaskHistorySpy = vi.spyOn(provider.stateCoordinator, "updateTaskHistory")

			await provider.handleModeSwitch("architect")

			// The _taskMode property should be set by handleModeSwitch
			expect((mockTask as any)._taskMode).toBe("architect")

			expect(mockTask.emit).toHaveBeenCalledWith("taskModeSwitched", mockTask.taskId, "architect")
		})

		it("should update task history with new mode when active task exists", async () => {
			const mockTask = new Task({
				provider,
				apiConfiguration: { apiProvider: "anthropic" },
			})

			const taskId = (mockTask as any).taskId || "test-task-id"

			// Set up task history in global state
			const taskHistory = [
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
			]
			
			// Update the global state to include task history
			;(provider as any).getGlobalState.mockImplementation((key: string) => {
				if (key === "taskHistory") {
					return taskHistory
				}
				return undefined
			})

			// Mock task manager to return our task as current task
			;(provider as any).taskManager.getCurrentTask.mockReturnValue(mockTask)

			// Mock context proxy to return the task history
			;(provider as any).contextProxy.getValues.mockReturnValue({
				taskHistory: taskHistory,
				mode: "code",
				currentApiConfigName: "test-config",
			})

			const updateTaskHistorySpy = vi.spyOn((provider as any).stateCoordinator, "updateTaskHistory")

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

			await provider.createTaskWithHistoryItem(historyItem)

			// Check that mode was updated to architect at some point
			expect(mockContext.globalState.update).toHaveBeenCalledWith("mode", "architect")
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

			// Set up task history in global state
			const taskHistory = [
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
			]
			
			// Update the global state to include task history
			;(provider as any).getGlobalState.mockImplementation((key: string) => {
				if (key === "taskHistory") {
					return taskHistory
				}
				return undefined
			})

			// Mock context proxy to return the task history
			;(provider as any).contextProxy.getValues.mockReturnValue({
				taskHistory: taskHistory,
				mode: "debug",
				currentApiConfigName: "test-config",
			})

			let updatedHistoryItem: any
			const updateTaskHistorySpy = vi.spyOn(provider.stateCoordinator, "updateTaskHistory").mockImplementation((item) => {
				updatedHistoryItem = item
				return Promise.resolve([item])
			})

			// Mock task manager to return our task as current task
			;(provider as any).taskManager.getCurrentTask.mockReturnValue(mockTask)

			await provider.addClineToStack(mockTask)

			await provider.handleModeSwitch("debug")

			expect(updateTaskHistorySpy).toHaveBeenCalled()
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

			// Set up task history in global state
			const taskHistory = Object.entries(taskModes).map(([id, mode]) => ({
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
			
			// Update the global state to include task history
			;(provider as any).getGlobalState.mockImplementation((key: string) => {
				if (key === "taskHistory") {
					return taskHistory
				}
				return []
			})

			// Mock context proxy to return the task history
			;(provider as any).contextProxy.getValues.mockReturnValue({
				taskHistory: taskHistory,
				mode: "architect",
				currentApiConfigName: "test-config",
			})

			const updateTaskHistoryMock = vi.spyOn(provider.stateCoordinator, "updateTaskHistory")
			updateTaskHistoryMock.mockImplementation((item) => {
				if (item.id && item.mode !== undefined) {
					taskModes[item.id] = item.mode
				}
				return Promise.resolve([item])
			})

			await provider.addClineToStack(parentTask)

			const subtask = new Task({
				provider,
				apiConfiguration: { apiProvider: "anthropic" },
				parentTask: parentTask,
			})
			const subtaskId = (subtask as any).taskId || "subtask-id"

			// Add subtask to task history initially
			taskHistory.push({
				id: subtaskId,
				ts: Date.now(),
				task: `Task ${subtaskId}`,
				number: 1,
				tokensIn: 0,
				tokensOut: 0,
				cacheWrites: 0,
				cacheReads: 0,
				totalCost: 0,
				mode: "architect", // Initially inherits parent mode
			})
			taskModes[subtaskId] = "architect"

			// Mock task manager to return current task correctly
			const getCurrentTaskMock = vi.spyOn(provider, "getCurrentTask")
			getCurrentTaskMock.mockReturnValue(parentTask as any)

			await provider.addClineToStack(subtask)

			// Switch to code mode - this should update the current task (subtask) to code mode
			getCurrentTaskMock.mockReturnValue(subtask as any)
			await provider.handleModeSwitch("code")

			// Only the current task (subtask) should be in code mode after the switch
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
			// Create a reactive mock for contextProxy.getValues that updates mode when setValue is called
			let currentMode = "code"
			const taskHistory = [{
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
			}]
			
			;(provider as any).contextProxy.getValues.mockReturnValue({
				taskHistory: taskHistory,
				get mode() { return currentMode },
				currentApiConfigName: "test-config",
			})

			// Update setValue mock to track mode changes
			;(provider as any).contextProxy.setValue.mockImplementation(async (key: string, value: any) => {
				if (key === "mode") {
					currentMode = value
					await mockContext.globalState.update("mode", value)
				} else if (key === "listApiConfigMeta") {
					await mockContext.globalState.update("listApiConfigMeta", value)
				}
			})

			// Make StateCoordinator.getState() reactive to mode changes
			;(provider as any).stateCoordinator.getState.mockImplementation(async () => {
				return {
					mode: currentMode,
					currentApiConfigName: "test-config",
				}
			})

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
