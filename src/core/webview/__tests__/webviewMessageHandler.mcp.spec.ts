// pnpm --filter coder test core/webview/__tests__/webviewMessageHandler.mcp.spec.ts

import { describe, it, expect, vi, beforeEach } from "vitest"
import { webviewMessageHandler } from "../webviewMessageHandler"
import * as vscode from "vscode"
import { ClineProvider } from "../ClineProvider"
import { safeWriteJson } from "../../../utils/safeWriteJson"
import { ContextProxy } from "../../config/ContextProxy"

// Mock the safeWriteJson function
vi.mock("../../../utils/safeWriteJson")

// Mock the i18n module
vi.mock("../../../i18n", () => ({
	t: vi.fn((key: string) => key),
	changeLanguage: vi.fn(),
}))

// Mock the fs module
vi.mock("fs/promises", () => ({
	mkdir: vi.fn().mockResolvedValue(undefined),
	writeFile: vi.fn().mockResolvedValue(undefined),
	readFile: vi.fn().mockResolvedValue(""),
	unlink: vi.fn().mockResolvedValue(undefined),
	rmdir: vi.fn().mockResolvedValue(undefined),
}))

// Mock the fs utils
vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn().mockResolvedValue(false),
}))

// Mock the open-file module
vi.mock("../../../integrations/misc/open-file", () => ({
	openFile: vi.fn().mockResolvedValue(undefined),
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
			fsPath: uri.fsPath + '/' + pathSegments.join('/'),
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

describe("webviewMessageHandler - Project MCP Settings", () => {
	let provider: ClineProvider
	let mockContext: vscode.ExtensionContext
	let mockOutputChannel: vscode.OutputChannel
	let mockWebviewView: vscode.WebviewView
	let mockPostMessage: any

	beforeEach(() => {
		vi.clearAllMocks()

		mockContext = {
			extensionPath: "/test/path",
			extensionUri: {} as vscode.Uri,
			globalState: {
				get: vi.fn(),
				update: vi.fn(),
				keys: vi.fn().mockReturnValue([]),
			},
			secrets: {
				get: vi.fn(),
				store: vi.fn(),
				delete: vi.fn(),
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
			onDidDispose: vi.fn(),
			onDidChangeVisibility: vi.fn(),
		} as unknown as vscode.WebviewView

		provider = new ClineProvider(mockContext, mockOutputChannel, "sidebar", new ContextProxy(mockContext))
	})

	describe("openProjectMcpSettings", () => {
		it("handles openProjectMcpSettings message", async () => {
			;(vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: "/test/workspace" } }]

			const fs = await import("fs/promises")
			const mockedFs = vi.mocked(fs)
			mockedFs.mkdir.mockClear()
			mockedFs.mkdir.mockResolvedValue(undefined)
			mockedFs.writeFile.mockClear()
			mockedFs.writeFile.mockResolvedValue(undefined)

			const fsUtils = await import("../../../utils/fs")
			vi.spyOn(fsUtils, "fileExistsAtPath").mockResolvedValue(false)

			const openFileModule = await import("../../../integrations/misc/open-file")
			const openFileSpy = vi.spyOn(openFileModule, "openFile").mockClear().mockResolvedValue(undefined)

			await provider.resolveWebviewView(mockWebviewView)
			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			expect(messageHandler).toBeDefined()
			expect(typeof messageHandler).toBe("function")

			await messageHandler({
				type: "openProjectMcpSettings",
			})

			expect(mockedFs.mkdir).toHaveBeenCalledWith(".roo", { recursive: true })
			expect(safeWriteJson).toHaveBeenCalledWith(expect.stringContaining(".roo"), { mcpServers: {} })
			expect(openFileSpy).toHaveBeenCalledWith(expect.stringContaining(".roo"))
		})

		it("handles openProjectMcpSettings when workspace is not open", async () => {
			await provider.resolveWebviewView(mockWebviewView)
			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			;(vscode.workspace as any).workspaceFolders = []

			await messageHandler({ type: "openProjectMcpSettings" })

			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("common:errors.no_workspace")
		})

		it("handles openProjectMcpSettings file creation error", async () => {
			await provider.resolveWebviewView(mockWebviewView)
			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			;(vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: "/test/workspace" } }]

			const fs = await import("fs/promises")
			const mockedFs = vi.mocked(fs)
			mockedFs.mkdir.mockRejectedValue(new Error("Failed to create directory"))

			await messageHandler({
				type: "openProjectMcpSettings",
			})

			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("mcp:errors.create_json")
		})
	})
})
