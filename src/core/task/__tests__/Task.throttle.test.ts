import { RooCodeEventName, ProviderSettings, TokenUsage, ToolUsage } from "@shared/types"

import { Task } from "../Task"
import { ClineProvider } from "../../webview/ClineProvider"
import { hasToolUsageChanged, hasTokenUsageChanged } from "../managers/monitoring/metrics-utils"

// Mock dependencies
vi.mock("../../webview/ClineProvider")
vi.mock("../../../integrations/terminal/TerminalRegistry", () => ({
	TerminalRegistry: {
		releaseTerminalsForTask: vi.fn(),
	},
}))
vi.mock("../../ignore/RooIgnoreController")
vi.mock("../../protect/RooProtectedController")
vi.mock("../../file-tracking/FileContextTracker")
vi.mock("../../../services/browser/UrlContentFetcher")
vi.mock("../../../services/browser/BrowserSession")
vi.mock("../../../integrations/editor/DiffViewProvider")
vi.mock("../../tools/ToolRepetitionDetector")
vi.mock("../../../api", () => ({
	buildApiHandler: vi.fn(() => ({
		getModel: () => ({ info: {}, id: "test-model" }),
	})),
}))

// Mock task persistence to avoid disk writes
vi.mock("../../task-persistence", () => ({
	readApiMessages: vi.fn().mockResolvedValue([]),
	saveApiMessages: vi.fn().mockResolvedValue(undefined),
	readTaskMessages: vi.fn().mockResolvedValue([]),
	saveTaskMessages: vi.fn().mockResolvedValue(undefined),
	taskMetadata: vi.fn(),
}))

describe("Task token usage throttling", () => {
	let mockProvider: any
	let mockApiConfiguration: ProviderSettings
	let task: Task
	let callCount = 0

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()
		vi.useFakeTimers()
		callCount = 0

		// Mock provider
		mockProvider = {
			context: {
				globalStorageUri: { fsPath: "/test/path" },
			},
			getState: vi.fn().mockResolvedValue({ mode: "code" }),
			log: vi.fn(),
			postStateToWebview: vi.fn().mockResolvedValue(undefined),
			updateTaskHistory: vi.fn().mockResolvedValue(undefined),
		}

		// Mock API configuration
		mockApiConfiguration = {
			apiProvider: "anthropic",
			apiKey: "test-key",
		} as ProviderSettings

		// Create task instance without starting it
		task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			startTask: false,
		})
	})

	afterEach(async () => {
		// Run all pending timers to clear them
		vi.runAllTimers()
		vi.runAllTicks()
		
		vi.restoreAllMocks()
		vi.useRealTimers()
		
		if (task) {
			try {
				await task.dispose()
			} catch (error) {
			}
		}
		
		// Force garbage collection if available
		if (global.gc) {
			global.gc()
		}
	})

	test("should emit TaskTokenUsageUpdated immediately on first change", async () => {
		const emitSpy = vi.spyOn(task, "emit")

		// Set initial token usage - should emit immediately
		task.tokenUsage = {
			totalTokensIn: 100,
			totalTokensOut: 50,
			totalCost: 0.001,
			contextTokens: 10,
		}

		// Wait for debounce to execute
		vi.advanceTimersByTime(100)

		const emitCount = emitSpy.mock.calls.filter(
			(call) => call[0] === RooCodeEventName.TaskTokenUsageUpdated,
		).length

		// Should have emitted at least once
		expect(emitCount).toBeGreaterThan(0)
	})

	test("should throttle subsequent emissions within 2 seconds", async () => {
		const emitSpy = vi.spyOn(task, "emit")

		// First token usage change - should emit
		task.tokenUsage = {
			totalTokensIn: 100,
			totalTokensOut: 50,
			totalCost: 0.001,
			contextTokens: 10,
		}

		// Wait for debounce to execute
		vi.advanceTimersByTime(100)

		const firstEmitCount = emitSpy.mock.calls.filter(
			(call) => call[0] === RooCodeEventName.TaskTokenUsageUpdated,
		).length

		// Second token usage change immediately after - should NOT emit due to throttle
		vi.advanceTimersByTime(500) // Advance only 500ms
		task.tokenUsage = {
			totalTokensIn: 200,
			totalTokensOut: 100,
			totalCost: 0.002,
			contextTokens: 20,
		}

		// Wait for debounce to execute
		vi.advanceTimersByTime(100)

		const secondEmitCount = emitSpy.mock.calls.filter(
			(call) => call[0] === RooCodeEventName.TaskTokenUsageUpdated,
		).length

		// Should still be the same count (throttled)
		expect(secondEmitCount).toBe(firstEmitCount)

		// Third token usage change after 2+ seconds - should emit
		vi.advanceTimersByTime(1600) // Total time: 2100ms
		task.tokenUsage = {
			totalTokensIn: 300,
			totalTokensOut: 150,
			totalCost: 0.003,
			contextTokens: 30,
		}

		// Wait for debounce to execute
		vi.advanceTimersByTime(100)

		const thirdEmitCount = emitSpy.mock.calls.filter(
			(call) => call[0] === RooCodeEventName.TaskTokenUsageUpdated,
		).length

		// Should have emitted again after throttle period
		expect(thirdEmitCount).toBeGreaterThan(secondEmitCount)
	})

	test("should include toolUsage in emission payload", async () => {
		const emitSpy = vi.spyOn(task, "emit")

		// Set some tool usage
		task.toolUsage = {
			read_file: { attempts: 5, failures: 1 },
			write_to_file: { attempts: 3, failures: 0 },
		}

		// Wait for debounce to execute
		vi.advanceTimersByTime(100)

		// Set token usage to trigger emission
		task.tokenUsage = {
			totalTokensIn: 100,
			totalTokensOut: 50,
			totalCost: 0.001,
			contextTokens: 10,
		}

		// Wait for debounce to execute
		vi.advanceTimersByTime(100)

		// Should emit with toolUsage as third parameter
		expect(emitSpy).toHaveBeenCalledWith(
			RooCodeEventName.TaskTokenUsageUpdated,
			task.taskId,
			expect.any(Object), // tokenUsage
			task.toolUsage, // toolUsage
		)
	})

	test("should force final emission on task abort", async () => {
		const emitSpy = vi.spyOn(task, "emit")

		// Set token usage
		task.tokenUsage = {
			totalTokensIn: 100,
			totalTokensOut: 50,
			totalCost: 0.001,
			contextTokens: 10,
		}

		// Wait for debounce to execute
		vi.advanceTimersByTime(100)

		const emitCountBeforeAbort = emitSpy.mock.calls.filter(
			(call) => call[0] === RooCodeEventName.TaskTokenUsageUpdated,
		).length

		// Wait for throttle period
		vi.advanceTimersByTime(2100)

		// Change token usage again
		task.tokenUsage = {
			totalTokensIn: 200,
			totalTokensOut: 100,
			totalCost: 0.002,
			contextTokens: 20,
		}

		// Wait for debounce to execute
		vi.advanceTimersByTime(100)

		// Abort task - should force emit final token usage update
		task.emitFinalTokenUsageUpdate()

		const emitCountAfterAbort = emitSpy.mock.calls.filter(
			(call) => call[0] === RooCodeEventName.TaskTokenUsageUpdated,
		).length

		// Should have emitted at least once more after abort
		expect(emitCountAfterAbort).toBeGreaterThan(emitCountBeforeAbort)
	})

	test("should update tokenUsageSnapshot when throttled emission occurs", async () => {
		// Set initial token usage
		task.tokenUsage = {
			totalTokensIn: 100,
			totalTokensOut: 50,
			totalCost: 0.001,
			contextTokens: 10,
		}

		// Wait for debounce to execute
		vi.advanceTimersByTime(100)

		// Initially tokenUsageSnapshot should be set to current tokenUsage
		const initialSnapshot = task.tokenUsageSnapshot
		expect(initialSnapshot).toBeDefined()
		expect(initialSnapshot?.totalTokensIn).toBe(100)
		expect(initialSnapshot?.totalTokensOut).toBe(50)

		// Wait for throttle period
		vi.advanceTimersByTime(2100)

		// Update token usage
		task.tokenUsage = {
			totalTokensIn: 200,
			totalTokensOut: 100,
			totalCost: 0.002,
			contextTokens: 20,
		}

		// Wait for debounce to execute
		vi.advanceTimersByTime(100)

		// Snapshot should be updated to match new tokenUsage
		const newSnapshot = task.tokenUsageSnapshot
		expect(newSnapshot).not.toBe(initialSnapshot)
		expect(newSnapshot?.totalTokensIn).toBe(200)
		expect(newSnapshot?.totalTokensOut).toBe(100)
	})

	test("should not emit if token usage has not changed even after throttle period", async () => {
		const emitSpy = vi.spyOn(task, "emit")

		// Set initial token usage
		task.tokenUsage = {
			totalTokensIn: 100,
			totalTokensOut: 50,
			totalCost: 0.001,
			contextTokens: 10,
		}

		// Wait for debounce to execute
		vi.advanceTimersByTime(100)

		const firstEmitCount = emitSpy.mock.calls.filter(
			(call) => call[0] === RooCodeEventName.TaskTokenUsageUpdated,
		).length

		// Wait for throttle period
		vi.advanceTimersByTime(2100)

		// Set same token usage again
		task.tokenUsage = {
			totalTokensIn: 100,
			totalTokensOut: 50,
			totalCost: 0.001,
			contextTokens: 10,
		}

		// Wait for debounce to execute
		vi.advanceTimersByTime(100)

		const secondEmitCount = emitSpy.mock.calls.filter(
			(call) => call[0] === RooCodeEventName.TaskTokenUsageUpdated,
		).length

		// Should not have emitted again since token usage didn't change
		expect(secondEmitCount).toBe(firstEmitCount)
	})

	test("should emit when tool usage changes even if token usage is the same", async () => {
		const emitSpy = vi.spyOn(task, "emit")

		// Set initial token usage
		task.tokenUsage = {
			totalTokensIn: 100,
			totalTokensOut: 50,
			totalCost: 0.001,
			contextTokens: 10,
		}

		// Wait for debounce to execute
		vi.advanceTimersByTime(100)

		const firstEmitCount = emitSpy.mock.calls.filter(
			(call) => call[0] === RooCodeEventName.TaskTokenUsageUpdated,
		).length

		// Wait for throttle period
		vi.advanceTimersByTime(2100)

		// Change tool usage (token usage stays the same)
		task.toolUsage = {
			read_file: { attempts: 5, failures: 1 },
		}

		// Wait for debounce to execute
		vi.advanceTimersByTime(100)

		// Add another message
		task.tokenUsage = {
			totalTokensIn: 100,
			totalTokensOut: 50,
			totalCost: 0.001,
			contextTokens: 10,
		}

		// Wait for debounce to execute
		vi.advanceTimersByTime(100)

		const secondEmitCount = emitSpy.mock.calls.filter(
			(call) => call[0] === RooCodeEventName.TaskTokenUsageUpdated,
		).length

		// Should have emitted because tool usage changed even though token usage didn't
		expect(secondEmitCount).toBeGreaterThan(firstEmitCount)
	})

	test("should update toolUsageSnapshot when emission occurs", async () => {
		// Set initial token usage
		task.tokenUsage = {
			totalTokensIn: 100,
			totalTokensOut: 50,
			totalCost: 0.001,
			contextTokens: 10,
		}

		// Wait for debounce to execute and set initial snapshot
		vi.advanceTimersByTime(100)

		// Initially toolUsageSnapshot should be set to current toolUsage (empty object)
		const initialSnapshot = task.toolUsageSnapshot
		expect(initialSnapshot).toBeDefined()
		expect(Object.keys(initialSnapshot || {})).toHaveLength(0)

		// Wait for throttle period
		vi.advanceTimersByTime(2100)

		// Update tool usage
		task.toolUsage = {
			read_file: { attempts: 3, failures: 0 },
			write_to_file: { attempts: 2, failures: 1 },
		}

		// Wait for debounce to execute
		vi.advanceTimersByTime(100)

		// Add another token usage change to trigger emission
		task.tokenUsage = {
			totalTokensIn: 200,
			totalTokensOut: 100,
			totalCost: 0.002,
			contextTokens: 20,
		}

		// Wait for debounce to execute
		vi.advanceTimersByTime(100)

		// Snapshot should be updated to match the new toolUsage
		const newSnapshot = task.toolUsageSnapshot
		expect(newSnapshot).not.toBe(initialSnapshot)
		expect(newSnapshot?.read_file).toEqual({ attempts: 3, failures: 0 })
		expect(newSnapshot?.write_to_file).toEqual({ attempts: 2, failures: 1 })
	})

	test("emitFinalTokenUsageUpdate should emit on tool usage change alone", async () => {
		const emitSpy = vi.spyOn(task, "emit")

		// Set initial token usage
		task.tokenUsage = {
			totalTokensIn: 100,
			totalTokensOut: 50,
			totalCost: 0.001,
			contextTokens: 10,
		}

		// Wait for debounce to execute
		vi.advanceTimersByTime(100)

		// Wait for throttle period
		vi.advanceTimersByTime(2100)

		// Change tool usage
		task.toolUsage = {
			execute_command: { attempts: 1, failures: 0 },
		}

		// Wait for debounce to execute
		vi.advanceTimersByTime(100)

		// Call emitFinalTokenUsageUpdate
		task.emitFinalTokenUsageUpdate()

		// Should emit due to tool usage change
		expect(emitSpy).toHaveBeenCalledWith(
			RooCodeEventName.TaskTokenUsageUpdated,
			task.taskId,
			expect.any(Object),
			task.toolUsage,
		)
	})
})

describe("hasToolUsageChanged", () => {
	test("should return true when snapshot is undefined and current has data", () => {
		const current: ToolUsage = {
			read_file: { attempts: 1, failures: 0 },
		}
		expect(hasToolUsageChanged(current, undefined)).toBe(true)
	})

	test("should return false when both are empty", () => {
		expect(hasToolUsageChanged({}, {})).toBe(false)
	})

	test("should return false when snapshot is undefined and current is empty", () => {
		expect(hasToolUsageChanged({}, undefined)).toBe(false)
	})

	test("should return true when a new tool is added", () => {
		const current: ToolUsage = {
			read_file: { attempts: 1, failures: 0 },
			write_to_file: { attempts: 1, failures: 0 },
		}
		const snapshot: ToolUsage = {
			read_file: { attempts: 1, failures: 0 },
		}
		expect(hasToolUsageChanged(current, snapshot)).toBe(true)
	})

	test("should return true when attempts change", () => {
		const current: ToolUsage = {
			read_file: { attempts: 2, failures: 0 },
		}
		const snapshot: ToolUsage = {
			read_file: { attempts: 1, failures: 0 },
		}
		expect(hasToolUsageChanged(current, snapshot)).toBe(true)
	})

	test("should return true when failures change", () => {
		const current: ToolUsage = {
			read_file: { attempts: 1, failures: 1 },
		}
		const snapshot: ToolUsage = {
			read_file: { attempts: 1, failures: 0 },
		}
		expect(hasToolUsageChanged(current, snapshot)).toBe(true)
	})

	test("should return false when nothing changed", () => {
		const current: ToolUsage = {
			read_file: { attempts: 3, failures: 1 },
			write_to_file: { attempts: 2, failures: 0 },
		}
		const snapshot: ToolUsage = {
			read_file: { attempts: 3, failures: 1 },
			write_to_file: { attempts: 2, failures: 0 },
		}
		expect(hasToolUsageChanged(current, snapshot)).toBe(false)
	})
})

describe("hasTokenUsageChanged", () => {
	test("should return true when snapshot is undefined", () => {
		const current: TokenUsage = {
			totalTokensIn: 100,
			totalTokensOut: 50,
			totalCost: 0.01,
			contextTokens: 150,
		}
		expect(hasTokenUsageChanged(current, undefined)).toBe(true)
	})

	test("should return true when totalTokensIn changes", () => {
		const current: TokenUsage = {
			totalTokensIn: 200,
			totalTokensOut: 50,
			totalCost: 0.01,
			contextTokens: 150,
		}
		const snapshot: TokenUsage = {
			totalTokensIn: 100,
			totalTokensOut: 50,
			totalCost: 0.01,
			contextTokens: 150,
		}
		expect(hasTokenUsageChanged(current, snapshot)).toBe(true)
	})

	test("should return false when nothing changed", () => {
		const current: TokenUsage = {
			totalTokensIn: 100,
			totalTokensOut: 50,
			totalCost: 0.01,
			contextTokens: 150,
			totalCacheWrites: 10,
			totalCacheReads: 5,
		}
		const snapshot: TokenUsage = {
			totalTokensIn: 100,
			totalTokensOut: 50,
			totalCost: 0.01,
			contextTokens: 150,
			totalCacheWrites: 10,
			totalCacheReads: 5,
		}
		expect(hasTokenUsageChanged(current, snapshot)).toBe(false)
	})
})
