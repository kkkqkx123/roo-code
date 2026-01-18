import { describe, it, expect, vi, beforeEach } from "vitest"
import { Task } from "../Task"
import { ClineProvider } from "../../webview/ClineProvider"
import { ContextProxy } from "../../config/ContextProxy"
import * as vscode from "vscode"
import type { ProviderSettings } from "@shared/types"

vi.mock("vscode", () => ({
	RelativePattern: vi.fn((base, pattern) => ({ base, pattern })),
	workspace: {
		createFileSystemWatcher: vi.fn(() => ({
			onDidCreate: vi.fn(() => ({ dispose: vi.fn() })),
			onDidDelete: vi.fn(() => ({ dispose: vi.fn() })),
			onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
			dispose: vi.fn(),
		})),
	},
	window: {
		createTextEditorDecorationType: vi.fn(() => ({ dispose: vi.fn() })),
		tabGroups: {
			all: [],
			close: vi.fn().mockResolvedValue(undefined),
		},
		showTextDocument: vi.fn().mockResolvedValue(undefined),
		visibleTextEditors: [],
		onDidChangeVisibleTextEditors: vi.fn(() => ({ dispose: vi.fn() })),
	},
}))

describe("Task - Constructor", () => {
	let mockProvider: any
	let mockApiConfig: ProviderSettings
	let mockOutputChannel: any

	beforeEach(() => {
		vi.clearAllMocks()

		mockApiConfig = {
			apiProvider: "anthropic",
			apiModelId: "claude-3-5-sonnet-20241022",
			apiKey: "test-api-key",
		} as any

		mockOutputChannel = {
			appendLine: vi.fn(),
			append: vi.fn(),
			clear: vi.fn(),
			show: vi.fn(),
			hide: vi.fn(),
			dispose: vi.fn(),
		}

		mockProvider = {
			postMessageToWebview: vi.fn().mockResolvedValue(undefined),
			postStateToWebview: vi.fn().mockResolvedValue(undefined),
			getState: vi.fn().mockResolvedValue({}),
			context: {
				globalStorageUri: { fsPath: "/test/storage" },
			},
			outputChannel: mockOutputChannel,
		}
	})

	describe("constructor", () => {
		it("should respect provided settings", async () => {
			const cline = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				fuzzyMatchThreshold: 0.95,
				task: "test task",
				startTask: false,
			})

			expect(cline.diffEnabled).toBe(false)
		})

		it("should use default fuzzy match threshold when not provided", async () => {
			const cline = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				enableDiff: true,
				fuzzyMatchThreshold: 0.95,
				task: "test task",
				startTask: false,
			})

			expect(cline.diffEnabled).toBe(true)

			expect(cline.diffStrategy).toBeDefined()
		})

		it("should use default consecutiveMistakeLimit when not provided", () => {
			const cline = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			expect(cline.consecutiveMistakeLimit).toBe(3)
		})

		it("should respect provided consecutiveMistakeLimit", () => {
			const cline = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				consecutiveMistakeLimit: 5,
				task: "test task",
				startTask: false,
			})

			expect(cline.consecutiveMistakeLimit).toBe(5)
		})

		it("should keep consecutiveMistakeLimit of 0 as 0 for unlimited", () => {
			const cline = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				consecutiveMistakeLimit: 0,
				task: "test task",
				startTask: false,
			})

			expect(cline.consecutiveMistakeLimit).toBe(0)
		})

		it("should pass 0 to ToolRepetitionDetector for unlimited mode", () => {
			const cline = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				consecutiveMistakeLimit: 0,
				task: "test task",
				startTask: false,
			})

			expect(cline.toolRepetitionDetector).toBeDefined()
			expect(cline.consecutiveMistakeLimit).toBe(0)
		})

		it("should pass consecutiveMistakeLimit to ToolRepetitionDetector", () => {
			const cline = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				consecutiveMistakeLimit: 5,
				task: "test task",
				startTask: false,
			})

			expect(cline.toolRepetitionDetector).toBeDefined()
			expect(cline.consecutiveMistakeLimit).toBe(5)
		})

		it("should require either task or historyItem", () => {
			expect(() => {
				new Task({ provider: mockProvider, apiConfiguration: mockApiConfig })
			}).toThrow("Either historyItem or task/images must be provided")
		})
	})
})
