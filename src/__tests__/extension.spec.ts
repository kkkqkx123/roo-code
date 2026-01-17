// npx vitest run __tests__/extension.spec.ts

import * as vscode from "vscode"

vi.mock("vscode", () => ({
	window: {
		createOutputChannel: vi.fn().mockReturnValue({
			appendLine: vi.fn(),
		}),
		registerWebviewViewProvider: vi.fn(),
		registerUriHandler: vi.fn(),
		tabGroups: {
			onDidChangeTabs: vi.fn(),
		},
		onDidChangeActiveTextEditor: vi.fn(),
	},
	workspace: {
		registerTextDocumentContentProvider: vi.fn(),
		getConfiguration: vi.fn().mockReturnValue({
			get: vi.fn().mockReturnValue([]),
		}),
		createFileSystemWatcher: vi.fn().mockReturnValue({
			onDidCreate: vi.fn(),
			onDidChange: vi.fn(),
			onDidDelete: vi.fn(),
			dispose: vi.fn(),
		}),
		onDidChangeWorkspaceFolders: vi.fn(),
		workspaceFolders: undefined,
	},
	languages: {
		registerCodeActionsProvider: vi.fn(),
	},
	commands: {
		executeCommand: vi.fn(),
	},
	env: {
		language: "en",
	},
	ExtensionMode: {
		Production: 1,
	},
	Uri: {
		file: vi.fn().mockReturnValue({ fsPath: "/test/path" }),
	},
	RelativePattern: class {
		constructor(base: any, pattern: string) {
			this.base = base
			this.pattern = pattern
		}
		base: any
		pattern: string
	},
}))

vi.mock("@dotenvx/dotenvx", () => ({
	config: vi.fn(),
}))

vi.mock("../utils/outputChannelLogger", () => ({
	createOutputChannelLogger: vi.fn().mockReturnValue(vi.fn()),
	createDualLogger: vi.fn().mockReturnValue(vi.fn()),
}))

vi.mock("../shared/package", () => ({
	Package: {
		name: "coder",
		outputChannel: "Coder",
		version: "1.0.0",
	},
}))

vi.mock("../shared/language", () => ({
	formatLanguage: vi.fn().mockReturnValue("en"),
}))

vi.mock("../core/config/ContextProxy", () => ({
	ContextProxy: {
		getInstance: vi.fn().mockResolvedValue({
			getValue: vi.fn(),
			setValue: vi.fn(),
			getValues: vi.fn().mockReturnValue({}),
			getProviderSettings: vi.fn().mockReturnValue({}),
		}),
	},
}))

vi.mock("../integrations/editor/DiffViewProvider", () => ({
	DIFF_VIEW_URI_SCHEME: "test-diff-scheme",
}))

vi.mock("../integrations/terminal/TerminalRegistry", () => ({
	TerminalRegistry: {
		initialize: vi.fn(),
		cleanup: vi.fn(),
	},
}))

vi.mock("../integrations/claude-code/oauth", () => ({
	claudeCodeOAuthManager: {
		initialize: vi.fn(),
	},
}))

vi.mock("../core/webview/ClineProvider", () => {
	const MockClineProvider = vi.fn().mockImplementation(() => ({
		context: {
			extensionPath: "/test/path",
			globalState: {
				get: vi.fn(),
				update: vi.fn(),
			},
			subscriptions: [],
		},
		providerSettingsManager: {
			saveConfig: vi.fn(),
		},
		contextProxy: {
			setValues: vi.fn(),
		},
		customModesManager: {},
	}))
	;(MockClineProvider as any).sideBarId = "test-sidebar-id"
	;(MockClineProvider as any).getActiveInstances = vi.fn().mockReturnValue(new Map())
	return {
		ClineProvider: MockClineProvider,
	}
})

vi.mock("../services/mcp/McpServerManager", () => ({
	McpServerManager: {
		cleanup: vi.fn().mockResolvedValue(undefined) as any,
		getInstance: vi.fn().mockResolvedValue(null),
		unregisterProvider: vi.fn(),
	},
}))

vi.mock("../services/code-index/manager", () => ({
	CodeIndexManager: {
		getInstance: vi.fn().mockReturnValue(null),
	},
}))

vi.mock("../utils/migrateSettings", () => ({
	migrateSettings: vi.fn().mockResolvedValue(undefined) as any,
}))

vi.mock("../utils/autoImportSettings", () => ({
	autoImportSettings: vi.fn().mockResolvedValue(undefined) as any,
}))

vi.mock("../extension/api", () => ({
	API: vi.fn().mockImplementation(() => ({
		outputChannel: { appendLine: vi.fn() },
	})),
}))

vi.mock("../activate", () => ({
	handleUri: vi.fn(),
	registerCommands: vi.fn(),
	registerCodeActions: vi.fn(),
	registerTerminalActions: vi.fn(),
	CodeActionProvider: vi.fn().mockImplementation(() => ({
		providedCodeActionKinds: [],
	})),
}))

vi.mock("../i18n", () => ({
	initializeI18n: vi.fn(),
	t: vi.fn((key) => key),
}))


// Mock modelCache to prevent network requests during module loading
const mockRefreshModels = vi.fn().mockResolvedValue({})
vi.mock("../api/providers/fetchers/modelCache", () => ({
	flushModels: vi.fn(),
	getModels: vi.fn().mockResolvedValue([]),
	initializeModelCacheRefresh: vi.fn(),
	refreshModels: mockRefreshModels,
}))

describe("extension.ts", () => {
	let mockContext: vscode.ExtensionContext
	let authStateChangedHandler:
		| ((data: { state: any; previousState: any }) => void | Promise<void>)
		| undefined

	beforeEach(() => {
		vi.clearAllMocks()

		mockContext = {
			extensionPath: "/test/path",
			globalState: {
				get: vi.fn().mockReturnValue(undefined),
				update: vi.fn(),
			},
			subscriptions: [],
		} as unknown as vscode.ExtensionContext

		authStateChangedHandler = undefined
	})

	describe("activate", () => {
		it("should initialize output channel and logger", async () => {
			const { activate } = await import("../extension")

			const api = await activate(mockContext)

			expect(vscode.window.createOutputChannel).toHaveBeenCalledWith("Roo-Code")
			expect(mockContext.subscriptions.length).toBeGreaterThan(0)
			expect(api).toBeDefined()
		})

		it("should migrate settings on activation", async () => {
			const { activate } = await import("../extension")

			await activate(mockContext)

			expect(mockContext.globalState.update).toHaveBeenCalled()
		})

		it("should initialize i18n with default language", async () => {
			mockContext.globalState.get = vi.fn().mockReturnValue(undefined)

			const { activate } = await import("../extension")

			await activate(mockContext)

			expect(mockContext.globalState.get).toHaveBeenCalledWith("language")
		})

		it("should initialize i18n with saved language", async () => {
			mockContext.globalState.get = vi.fn().mockReturnValue("en")

			const { activate } = await import("../extension")

			await activate(mockContext)

			expect(mockContext.globalState.get).toHaveBeenCalledWith("language")
		})

		it("should initialize TerminalRegistry", async () => {
			const { activate } = await import("../extension")

			await activate(mockContext)

			const { TerminalRegistry } = await import("../integrations/terminal/TerminalRegistry")
			expect(TerminalRegistry.initialize).toHaveBeenCalled()
		})

		it("should initialize Claude Code OAuth manager", async () => {
			const { activate } = await import("../extension")

			await activate(mockContext)

			const { claudeCodeOAuthManager } = await import("../integrations/claude-code/oauth")
			expect(claudeCodeOAuthManager.initialize).toHaveBeenCalledWith(mockContext)
		})

		it("should initialize default allowed commands", async () => {
			mockContext.globalState.get = vi.fn().mockReturnValue(undefined)
			vscode.workspace.getConfiguration = vi.fn().mockReturnValue({
				get: vi.fn().mockReturnValue(["command1", "command2"]),
			})

			const { activate } = await import("../extension")

			await activate(mockContext)

			expect(mockContext.globalState.update).toHaveBeenCalledWith("allowedCommands", ["command1", "command2"])
		})

		it("should register webview view provider", async () => {
			const { activate } = await import("../extension")

			await activate(mockContext)

			expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalled()
		})

		it("should register text document content provider for diff view", async () => {
			const { activate } = await import("../extension")

			await activate(mockContext)

			expect(vscode.workspace.registerTextDocumentContentProvider).toHaveBeenCalled()
		})

		it("should register URI handler", async () => {
			const { activate } = await import("../extension")

			await activate(mockContext)

			expect(vscode.window.registerUriHandler).toHaveBeenCalled()
		})

		it("should register code actions provider", async () => {
			const { activate } = await import("../extension")

			await activate(mockContext)

			expect(vscode.languages.registerCodeActionsProvider).toHaveBeenCalled()
		})

		it("should execute activation completed command", async () => {
			const { activate } = await import("../extension")

			await activate(mockContext)

			expect(vscode.commands.executeCommand).toHaveBeenCalledWith("coder.activationCompleted")
		})

		it("should return API instance", async () => {
			const { activate } = await import("../extension")

			const api = await activate(mockContext)

			expect(api).toBeDefined()
		})

		it("should handle workspace folders", async () => {
			vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
				{ uri: vscode.Uri.file("/workspace1"), name: "workspace1", index: 0 },
			])

			const { activate } = await import("../extension")

			await activate(mockContext)

			const { CodeIndexManager } = await import("../services/code-index/manager")
			expect(CodeIndexManager.getInstance).toHaveBeenCalled()
		})

		it("should handle development mode file watching", async () => {
			process.env.NODE_ENV = "development"

			const { activate } = await import("../extension")

			await activate(mockContext)

			expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalled()
		})
	})

	describe("deactivate", () => {
		it("should cleanup McpServerManager", async () => {
			const { activate, deactivate } = await import("../extension")

			await activate(mockContext)
			await deactivate()

			const { McpServerManager } = await import("../services/mcp/McpServerManager")
			expect(McpServerManager.cleanup).toHaveBeenCalledWith(mockContext)
		})

		it("should cleanup TerminalRegistry", async () => {
			const { activate, deactivate } = await import("../extension")

			await activate(mockContext)
			await deactivate()

			const { TerminalRegistry } = await import("../integrations/terminal/TerminalRegistry")
			expect(TerminalRegistry.cleanup).toHaveBeenCalled()
		})

		it("should dispose all ClineProvider instances", async () => {
			const { activate, deactivate } = await import("../extension")

			await activate(mockContext)
			await deactivate()

			const { ClineProvider } = await import("../core/webview/ClineProvider")
			expect(ClineProvider.getActiveInstances).toHaveBeenCalled()
		})
	})

	describe("error handling", () => {
		it("should handle settings migration errors", async () => {
			const { migrateSettings } = await import("../utils/migrateSettings") as any
			migrateSettings.mockRejectedValueOnce(new Error("Migration failed"))

			const { activate } = await import("../extension")

			const api = await activate(mockContext)

			expect(api).toBeDefined()
			expect(migrateSettings).toHaveBeenCalled()
		})

		it("should handle auto import settings errors", async () => {
			const { autoImportSettings } = await import("../utils/autoImportSettings") as any
			autoImportSettings.mockRejectedValueOnce(new Error("Auto import failed"))

			const { activate } = await import("../extension")

			const api = await activate(mockContext)

			expect(api).toBeDefined()
			expect(autoImportSettings).toHaveBeenCalled()
		})

		it("should handle McpServerManager cleanup errors", async () => {
			const { McpServerManager } = await import("../services/mcp/McpServerManager") as any
			McpServerManager.cleanup.mockRejectedValueOnce(new Error("Cleanup failed"))

			const { activate, deactivate } = await import("../extension")

			await activate(mockContext)
			await deactivate()

			expect(McpServerManager.cleanup).toHaveBeenCalled()
		})

		it("should handle ClineProvider disposal errors", async () => {
			const { ClineProvider } = await import("../core/webview/ClineProvider")
			ClineProvider.getActiveInstances = vi.fn().mockReturnValue([
				{
					dispose: vi.fn().mockRejectedValue(new Error("Disposal failed")),
				},
			])

			const { activate, deactivate } = await import("../extension")

			await activate(mockContext)
			await deactivate()

			expect(ClineProvider.getActiveInstances).toHaveBeenCalled()
		})
	})
})
