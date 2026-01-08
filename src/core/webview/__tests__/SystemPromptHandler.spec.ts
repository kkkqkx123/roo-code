import { describe, test, expect, vi, beforeEach } from "vitest"
import * as vscode from "vscode"
import { ClineProvider } from "../ClineProvider"
import { Task } from "../../task/Task"
import { ContextProxy } from "../../config/ContextProxy"
import { defaultModeSlug } from "../../../shared/modes"
import { experimentDefault } from "../../../shared/experiments"

describe("SystemPromptHandler - getSystemPrompt", () => {
	let provider: ClineProvider
	let mockContext: vscode.ExtensionContext
	let mockOutputChannel: vscode.OutputChannel
	let mockWebviewView: vscode.WebviewView
	let mockPostMessage: any
	let defaultTaskOptions: any

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
				update: vi
					.fn()
					.mockImplementation((key: string, value: string | undefined) => (globalState[key] = value)),
				keys: vi.fn().mockImplementation(() => Object.keys(globalState)),
			},
			secrets: {
				get: vi.fn().mockImplementation((key: string) => secrets[key]),
				store: vi.fn().mockImplementation((key: string, value: string | undefined) => (secrets[key] = value)),
				delete: vi.fn().mockImplementation((key: string) => delete secrets[key]),
			},
			subscriptions: [],
			extension: {
				packageJSON: { version: "1.0.0" },
			},
			globalStorageUri: {
				fsPath: "/test/storage/path",
			},
		} as unknown as vscode.ExtensionContext

		const mockCustomModesManager = {
			updateCustomMode: vi.fn().mockResolvedValue(undefined),
			getCustomModes: vi.fn().mockResolvedValue([]),
			dispose: vi.fn(),
		}

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

		defaultTaskOptions = {
			provider,
			apiConfiguration: {
				apiProvider: "anthropic",
			},
		}

		provider.getMcpHub = vi.fn().mockReturnValue({
			listTools: vi.fn().mockResolvedValue([]),
			callTool: vi.fn().mockResolvedValue({ content: [] }),
			listResources: vi.fn().mockResolvedValue([]),
			readResource: vi.fn().mockResolvedValue({ contents: [] }),
			getAllServers: vi.fn().mockReturnValue([]),
		})

		;(provider as any).customModesManager = mockCustomModesManager
	})

	const getMessageHandler = () => {
		const mockCalls = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls
		expect(mockCalls.length).toBeGreaterThan(0)
		return mockCalls[0][0]
	}

	beforeEach(async () => {
		mockPostMessage.mockClear()
		await provider.resolveWebviewView(mockWebviewView)
	})

	test("handles mcpEnabled setting correctly", async () => {
		const handler = getMessageHandler()
		expect(typeof handler).toBe("function")

		vi.spyOn(provider, "getState").mockResolvedValueOnce({
			apiConfiguration: {
				apiProvider: "anthropic" as const,
			},
			mcpEnabled: true,
			enableMcpServerCreation: false,
			mode: "code" as const,
			experiments: experimentDefault,
		} as any)

		await handler({ type: "getSystemPrompt", mode: "code" })

		expect(mockPostMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "systemPrompt",
				text: expect.any(String),
				mode: "code",
			}),
		)

		mockPostMessage.mockClear()

		vi.spyOn(provider, "getState").mockResolvedValueOnce({
			apiConfiguration: {
				apiProvider: "anthropic" as const,
			},
			mcpEnabled: false,
			enableMcpServerCreation: false,
			mode: "code" as const,
			experiments: experimentDefault,
		} as any)

		await handler({ type: "getSystemPrompt", mode: "code" })

		expect(mockPostMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "systemPrompt",
				text: expect.any(String),
				mode: "code",
			}),
		)
	})

	test("handles errors gracefully", async () => {
		const { SYSTEM_PROMPT } = await import("../../prompts/system")
		vi.mocked(SYSTEM_PROMPT).mockRejectedValueOnce(new Error("Test error"))

		const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]
		await messageHandler({ type: "getSystemPrompt", mode: "code" })

		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("errors.get_system_prompt")
	})

	test("uses code mode custom instructions", async () => {
		vi.spyOn(provider, "getState").mockResolvedValue({
			apiConfiguration: {
				apiProvider: "anthropic" as const,
			},
			customModePrompts: {
				code: { customInstructions: "Code mode specific instructions" },
			},
			mode: "code" as const,
			experiments: experimentDefault,
		} as any)

		const handler = getMessageHandler()
		await handler({ type: "getSystemPrompt", mode: "code" })

		expect(mockPostMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "systemPrompt",
				text: expect.any(String),
				mode: "code",
			}),
		)
	})

	test("generates system prompt with diff enabled", async () => {
		vi.spyOn(provider, "getState").mockResolvedValue({
			apiConfiguration: {
				apiProvider: "anthropic",
				apiModelId: "test-model",
			},
			customModePrompts: {},
			mode: "code",
			enableMcpServerCreation: true,
			mcpEnabled: false,
			browserViewportSize: "900x600",
			diffEnabled: true,
			fuzzyMatchThreshold: 0.8,
			experiments: experimentDefault,
			browserToolEnabled: true,
		} as any)

		const handler = getMessageHandler()
		await handler({ type: "getSystemPrompt", mode: "code" })

		expect(mockPostMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "systemPrompt",
				text: expect.any(String),
				mode: "code",
			}),
		)
	})

	test("generates system prompt with diff disabled", async () => {
		vi.spyOn(provider, "getState").mockResolvedValue({
			apiConfiguration: {
				apiProvider: "openrouter",
				apiModelId: "test-model",
			},
			customModePrompts: {},
			mode: "code",
			mcpEnabled: false,
			browserViewportSize: "900x600",
			diffEnabled: false,
			fuzzyMatchThreshold: 0.8,
			experiments: experimentDefault,
			enableMcpServerCreation: true,
			browserToolEnabled: false,
		} as any)

		const handler = getMessageHandler()
		await handler({ type: "getSystemPrompt", mode: "code" })

		expect(mockPostMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "systemPrompt",
				text: expect.any(String),
				mode: "code",
			}),
		)
	})

	test("uses correct mode-specific instructions when mode is specified", async () => {
		vi.spyOn(provider, "getState").mockResolvedValue({
			apiConfiguration: {
				apiProvider: "anthropic",
			},
			customModePrompts: {
				architect: { customInstructions: "Architect mode instructions" },
			},
			mode: "architect",
			enableMcpServerCreation: false,
			mcpEnabled: false,
			browserViewportSize: "900x600",
			experiments: experimentDefault,
		} as any)

		const handler = getMessageHandler()
		await handler({ type: "getSystemPrompt", mode: "architect" })

		expect(mockPostMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "systemPrompt",
				text: expect.any(String),
				mode: "architect",
			}),
		)
	})

	test("generates system prompt with different browser tool configurations", async () => {
		const handler = getMessageHandler()

		vi.spyOn(provider, "getState").mockResolvedValueOnce({
			apiConfiguration: {
				apiProvider: "anthropic",
			},
			browserToolEnabled: true,
			mode: "code",
			experiments: experimentDefault,
		} as any)

		await handler({ type: "getSystemPrompt", mode: "code" })

		expect(mockPostMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "systemPrompt",
				text: expect.any(String),
				mode: "code",
			}),
		)

		mockPostMessage.mockClear()

		vi.spyOn(provider, "getState").mockResolvedValueOnce({
			apiConfiguration: {
				apiProvider: "anthropic",
			},
			browserToolEnabled: false,
			mode: "code",
			experiments: experimentDefault,
		} as any)

		await handler({ type: "getSystemPrompt", mode: "code" })

		expect(mockPostMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "systemPrompt",
				text: expect.any(String),
				mode: "code",
			}),
		)
	})
})
