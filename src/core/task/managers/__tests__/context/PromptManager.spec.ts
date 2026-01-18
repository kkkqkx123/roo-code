import { describe, it, expect, vi, beforeEach } from "vitest"
import { PromptManager } from "../../context/PromptManager"
import type { ClineProvider } from "../../../../webview/ClineProvider"
import type { RooIgnoreController } from "../../../../ignore/RooIgnoreController"
import type { DiffStrategy } from "../../../../../shared/tools"

describe("PromptManager", () => {
	let mockProvider: Partial<ClineProvider>
	let mockRooIgnoreController: Partial<RooIgnoreController>
	let mockDiffStrategy: Partial<DiffStrategy>
	let promptManager: PromptManager

	beforeEach(() => {
		mockRooIgnoreController = {
			getInstructions: vi.fn().mockReturnValue("Custom ignore instructions"),
		}

		mockDiffStrategy = {
			getName: vi.fn().mockReturnValue("test-strategy"),
			getToolDescription: vi.fn().mockReturnValue("Test tool description"),
		}

		mockProvider = {
			getState: vi.fn().mockResolvedValue({
				mcpEnabled: true,
				browserToolEnabled: true,
				browserViewportSize: "900x600",
				taskMode: "code",
				customModePrompts: {
					code: {
						roleDefinition: "Code mode role",
						customInstructions: "Code mode instructions",
					},
				},
				customInstructions: "Custom instructions",
				experiments: {},
				enableMcpServerCreation: true,
				language: "en",
				maxReadFileLine: 1000,
				maxConcurrentFileReads: 5,
			}),
			getMcpHub: vi.fn().mockReturnValue({
				getServers: vi.fn().mockReturnValue([]),
			}),
			context: {
				globalStorageUri: { fsPath: "/test/path" },
				globalState: {
					get: vi.fn().mockResolvedValue([]),
				},
			} as any,
		} as any

		promptManager = new PromptManager({
			taskId: "task-1",
			providerRef: { deref: vi.fn().mockReturnValue(mockProvider) } as any,
			workspacePath: "/workspace",
			diffStrategy: mockDiffStrategy as DiffStrategy,
			rooIgnoreController: mockRooIgnoreController as RooIgnoreController,
		})
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(promptManager.taskId).toBe("task-1")
		})

		it("should initialize without optional parameters", () => {
			const minimalManager = new PromptManager({
				taskId: "task-2",
				providerRef: { deref: vi.fn().mockReturnValue(mockProvider) } as any,
				workspacePath: "/workspace",
			})

			expect(minimalManager.taskId).toBe("task-2")
		})
	})

	describe("getSystemPrompt", () => {
		it("should throw error if provider reference is lost", async () => {
			const lostRefManager = new PromptManager({
				taskId: "task-3",
				providerRef: { deref: vi.fn().mockReturnValue(undefined) } as any,
				workspacePath: "/workspace",
			})

			await expect(lostRefManager.getSystemPrompt()).rejects.toThrow("Provider reference lost")
		})

		it("should call provider getState", async () => {
			await promptManager.getSystemPrompt()

			expect(mockProvider.getState).toHaveBeenCalled()
		})

		it("should call getMcpHub when mcpEnabled is true", async () => {
			await promptManager.getSystemPrompt()

			expect(mockProvider.getMcpHub).toHaveBeenCalled()
		})

		it("should throw error when mcpEnabled but MCP Hub is not available", async () => {
			mockProvider.getMcpHub = vi.fn().mockReturnValue(undefined)

			await expect(promptManager.getSystemPrompt()).rejects.toThrow("MCP Hub not available")
		})

		it("should accept apiConfiguration parameter", async () => {
			const apiConfiguration = {
				apiProvider: "anthropic" as const,
				todoListEnabled: false,
			}

			await promptManager.getSystemPrompt(apiConfiguration)

			expect(mockProvider.getState).toHaveBeenCalled()
		})

		it("should accept todoList parameter", async () => {
			const todoList = [
				{ id: "1", content: "Todo 1", status: "pending" as const },
				{ id: "2", content: "Todo 2", status: "completed" as const },
			]

			await promptManager.getSystemPrompt(undefined, todoList)

			expect(mockProvider.getState).toHaveBeenCalled()
		})

		it("should accept diffEnabled parameter", async () => {
			await promptManager.getSystemPrompt(undefined, undefined, true)

			expect(mockProvider.getState).toHaveBeenCalled()
		})

		it("should handle mcpEnabled being false", async () => {
			mockProvider.getState = vi.fn().mockResolvedValue({
				mcpEnabled: false,
				browserToolEnabled: true,
				browserViewportSize: "900x600",
				taskMode: "code",
				customModePrompts: {},
				customInstructions: "Custom instructions",
				experiments: {},
				enableMcpServerCreation: true,
				language: "en",
				maxReadFileLine: 1000,
				maxConcurrentFileReads: 5,
			})

			await promptManager.getSystemPrompt()

			expect(mockProvider.getMcpHub).not.toHaveBeenCalled()
		})

		it("should handle state being undefined", async () => {
			mockProvider.getState = vi.fn().mockResolvedValue(undefined)

			await promptManager.getSystemPrompt()

			expect(mockProvider.getMcpHub).toHaveBeenCalled()
		})
	})

	describe("applyCustomPrompt", () => {
		it("should return base prompt when custom prompt is empty", () => {
			const basePrompt = "This is the base prompt"
			const customPrompt = ""

			const result = promptManager.applyCustomPrompt(basePrompt, customPrompt)

			expect(result).toBe(basePrompt)
		})

		it("should return base prompt when custom prompt is whitespace", () => {
			const basePrompt = "This is the base prompt"
			const customPrompt = "   "

			const result = promptManager.applyCustomPrompt(basePrompt, customPrompt)

			expect(result).toBe(basePrompt)
		})

		it("should append custom prompt to base prompt", () => {
			const basePrompt = "This is the base prompt"
			const customPrompt = "This is the custom prompt"

			const result = promptManager.applyCustomPrompt(basePrompt, customPrompt)

			expect(result).toBe("This is the base prompt\n\nThis is the custom prompt")
		})

		it("should handle multi-line custom prompts", () => {
			const basePrompt = "Base"
			const customPrompt = "Line 1\nLine 2\nLine 3"

			const result = promptManager.applyCustomPrompt(basePrompt, customPrompt)

			expect(result).toBe("Base\n\nLine 1\nLine 2\nLine 3")
		})
	})

	describe("getPromptTemplate", () => {
		beforeEach(() => {
			mockProvider.getState = vi.fn().mockReturnValue({
				customModePrompts: {
					code: {
						roleDefinition: "Code role",
						customInstructions: "Code instructions",
					},
				},
			})
		})

		it("should throw error if provider reference is lost", async () => {
			const lostRefManager = new PromptManager({
				taskId: "task-4",
				providerRef: { deref: vi.fn().mockReturnValue(undefined) } as any,
				workspacePath: "/workspace",
			})

			await expect(lostRefManager.getPromptTemplate("code")).rejects.toThrow("Provider reference lost")
		})

		it("should return empty string when customModePrompts is undefined", async () => {
			mockProvider.getState = vi.fn().mockReturnValue({
				customModePrompts: undefined,
			})

			const result = await promptManager.getPromptTemplate("code")

			expect(result).toBe("")
		})

		it("should return empty string when mode does not exist", async () => {
			const result = await promptManager.getPromptTemplate("ask")

			expect(result).toBe("")
		})

		it("should return role definition only", async () => {
			mockProvider.getState = vi.fn().mockReturnValue({
				customModePrompts: {
					code: {
						roleDefinition: "Code role definition",
					},
				},
			})

			const result = await promptManager.getPromptTemplate("code")

			expect(result).toBe("Code role definition")
		})

		it("should return base instructions only", async () => {
			mockProvider.getState = vi.fn().mockReturnValue({
				customModePrompts: {
					code: {
						customInstructions: "Code base instructions",
					},
				},
			})

			const result = await promptManager.getPromptTemplate("code")

			expect(result).toBe("Code base instructions")
		})

		it("should return combined role definition and base instructions", async () => {
			mockProvider.getState = vi.fn().mockReturnValue({
				customModePrompts: {
					code: {
						roleDefinition: "Code role",
						customInstructions: "Code instructions",
					},
				},
			})

			const result = await promptManager.getPromptTemplate("code")

			expect(result).toBe("Code role\n\nCode instructions")
		})

		it("should return empty string when both roleDefinition and customInstructions are undefined", async () => {
			mockProvider.getState = vi.fn().mockReturnValue({
				customModePrompts: {
					code: {},
				},
			})

			const result = await promptManager.getPromptTemplate("code")

			expect(result).toBe("")
		})

		it("should handle empty strings in roleDefinition and customInstructions", async () => {
			mockProvider.getState = vi.fn().mockReturnValue({
				customModePrompts: {
					code: {
						roleDefinition: "",
						customInstructions: "",
					},
				},
			})

			const result = await promptManager.getPromptTemplate("code")

			expect(result).toBe("")
		})

		it("should trim whitespace from combined result", async () => {
			mockProvider.getState = vi.fn().mockReturnValue({
				customModePrompts: {
					code: {
						roleDefinition: "  Role definition  ",
						customInstructions: "  Base instructions  ",
					},
				},
			})

			const result = await promptManager.getPromptTemplate("code")

			expect(result).toBe("Role definition  \n\n  Base instructions")
		})
	})

	describe("integration tests", () => {
		it("should handle complete workflow with all parameters", async () => {
			const apiConfiguration = {
				apiProvider: "anthropic" as const,
				todoListEnabled: true,
			}

			const todoList = [{ id: "1", content: "Test todo", status: "pending" as const }]

			const systemPrompt = await promptManager.getSystemPrompt(apiConfiguration, todoList, true)

			expect(systemPrompt).toBeDefined()
			expect(typeof systemPrompt).toBe("string")
		})

		it("should handle applyCustomPrompt with getSystemPrompt result", async () => {
			const systemPrompt = await promptManager.getSystemPrompt()
			const customPrompt = "Additional custom instructions"

			const result = promptManager.applyCustomPrompt(systemPrompt, customPrompt)

			expect(result).toContain(systemPrompt)
			expect(result).toContain(customPrompt)
		})
	})
})