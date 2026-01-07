// pnpm --filter roo-cline test core/webview/__tests__/webviewMessageHandler.mcp.spec.ts

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
	},
	workspace: {
		workspaceFolders: undefined,
		getConfiguration: vi.fn(() => ({
			get: vi.fn(),
			update: vi.fn(),
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

			expect(mockedFs.mkdir).toHaveBeenCalledWith("/test/workspace/.roo", { recursive: true })
			expect(safeWriteJson).toHaveBeenCalledWith("/test/workspace/.roo/mcp.json", { mcpServers: {} })
			expect(openFileSpy).toHaveBeenCalledWith("/test/workspace/.roo/mcp.json")
		})

		it("handles openProjectMcpSettings when workspace is not open", async () => {
			await provider.resolveWebviewView(mockWebviewView)
			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			;(vscode.workspace as any).workspaceFolders = []

			await messageHandler({ type: "openProjectMcpSettings" })

			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("errors.no_workspace")
		})

		it("handles openProjectMcpSettings file creation error", async () => {
			await provider.resolveWebviewView(mockWebviewView)
			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			;(vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: "/test/workspace" } }]

			const fs = require("fs/promises")
			fs.mkdir.mockRejectedValue(new Error("Failed to create directory"))

			await messageHandler({
				type: "openProjectMcpSettings",
			})

			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
				expect.stringContaining("Failed to create or open .roo/mcp.json"),
			)
		})
	})
})
