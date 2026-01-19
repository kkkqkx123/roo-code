import { describe, it, expect, vi, beforeEach } from "vitest"
import { ContextManager } from "../../context/ContextManager"
import type { ClineProvider } from "../../../../webview/ClineProvider"
import * as contextManagement from "../../../../context"
import type { ApiHandler } from "../../../../../api"
import { DEFAULT_CONTEXT_CONDENSE_PERCENT } from "../../../../context"

vi.mock("../../../ignore/RooIgnoreController", () => ({
	RooIgnoreController: vi.fn().mockImplementation(() => ({
		dispose: vi.fn(),
		initialize: vi.fn().mockResolvedValue(undefined),
		validateAccess: vi.fn().mockReturnValue(true),
	})),
}))

vi.mock("../../../protect/RooProtectedController", () => ({
	RooProtectedController: vi.fn().mockImplementation(() => ({
		dispose: vi.fn(),
		isWriteProtected: vi.fn().mockReturnValue(false),
	})),
}))

describe("ContextManager", () => {
	let mockProvider: Partial<ClineProvider>
	let contextManager: ContextManager

	beforeEach(() => {
		mockProvider = {
			getState: vi.fn(),
			providerSettingsManager: {
				getProfile: vi.fn(),
			},
			postMessageToWebview: vi.fn(),
		} as any

		contextManager = new ContextManager({
			cwd: "/workspace",
			provider: mockProvider as ClineProvider,
			taskId: "task-1",
		})
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(contextManager.cwd).toBe("/workspace")
			expect(contextManager.taskId).toBe("task-1")
			expect(contextManager.rooIgnoreController).toBeDefined()
			expect(contextManager.rooProtectedController).toBeDefined()
			expect(contextManager.fileContextTracker).toBeDefined()
		})

		it("should create RooIgnoreController with correct path", () => {
			expect(contextManager.rooIgnoreController).toBeDefined()
		})

		it("should create RooProtectedController with correct path", () => {
			expect(contextManager.rooProtectedController).toBeDefined()
		})

		it("should create FileContextTracker with provider and taskId", () => {
			expect(contextManager.fileContextTracker).toBeDefined()
		})
	})

	describe("isFileIgnored", () => {
		it("should return false if RooIgnoreController is not available", async () => {
			contextManager.rooIgnoreController = undefined

			const result = await contextManager.isFileIgnored("/workspace/test.txt")

			expect(result).toBe(false)
		})

		it("should return true if file is ignored", async () => {
			const mockValidateAccess = vi.fn().mockReturnValue(false)
			contextManager.rooIgnoreController!.validateAccess = mockValidateAccess

			const result = await contextManager.isFileIgnored("/workspace/ignored.txt")

			expect(result).toBe(true)
			expect(mockValidateAccess).toHaveBeenCalledWith("/workspace/ignored.txt")
		})

		it("should return false if file is not ignored", async () => {
			const mockValidateAccess = vi.fn().mockReturnValue(true)
			contextManager.rooIgnoreController!.validateAccess = mockValidateAccess

			const result = await contextManager.isFileIgnored("/workspace/allowed.txt")

			expect(result).toBe(false)
			expect(mockValidateAccess).toHaveBeenCalledWith("/workspace/allowed.txt")
		})
	})

	describe("isFileProtected", () => {
		it("should return false if RooProtectedController is not available", async () => {
			contextManager.rooProtectedController = undefined

			const result = await contextManager.isFileProtected("/workspace/test.txt")

			expect(result).toBe(false)
		})

		it("should return true if file is protected", async () => {
			const mockIsWriteProtected = vi.fn().mockReturnValue(true)
			contextManager.rooProtectedController!.isWriteProtected = mockIsWriteProtected

			const result = await contextManager.isFileProtected("/workspace/protected.txt")

			expect(result).toBe(true)
			expect(mockIsWriteProtected).toHaveBeenCalledWith("/workspace/protected.txt")
		})

		it("should return false if file is not protected", async () => {
			const mockIsWriteProtected = vi.fn().mockReturnValue(false)
			contextManager.rooProtectedController!.isWriteProtected = mockIsWriteProtected

			const result = await contextManager.isFileProtected("/workspace/unprotected.txt")

			expect(result).toBe(false)
			expect(mockIsWriteProtected).toHaveBeenCalledWith("/workspace/unprotected.txt")
		})
	})

	describe("getFileContextTracker", () => {
		it("should return the file context tracker", () => {
			const tracker = contextManager.getFileContextTracker()

			expect(tracker).toBe(contextManager.fileContextTracker)
		})
	})

	describe("getRooIgnoreController", () => {
		it("should return the RooIgnoreController", () => {
			const controller = contextManager.getRooIgnoreController()

			expect(controller).toBe(contextManager.rooIgnoreController)
		})
	})

	describe("getRooProtectedController", () => {
		it("should return the RooProtectedController", () => {
			const controller = contextManager.getRooProtectedController()

			expect(controller).toBe(contextManager.rooProtectedController)
		})
	})

	describe("dispose", () => {
		it("should dispose the file context tracker", async () => {
			const mockDispose = vi.fn()
			contextManager.fileContextTracker.dispose = mockDispose

			await contextManager.dispose()

			expect(mockDispose).toHaveBeenCalled()
		})
	})

	describe("file access validation", () => {
		it("should validate file access through ignore controller", async () => {
			const mockValidateAccess = vi.fn().mockReturnValue(true)
			contextManager.rooIgnoreController!.validateAccess = mockValidateAccess

			const result = await contextManager.isFileIgnored("/workspace/src/index.ts")

			expect(result).toBe(false)
			expect(mockValidateAccess).toHaveBeenCalledWith("/workspace/src/index.ts")
		})

		it("should validate file protection through protected controller", async () => {
			const mockIsWriteProtected = vi.fn().mockReturnValue(false)
			contextManager.rooProtectedController!.isWriteProtected = mockIsWriteProtected

			const result = await contextManager.isFileProtected("/workspace/src/index.ts")

			expect(result).toBe(false)
			expect(mockIsWriteProtected).toHaveBeenCalledWith("/workspace/src/index.ts")
		})
	})

	describe("controller availability", () => {
		it("should handle missing RooIgnoreController gracefully", async () => {
			contextManager.rooIgnoreController = undefined

			const result = await contextManager.isFileIgnored("/workspace/test.txt")

			expect(result).toBe(false)
		})

		it("should handle missing RooProtectedController gracefully", async () => {
			contextManager.rooProtectedController = undefined

			const result = await contextManager.isFileProtected("/workspace/test.txt")

			expect(result).toBe(false)
		})

		it("should return undefined for RooIgnoreController when not available", () => {
			contextManager.rooIgnoreController = undefined

			const result = contextManager.getRooIgnoreController()

			expect(result).toBeUndefined()
		})

		it("should return undefined for RooProtectedController when not available", () => {
			contextManager.rooProtectedController = undefined

			const result = contextManager.getRooProtectedController()

			expect(result).toBeUndefined()
		})
	})

	describe("handleContextWindowExceededError", () => {
		let mockApi: Partial<ApiHandler>
		let mockSay: ReturnType<typeof vi.fn>
		let mockOverwriteHistory: ReturnType<typeof vi.fn>
		let mockGetSystemPrompt: ReturnType<typeof vi.fn>
		let mockManageContext: ReturnType<typeof vi.fn>

		beforeEach(() => {
			mockApi = {
				getModel: vi.fn().mockReturnValue({
					id: "test-model",
					info: {
						contextWindow: 128000,
						maxTokens: 4096,
					},
				}),
			}

			mockSay = vi.fn()
			mockOverwriteHistory = vi.fn().mockResolvedValue(undefined)
			mockGetSystemPrompt = vi.fn().mockResolvedValue("Test system prompt")

			// Mock the manageContext function
			mockManageContext = vi.fn().mockResolvedValue({
				messages: [{ role: "user", content: "condensed message" }],
				summary: "Condensed context summary",
				cost: 0.01,
				prevContextTokens: 10000,
				newContextTokens: 2000,
			})
			vi.spyOn(contextManagement, "manageContext").mockImplementation(mockManageContext)

			// Mock provider state
			vi.mocked(mockProvider.getState!).mockResolvedValue({
				autoCondenseContext: true,
				autoCondenseContextPercent: 100,
				profileThresholds: {},
				mode: "code",
				customModes: [],
				taskHistory: [],
				writeDelayMs: 1000,
				apiConfiguration: { apiProvider: "anthropic" as const },
				currentApiConfigName: "default",
				listApiConfigMeta: [],
				pinnedApiConfigs: {},
				customInstructions: "",
				dismissedUpsells: [],
				autoApprovalEnabled: false,
				alwaysAllowReadOnly: false,
				alwaysAllowReadOnlyOutsideWorkspace: false,
				alwaysAllowWrite: false,
				alwaysAllowWriteOutsideWorkspace: false,
				alwaysAllowWriteProtected: false,
				alwaysAllowBrowser: false,
				alwaysAllowMcp: false,
				alwaysAllowModeSwitch: false,
				alwaysAllowSubtasks: false,
				alwaysAllowFollowupQuestions: false,
				alwaysAllowExecute: false,
				followupAutoApproveTimeoutMs: 0,
				allowedCommands: [],
				deniedCommands: [],
				allowedMaxRequests: 0,
				allowedMaxCost: 0,
				browserToolEnabled: false,
				browserViewportSize: "900x600",
				remoteBrowserEnabled: false,
				cachedChromeHostUrl: "",
				remoteBrowserHost: "",
				ttsEnabled: false,
				ttsSpeed: 1,
				soundEnabled: false,
				soundVolume: 0.5,
				maxConcurrentFileReads: 5,
				terminalOutputLineLimit: 500,
				terminalOutputCharacterLimit: 10000,
				terminalShellIntegrationTimeout: 30000,
				terminalShellIntegrationDisabled: false,
				terminalCommandDelay: 0,
				terminalPowershellCounter: false,
				terminalZshClearEolMark: false,
				terminalZshOhMy: false,
				terminalZshP10k: false,
				terminalZdotdir: false,
				terminalCompressProgressBar: false,
				diagnosticsEnabled: false,
				diffEnabled: false,
				fuzzyMatchThreshold: 0.8,
				language: "en",
				modeApiConfigs: {},
				customModePrompts: {},
				customSupportPrompts: {},
				enhancementApiConfigId: "",
				condensingApiConfigId: "",
				codebaseIndexConfig: {},
				codebaseIndexModels: {},
				includeDiagnosticMessages: false,
				maxDiagnosticMessages: 10,
				includeTaskHistoryInEnhance: false,
				reasoningBlockCollapsed: false,
				enterBehavior: "send",
				includeCurrentTime: false,
				includeCurrentCost: false,
				maxGitStatusFiles: 50,
				requestDelaySeconds: 0,
				enableCheckpoints: false,
				checkpointTimeout: 15,
				maxOpenTabsContext: 20,
				maxWorkspaceFiles: 50,
				showRooIgnoredFiles: false,
				maxReadFileLine: 500,
				maxImageFileSize: 5,
				maxTotalImageSize: 10,
				experiments: {},
				mcpEnabled: false,
				enableMcpServerCreation: false,
				cwd: "/test",
				machineId: "test-machine",
				uriScheme: "vscode",
				currentTaskItem: undefined,
				currentTaskTodos: undefined,
				toolRequirements: {},
				settingsImportedAt: undefined,
				historyPreviewCollapsed: false,
				isBrowserSessionActive: false,
				messageQueue: undefined,
				lastShownAnnouncementId: undefined,
				apiModelId: undefined,
				mcpServers: undefined,
				remoteControlEnabled: false,
				taskSyncEnabled: false,
				featureRoomoteControlEnabled: false,

				// Terminal command checkpoint configurations
				checkpointBeforeHighRiskCommands: false,
				checkpointAfterHighRiskCommands: false,
				checkpointOnCommandError: true,
				checkpointCommands: [],
				noCheckpointCommands: [],
				checkpointShellSpecific: {},

				claudeCodeIsAuthenticated: undefined,
			}) as any

			// Mock postMessageToWebview
			mockProvider.postMessageToWebview = vi.fn().mockResolvedValue(undefined)
		})

		it("should handle context window exceeded error successfully", async () => {
			const options = {
				api: mockApi as ApiHandler,
				apiConfiguration: { apiProvider: "anthropic" as const },
				apiConversationHistory: [{ role: "user", content: "test message" }],
				tokenUsage: { contextTokens: 120000 },
				toolProtocol: "xml",
				getSystemPrompt: mockGetSystemPrompt,
				overwriteApiConversationHistory: mockOverwriteHistory,
				say: mockSay,
			}

			await contextManager.handleContextWindowExceededError(options)

			// Verify manageContext was called with correct parameters
			expect(mockManageContext).toHaveBeenCalledWith({
				messages: options.apiConversationHistory,
				totalTokens: 120000,
				maxTokens: 4096,
				contextWindow: 128000,
				apiHandler: mockApi,
				autoCondenseContext: true,
				autoCondenseContextPercent: DEFAULT_CONTEXT_CONDENSE_PERCENT,
				systemPrompt: "Test system prompt",
				taskId: "task-1",
				profileThresholds: {},
				currentProfileId: "default",
				useNativeTools: false,
				customCondensingPrompt: undefined,
				condensingApiHandler: undefined,
			})

			// Verify overwriteApiConversationHistory was called
			expect(mockOverwriteHistory).toHaveBeenCalledWith([{ role: "user", content: "condensed message" }])

			// Verify say was called with condense_context
			expect(mockSay).toHaveBeenCalledWith(
				"condense_context",
				undefined,
				undefined,
				false,
				undefined,
				undefined,
				{ isNonInteractive: true },
				{
					summary: "Condensed context summary",
					cost: 0.01,
					newContextTokens: 2000,
					prevContextTokens: 10000,
				},
			)

			// Verify webview messages were sent
			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "condenseTaskContextStarted",
				text: "task-1",
			})
			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "condenseTaskContextResponse",
				text: "task-1",
			})
		})

		it("should handle sliding window truncation when condensation fails", async () => {
			// Mock manageContext to return truncation result
			mockManageContext.mockResolvedValue({
				messages: [{ role: "user", content: "truncated message" }],
				summary: "",
				cost: 0,
				prevContextTokens: 10000,
				truncationId: "trunc-123",
				messagesRemoved: 5,
				newContextTokensAfterTruncation: 8000,
			})

			const options = {
				api: mockApi as ApiHandler,
				apiConfiguration: { apiProvider: "anthropic" as const },
				apiConversationHistory: [{ role: "user", content: "test message" }],
				tokenUsage: { contextTokens: 120000 },
				toolProtocol: "xml",
				getSystemPrompt: mockGetSystemPrompt,
				overwriteApiConversationHistory: mockOverwriteHistory,
				say: mockSay,
			}

			await contextManager.handleContextWindowExceededError(options)

			// Verify say was called with sliding_window_truncation
			expect(mockSay).toHaveBeenCalledWith(
				"sliding_window_truncation",
				undefined,
				undefined,
				false,
				undefined,
				undefined,
				{ isNonInteractive: true },
				undefined,
				{
					truncationId: "trunc-123",
					messagesRemoved: 5,
					prevContextTokens: 10000,
					newContextTokens: 8000,
				},
			)
		})

		it("should handle errors gracefully", async () => {
			// Mock manageContext to throw an error
			mockManageContext.mockRejectedValue(new Error("Context management failed"))

			const options = {
				api: mockApi as ApiHandler,
				apiConfiguration: { apiProvider: "anthropic" as const },
				apiConversationHistory: [{ role: "user", content: "test message" }],
				tokenUsage: { contextTokens: 120000 },
				toolProtocol: "xml",
				getSystemPrompt: mockGetSystemPrompt,
				overwriteApiConversationHistory: mockOverwriteHistory,
				say: mockSay,
			}

			await expect(contextManager.handleContextWindowExceededError(options)).rejects.toThrow("Context management failed")

			// Verify error was reported
			expect(mockSay).toHaveBeenCalledWith(
				"condense_context_error",
				"Context management failed: Context management failed",
				undefined,
				false,
				undefined,
				undefined,
				{ isNonInteractive: true },
			)
		})

		it("should use custom condensing API if configured", async () => {
			// Mock provider state with custom condensing API
			vi.mocked(mockProvider.getState!).mockResolvedValue({
				autoCondenseContext: true,
				autoCondenseContextPercent: 100,
				profileThresholds: {},
				condensingApiConfigId: "custom-config",
				listApiConfigMeta: [{ id: "custom-config", name: "Custom Config" }],
				mode: "code",
				customModes: [],
				taskHistory: [],
				writeDelayMs: 1000,
				apiConfiguration: { apiProvider: "anthropic" as const },
				currentApiConfigName: "default",
				pinnedApiConfigs: {},
				customInstructions: "",
				dismissedUpsells: [],
				autoApprovalEnabled: false,
				alwaysAllowReadOnly: false,
				alwaysAllowReadOnlyOutsideWorkspace: false,
				alwaysAllowWrite: false,
				alwaysAllowWriteOutsideWorkspace: false,
				alwaysAllowWriteProtected: false,
				alwaysAllowBrowser: false,
				alwaysAllowMcp: false,
				alwaysAllowModeSwitch: false,
				alwaysAllowSubtasks: false,
				alwaysAllowFollowupQuestions: false,
				alwaysAllowExecute: false,
				followupAutoApproveTimeoutMs: 0,
				allowedCommands: [],
				deniedCommands: [],
				allowedMaxRequests: 0,
				allowedMaxCost: 0,
				browserToolEnabled: false,
				browserViewportSize: "900x600",
				remoteBrowserEnabled: false,
				cachedChromeHostUrl: "",
				remoteBrowserHost: "",
				ttsEnabled: false,
				ttsSpeed: 1,
				soundEnabled: false,
				soundVolume: 0.5,
				maxConcurrentFileReads: 5,
				terminalOutputLineLimit: 500,
				terminalOutputCharacterLimit: 10000,
				terminalShellIntegrationTimeout: 30000,
				terminalShellIntegrationDisabled: false,
				terminalCommandDelay: 0,
				terminalPowershellCounter: false,
				terminalZshClearEolMark: false,
				terminalZshOhMy: false,
				terminalZshP10k: false,
				terminalZdotdir: false,
				terminalCompressProgressBar: false,
				diagnosticsEnabled: false,
				diffEnabled: false,
				fuzzyMatchThreshold: 0.8,
				language: "en",
				modeApiConfigs: {},
				customModePrompts: {},
				customSupportPrompts: {},
				enhancementApiConfigId: "",
				codebaseIndexConfig: {},
				codebaseIndexModels: {},
				includeDiagnosticMessages: false,
				maxDiagnosticMessages: 10,
				includeTaskHistoryInEnhance: false,
				reasoningBlockCollapsed: false,
				enterBehavior: "send",
				includeCurrentTime: false,
				includeCurrentCost: false,
				maxGitStatusFiles: 50,
				requestDelaySeconds: 0,
				enableCheckpoints: false,
				checkpointTimeout: 15,
				maxOpenTabsContext: 20,
				maxWorkspaceFiles: 50,
				showRooIgnoredFiles: false,
				maxReadFileLine: 500,
				maxImageFileSize: 5,
				maxTotalImageSize: 10,
				experiments: {},
				mcpEnabled: false,
				enableMcpServerCreation: false,
				cwd: "/test",
				machineId: "test-machine",
				uriScheme: "vscode",
				currentTaskItem: undefined,
				currentTaskTodos: undefined,
				toolRequirements: {},
				settingsImportedAt: undefined,
				historyPreviewCollapsed: false,
				isBrowserSessionActive: false,
				messageQueue: undefined,
				lastShownAnnouncementId: undefined,
				apiModelId: undefined,
				mcpServers: undefined,
				remoteControlEnabled: false,
				taskSyncEnabled: false,
				featureRoomoteControlEnabled: false,

				// Terminal command checkpoint configurations
				checkpointBeforeHighRiskCommands: false,
				checkpointAfterHighRiskCommands: false,
				checkpointOnCommandError: true,
				checkpointCommands: [],
				noCheckpointCommands: [],
				checkpointShellSpecific: {},

				claudeCodeIsAuthenticated: undefined,
			}) as any

			// Mock provider settings manager
			if (mockProvider.providerSettingsManager) {
				vi.mocked(mockProvider.providerSettingsManager.getProfile).mockResolvedValue({
					id: "custom-config",
					name: "Custom Config",
					apiProvider: "anthropic" as const,
				})
			}

			const options = {
				api: mockApi as ApiHandler,
				apiConfiguration: { apiProvider: "anthropic" as const },
				apiConversationHistory: [{ role: "user", content: "test message" }],
				tokenUsage: { contextTokens: 120000 },
				toolProtocol: "xml",
				getSystemPrompt: mockGetSystemPrompt,
				overwriteApiConversationHistory: mockOverwriteHistory,
				say: mockSay,
			}

			await contextManager.handleContextWindowExceededError(options)

			// Verify manageContext was called with condensingApiHandler
			expect(mockManageContext).toHaveBeenCalled()
			const callArgs = mockManageContext.mock.calls[0][0]
			expect(callArgs.condensingApiHandler).toBeDefined()
		})
	})
})
