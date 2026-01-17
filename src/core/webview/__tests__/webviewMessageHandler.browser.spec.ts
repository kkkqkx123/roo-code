// pnpm --filter coder test core/webview/__tests__/webviewMessageHandler.browser.spec.ts

import { describe, it, expect, beforeEach, vi } from "vitest"
import { webviewMessageHandler } from "../webviewMessageHandler"
import * as vscode from "vscode"
import { ClineProvider } from "../ClineProvider"
import { ContextProxy } from "../../config/ContextProxy"

// Mock the browser discovery module
vi.mock("../../../services/browser/browserDiscovery", () => ({
	discoverChromeHostUrl: vi.fn().mockResolvedValue("http://localhost:9222"),
	tryChromeHostUrl: vi.fn().mockImplementation(async (url) => {
		return url === "http://localhost:9222" || url === "http://test-url:9222"
	}),
}))

// Mock the BrowserSession module
vi.mock("../../../services/browser/BrowserSession", () => ({
	BrowserSession: vi.fn().mockImplementation(() => ({
		testConnection: vi.fn().mockImplementation(async (url) => {
			if (url === "http://localhost:9222") {
				return {
					success: true,
					message: "Successfully connected to Chrome",
					endpoint: "ws://localhost:9222/devtools/browser/123",
				}
			} else {
				return {
					success: false,
					message: "Failed to connect to Chrome",
					endpoint: undefined,
				}
			}
		}),
	})),
}))

// Mock the i18n module
vi.mock("../../../i18n", () => ({
	t: vi.fn((key: string) => key),
	changeLanguage: vi.fn(),
}))

vi.mock("vscode", () => ({
	window: {
		showErrorMessage: vi.fn(),
		showWarningMessage: vi.fn(),
		showInformationMessage: vi.fn(),
		createTextEditorDecorationType: vi.fn(() => ({ dispose: vi.fn() })),
		tabGroups: {
			onDidChangeTabs: vi.fn(),
		},
	},
	workspace: {
		workspaceFolders: undefined,
		getConfiguration: vi.fn(() => ({
			get: vi.fn(),
			update: vi.fn(),
		})),
		createFileSystemWatcher: vi.fn(() => ({
			onDidCreate: vi.fn(),
			onDidChange: vi.fn(),
			onDidDelete: vi.fn(),
			dispose: vi.fn(),
		})),
	},
	ConfigurationTarget: {
		Global: 1,
		Workspace: 2,
		WorkspaceFolder: 3,
	},
	Uri: {
		parse: vi.fn((str) => ({ toString: () => str })),
		file: vi.fn((path) => ({ fsPath: path })),
		joinPath: vi.fn((uri, ...pathSegments) => ({
			fsPath: (uri.fsPath || uri.toString().replace('file://', '')) + '/' + pathSegments.join('/'),
			toString: () => uri.toString() + '/' + pathSegments.join('/'),
		})),
	},
	env: {
		openExternal: vi.fn(),
		clipboard: {
			writeText: vi.fn(),
		},
	},
	commands: {
		executeCommand: vi.fn(),
	},
	ExtensionMode: {
		Production: 1,
		Development: 2,
		Test: 3,
	},
	extensions: {
		getExtension: vi.fn().mockReturnValue({
			packageJSON: {
				version: "1.0.0",
			},
		}),
	},
}))

describe("webviewMessageHandler - Browser Connection Features", () => {
	let provider: ClineProvider
	let mockContext: vscode.ExtensionContext
	let mockOutputChannel: vscode.OutputChannel
	let mockWebviewView: vscode.WebviewView
	let mockPostMessage: any

	beforeEach(() => {
		vi.clearAllMocks()

		mockContext = {
			globalState: {
				get: vi.fn(),
				update: vi.fn().mockResolvedValue(undefined),
				keys: () => [],
			},
			workspaceState: {
				get: vi.fn(),
				update: vi.fn().mockResolvedValue(undefined),
			},
			secrets: {
				get: vi.fn().mockResolvedValue(undefined),
				store: vi.fn().mockResolvedValue(undefined),
				delete: vi.fn().mockResolvedValue(undefined),
			},
			extensionUri: {
				fsPath: "/test",
				toString: () => "file:///test",
			},
			globalStorageUri: {
				fsPath: "/test/storage",
				toString: () => "file:///test/storage",
			},
			storageUri: {
				fsPath: "/test/storage",
				toString: () => "file:///test/storage",
			},
		} as any

		mockOutputChannel = {
			appendLine: vi.fn(),
			append: vi.fn(),
			clear: vi.fn(),
			show: vi.fn(),
			hide: vi.fn(),
			dispose: vi.fn(),
		} as any

		mockWebviewView = {
			webview: {
				html: "",
				onDidReceiveMessage: vi.fn(),
				postMessage: vi.fn(),
				asWebviewUri: vi.fn((uri) => uri.toString()),
			},
			show: vi.fn(),
			onDidChangeVisibility: vi.fn(),
			onDidDispose: vi.fn(),
			dispose: vi.fn(),
		} as any

		mockPostMessage = mockWebviewView.webview.postMessage

		const contextProxy = new ContextProxy(mockContext)
		provider = new ClineProvider(mockContext, mockOutputChannel, "sidebar", contextProxy)
	})

	describe("testBrowserConnection", () => {
		beforeEach(async () => {
			vi.clearAllMocks()
			await provider.resolveWebviewView(mockWebviewView)
		})

		test("handles testBrowserConnection with provided URL", async () => {
			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			await messageHandler({
				type: "testBrowserConnection",
				text: "http://localhost:9222",
			})

			expect(mockPostMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "browserConnectionResult",
					success: true,
					text: expect.stringContaining("Successfully connected to Chrome"),
				}),
			)

			mockPostMessage.mockClear()

			await messageHandler({
				type: "testBrowserConnection",
				text: "http://inlocalhost:9222",
			})

			expect(mockPostMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "browserConnectionResult",
					success: false,
					text: expect.stringContaining("Failed to connect to Chrome"),
				}),
			)
		})

		test("handles testBrowserConnection with auto-discovery", async () => {
			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			await messageHandler({
				type: "testBrowserConnection",
			})

			const { discoverChromeHostUrl } = await import("../../../services/browser/browserDiscovery")
			expect(discoverChromeHostUrl).toHaveBeenCalled()

			expect(mockPostMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "browserConnectionResult",
					success: true,
					text: expect.stringContaining("Auto-discovered and tested connection to Chrome"),
				}),
			)
		})
	})
})
