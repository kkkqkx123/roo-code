import { beforeEach, describe, expect, it, vi } from "vitest"
import * as vscode from "vscode"

import { TaskManager } from "../TaskManager"
import { Task } from "../Task"
import type { ProviderSettings, HistoryItem } from "@roo-code/types"

vi.mock("vscode", () => {
	const mockDisposable = { dispose: vi.fn() }
	return {
		workspace: {
			getConfiguration: vi.fn(() => ({
				get: vi.fn().mockReturnValue([]),
				update: vi.fn().mockResolvedValue(undefined),
			})),
			workspaceFolders: [],
			onDidChangeConfiguration: vi.fn(() => mockDisposable),
		},
		env: {
			uriScheme: "vscode",
			language: "en",
		},
		EventEmitter: vi.fn().mockImplementation(() => ({
			event: vi.fn(),
			fire: vi.fn(),
		})),
		Disposable: {
			from: vi.fn(),
		},
		window: {
			showErrorMessage: vi.fn(),
			createTextEditorDecorationType: vi.fn().mockReturnValue({
				dispose: vi.fn(),
			}),
			onDidChangeActiveTextEditor: vi.fn(() => mockDisposable),
		},
		Uri: {
			file: vi.fn().mockReturnValue({ toString: () => "file://test" }),
		},
	}
})

vi.mock("../Task")
vi.mock("../../../services/mcp/McpServerManager", () => ({
	McpServerManager: {
		getInstance: vi.fn().mockResolvedValue({
			registerClient: vi.fn(),
		}),
		unregisterProvider: vi.fn(),
	},
}))
vi.mock("../../../services/marketplace")
vi.mock("../../../integrations/workspace/WorkspaceTracker")
vi.mock("../../config/ProviderSettingsManager")
vi.mock("../../config/CustomModesManager")
vi.mock("../../../utils/path", () => ({
	getWorkspacePath: vi.fn().mockReturnValue("/test/workspace"),
}))

vi.mock("@roo-code/cloud", () => ({
	CloudService: {
		hasInstance: vi.fn().mockReturnValue(false),
		instance: {
			isAuthenticated: vi.fn().mockReturnValue(false),
		},
	},
	BridgeOrchestrator: {
		isEnabled: vi.fn().mockReturnValue(false),
	},
	getRooCodeApiUrl: vi.fn().mockReturnValue("https://api.roo-code.com"),
}))

vi.mock("../../../shared/embeddingModels", () => ({
	EMBEDDING_MODEL_PROFILES: [],
}))

describe("TaskManager flicker-free cancel", () => {
	let taskManager: TaskManager
	let mockTask1: any
	let mockTask2: any
	let mockTask3: any
	let mockProvider: any
	let taskCreationCallback: any

	const mockApiConfig: ProviderSettings = {
		apiProvider: "anthropic",
		apiKey: "test-key",
	} as ProviderSettings

	beforeEach(() => {
		vi.clearAllMocks()

		taskCreationCallback = vi.fn()

		mockProvider = {
			getState: vi.fn().mockResolvedValue({
				apiConfiguration: mockApiConfig,
				mode: "code",
				diffEnabled: true,
				enableCheckpoints: true,
				checkpointTimeout: 30000,
				fuzzyMatchThreshold: 0.8,
				experiments: {},
				taskSyncEnabled: false,
			}),
			getApiConfiguration: vi.fn().mockResolvedValue(mockApiConfig),
		}

		taskManager = new TaskManager(
			taskCreationCallback,
			mockProvider,
			() => Promise.resolve(mockApiConfig),
			() => Promise.resolve({
				apiConfiguration: mockApiConfig,
				mode: "code",
				diffEnabled: true,
				enableCheckpoints: true,
				checkpointTimeout: 30000,
				fuzzyMatchThreshold: 0.8,
				experiments: {},
				taskSyncEnabled: false,
			}),
		)

		mockTask1 = {
			taskId: "task-1",
			instanceId: "instance-1",
			emit: vi.fn(),
			abortTask: vi.fn().mockResolvedValue(undefined),
			abandoned: false,
			dispose: vi.fn(),
			on: vi.fn(),
			off: vi.fn(),
			taskNumber: 1,
			metadata: {
				task: "test task",
			},
			rootTask: undefined,
			parentTask: undefined,
		}

		mockTask2 = {
			taskId: "task-1",
			instanceId: "instance-2",
			emit: vi.fn(),
			on: vi.fn(),
			off: vi.fn(),
			taskNumber: 1,
			metadata: {
				task: "test task",
			},
			rootTask: undefined,
			parentTask: undefined,
		}

		mockTask3 = {
			taskId: "parent-task",
			instanceId: "parent-instance",
			emit: vi.fn(),
			taskNumber: 2,
			metadata: {
				task: "parent task",
			},
			rootTask: undefined,
			parentTask: undefined,
		}

		vi.mocked(Task).mockImplementation(() => mockTask2 as any)
	})

	it("should not remove current task from stack when rehydrating same taskId", async () => {
		await taskManager.addClineToStack(mockTask1)
		taskManager.attachTaskEventListeners(mockTask1)

		const currentTask = taskManager.getCurrentTask()
		expect(currentTask).toBe(mockTask1)

		const historyItem: HistoryItem = {
			id: "task-1",
			number: 1,
			task: "test task",
			ts: Date.now(),
			tokensIn: 100,
			tokensOut: 200,
			totalCost: 0.001,
			workspace: "/test/workspace",
		}

		await taskManager.createTaskWithHistoryItem(historyItem)

		const newCurrentTask = taskManager.getCurrentTask()
		expect(newCurrentTask).toBe(mockTask2)
		expect(newCurrentTask?.taskId).toBe("task-1")
		expect(newCurrentTask?.instanceId).toBe("instance-2")

		expect(mockTask2.emit).toHaveBeenCalledWith("taskFocused")
	})

	it("should remove task from stack when creating different task", async () => {
		await taskManager.addClineToStack(mockTask1)

		const removeClineFromStackSpy = vi.spyOn(taskManager, "removeClineFromStack").mockResolvedValue(undefined)

		const historyItem: HistoryItem = {
			id: "task-2",
			number: 2,
			task: "different task",
			ts: Date.now(),
			tokensIn: 150,
			tokensOut: 250,
			totalCost: 0.002,
			workspace: "/test/workspace",
		}

		await taskManager.createTaskWithHistoryItem(historyItem)

		expect(removeClineFromStackSpy).toHaveBeenCalled()
	})

	it("should handle empty stack gracefully during rehydration attempt", async () => {
		const removeClineFromStackSpy = vi.spyOn(taskManager, "removeClineFromStack").mockResolvedValue(undefined)

		const historyItem: HistoryItem = {
			id: "task-1",
			number: 1,
			task: "test task",
			ts: Date.now(),
			tokensIn: 100,
			tokensOut: 200,
			totalCost: 0.001,
			workspace: "/test/workspace",
		}

		await taskManager.createTaskWithHistoryItem(historyItem)

		expect(removeClineFromStackSpy).toHaveBeenCalled()
	})

	it("should maintain task stack integrity during flicker-free replacement", async () => {
		await taskManager.addClineToStack(mockTask3)
		await taskManager.addClineToStack(mockTask1)
		taskManager.attachTaskEventListeners(mockTask1)

		expect(taskManager.getTaskStackSize()).toBe(2)

		const historyItem: HistoryItem = {
			id: "task-1",
			number: 1,
			task: "test task",
			ts: Date.now(),
			tokensIn: 100,
			tokensOut: 200,
			totalCost: 0.001,
			workspace: "/test/workspace",
		}

		await taskManager.createTaskWithHistoryItem(historyItem)

		expect(taskManager.getTaskStackSize()).toBe(2)

		const currentTask = taskManager.getCurrentTask()
		expect(currentTask).toBe(mockTask2)
		expect(currentTask?.taskId).toBe("task-1")
	})

	it("should properly clean up event listeners when removing task from stack", async () => {
		await taskManager.addClineToStack(mockTask1)
		taskManager.attachTaskEventListeners(mockTask1)

		expect(mockTask1.on).toHaveBeenCalled()

		await taskManager.removeClineFromStack()

		expect(mockTask1.abortTask).toHaveBeenCalledWith(true)
		expect(mockTask1.emit).toHaveBeenCalledWith("taskUnfocused")
		expect(taskManager.getTaskStackSize()).toBe(0)
	})

	it("should handle multiple tasks in stack correctly", async () => {
		await taskManager.addClineToStack(mockTask3)
		await taskManager.addClineToStack(mockTask1)

		expect(taskManager.getTaskStackSize()).toBe(2)
		expect(taskManager.getCurrentTask()).toBe(mockTask1)
		expect(taskManager.getCurrentTaskStack()).toEqual(["parent-task", "task-1"])

		await taskManager.removeClineFromStack()

		expect(taskManager.getTaskStackSize()).toBe(1)
		expect(taskManager.getCurrentTask()).toBe(mockTask3)
		expect(taskManager.getCurrentTaskStack()).toEqual(["parent-task"])
	})
})
