import { describe, test, expect, vi, beforeEach } from "vitest"
import * as vscode from "vscode"
import { ClineProvider } from "../ClineProvider"
import { Task } from "../../task/Task"
import { ContextProxy } from "../../config/ContextProxy"
import { defaultModeSlug } from "../../../shared/modes"
import { experimentDefault } from "../../../shared/experiments"
import { buildApiHandler } from "../../../api"
import { generateSystemPrompt } from "../generateSystemPrompt"

// Mock generateSystemPrompt
vi.mock("../generateSystemPrompt", () => ({
	generateSystemPrompt: vi.fn().mockResolvedValue("Mocked system prompt"),
}))

vi.mock("../../../api")

describe("SystemPromptHandler - getSystemPrompt", () => {
	let provider: ClineProvider
	let mockContext: vscode.ExtensionContext
	let mockOutputChannel: vscode.OutputChannel
	let mockWebviewView: vscode.WebviewView
	let mockPostMessage: any
	let defaultTaskOptions: any

	beforeEach(() => {
		vi.clearAllMocks()

		vi.spyOn(vscode.workspace, 'getWorkspaceFolder').mockReturnValue({
			uri: { fsPath: '/test/workspace' } as vscode.Uri,
			name: 'test-workspace',
			index: 0,
		})

		vi.spyOn(vscode.workspace, 'workspaceFolders', 'get').mockReturnValue([
			{
				uri: { fsPath: '/test/workspace' } as vscode.Uri,
				name: 'test-workspace',
				index: 0,
			},
		])

		const globalState: Record<string, string | undefined> = {
			mode: "code",
			currentApiConfigName: "test-config",
		}

		const secrets: Record<string, string | undefined> = {}

		mockContext = {
			extensionPath: "/test/path",
			extensionUri: {} as vscode.Uri,
			extensionMode: vscode.ExtensionMode.Test,
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

		vi.spyOn(provider, 'customModesManager', 'get').mockReturnValue(mockCustomModesManager as any)

		vi.mocked(buildApiHandler).mockReturnValue({
			getModel: () => ({
				info: {
					supportsImages: false,
					isStealthModel: false,
				},
			}),
		} as any)
	})

	const getMessageHandler = () => {
		const mockCalls = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls
		expect(mockCalls.length).toBeGreaterThan(0)
		return mockCalls[0][0]
	}

	beforeEach(async () => {
		mockPostMessage.mockClear()
		
		vi.spyOn(provider, 'postMessageToWebview').mockImplementation(async (message) => {
			console.log("postMessageToWebview called with:", JSON.stringify(message, null, 2))
			mockPostMessage(message)
		})
		
		await provider.resolveWebviewView(mockWebviewView)
		console.log("After resolveWebviewView, mockPostMessage calls:", mockPostMessage.mock.calls.length)
	})

	test("handles mcpEnabled setting correctly", async () => {
		const handler = getMessageHandler()
		expect(typeof handler).toBe("function")

		console.log("provider.cwd:", provider.cwd)
		console.log("vscode.workspace.workspaceFolders:", vscode.workspace.workspaceFolders)

		vi.spyOn(provider, "getState").mockResolvedValue({
			apiConfiguration: {
				apiProvider: "anthropic" as const,
			},
			mcpEnabled: true,
			enableMcpServerCreation: false,
			mode: "code" as const,
			experiments: experimentDefault,
		} as any)

		const initialCallCount = mockPostMessage.mock.calls.length
		console.log("Before handler call, mockPostMessage calls:", initialCallCount)
		
		try {
			await handler({ type: "getSystemPrompt", mode: "code" })
			console.log("Handler completed successfully")
		} catch (error) {
			console.error("Handler threw error:", error)
			throw error // Re-throw to see the error in test output
		}
		
		console.log("After handler call, mockPostMessage calls:", mockPostMessage.mock.calls.length)
		console.log("All calls:", JSON.stringify(mockPostMessage.mock.calls, null, 2))

		const newCalls = mockPostMessage.mock.calls.slice(initialCallCount)
		expect(newCalls.length).toBe(1)
		expect(newCalls[0][0]).toEqual(
			expect.objectContaining({
				type: "systemPrompt",
				text: expect.any(String),
				mode: "code",
			}),
		)

		vi.spyOn(provider, "getState").mockResolvedValue({
			apiConfiguration: {
				apiProvider: "anthropic" as const,
			},
			mcpEnabled: false,
			enableMcpServerCreation: false,
			mode: "code" as const,
			experiments: experimentDefault,
		} as any)

		const callCountBefore = mockPostMessage.mock.calls.length
		await handler({ type: "getSystemPrompt", mode: "code" })

		const callsAfter = mockPostMessage.mock.calls.slice(callCountBefore)
		expect(callsAfter.length).toBe(1)
		expect(callsAfter[0][0]).toEqual(
			expect.objectContaining({
				type: "systemPrompt",
				text: expect.any(String),
				mode: "code",
			}),
		)
	})

	test("handles errors gracefully", async () => {
		const showErrorMessageSpy = vi.spyOn(vscode.window, "showErrorMessage")
		
		// Mock generateSystemPrompt to throw an error instead of mocking getState
		vi.mocked(generateSystemPrompt).mockRejectedValueOnce(new Error("Test error"))

		const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]
		
		// The error should be caught and showErrorMessage should be called
		await messageHandler({ type: "getSystemPrompt", mode: "code" })

		expect(showErrorMessageSpy).toHaveBeenCalledWith("errors.get_system_prompt")
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
		const initialCount = mockPostMessage.mock.calls.length
		await handler({ type: "getSystemPrompt", mode: "code" })

		const newCalls = mockPostMessage.mock.calls.slice(initialCount)
		expect(newCalls.length).toBe(1)
		expect(newCalls[0][0]).toEqual(
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
		const initialCount = mockPostMessage.mock.calls.length
		await handler({ type: "getSystemPrompt", mode: "code" })

		const newCalls = mockPostMessage.mock.calls.slice(initialCount)
		expect(newCalls.length).toBe(1)
		expect(newCalls[0][0]).toEqual(
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
				apiProvider: "anthropic",
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
		const initialCount = mockPostMessage.mock.calls.length
		await handler({ type: "getSystemPrompt", mode: "code" })

		const newCalls = mockPostMessage.mock.calls.slice(initialCount)
		expect(newCalls.length).toBe(1)
		expect(newCalls[0][0]).toEqual(
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
		const initialCount = mockPostMessage.mock.calls.length
		await handler({ type: "getSystemPrompt", mode: "architect" })

		const newCalls = mockPostMessage.mock.calls.slice(initialCount)
		expect(newCalls.length).toBe(1)
		expect(newCalls[0][0]).toEqual(
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

		const initialCount = mockPostMessage.mock.calls.length
		await handler({ type: "getSystemPrompt", mode: "code" })

		const newCalls = mockPostMessage.mock.calls.slice(initialCount)
		expect(newCalls.length).toBe(1)
		expect(newCalls[0][0]).toEqual(
			expect.objectContaining({
				type: "systemPrompt",
				text: expect.any(String),
				mode: "code",
			}),
		)

		vi.spyOn(provider, "getState").mockResolvedValueOnce({
			apiConfiguration: {
				apiProvider: "anthropic",
			},
			browserToolEnabled: false,
			mode: "code",
			experiments: experimentDefault,
		} as any)

		const callCountBefore = mockPostMessage.mock.calls.length
		await handler({ type: "getSystemPrompt", mode: "code" })

		const callsAfter = mockPostMessage.mock.calls.slice(callCountBefore)
		expect(callsAfter.length).toBe(1)
		expect(callsAfter[0][0]).toEqual(
			expect.objectContaining({
				type: "systemPrompt",
				text: expect.any(String),
				mode: "code",
			}),
		)
	})
})
