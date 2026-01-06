import * as vscode from "vscode"
import * as dotenvx from "@dotenvx/dotenvx"
import * as path from "path"

// Load environment variables from .env file
try {
	const envPath = path.join(__dirname, "..", "..", ".env")
	dotenvx.config({ path: envPath })
} catch (e) {
	console.warn("Failed to load environment variables:", e)
}

import "./utils/path" // Necessary to have access to String.prototype.toPosix.
import { createOutputChannelLogger } from "./utils/outputChannelLogger"
import { createLogger, LogLevel } from "./utils/logger"

import { Package } from "./shared/package"
import { formatLanguage } from "./shared/language"
import { ContextProxy } from "./core/config/ContextProxy"
import { ClineProvider } from "./core/webview/ClineProvider"
import { DIFF_VIEW_URI_SCHEME } from "./integrations/editor/DiffViewProvider"
import { TerminalRegistry } from "./integrations/terminal/TerminalRegistry"
import { claudeCodeOAuthManager } from "./integrations/claude-code/oauth"
import { McpServerManager } from "./services/mcp/McpServerManager"
import { CodeIndexManager } from "./services/code-index/manager"
import { migrateSettings } from "./utils/migrateSettings"
import { autoImportSettings } from "./utils/autoImportSettings"
import { API } from "./extension/api"

import {
	handleUri,
	registerCommands,
	registerCodeActions,
	registerTerminalActions,
	CodeActionProvider,
} from "./activate"
import { initializeI18n } from "./i18n"
import { flushModels, initializeModelCacheRefresh, refreshModels } from "./api/providers/fetchers/modelCache"

/**
 * Built using https://github.com/microsoft/vscode-webview-ui-toolkit
 *
 * Inspired by:
 *  - https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/default/weather-webview
 *  - https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/frameworks/hello-world-react-cra
 */

let outputChannel: vscode.OutputChannel
let extensionContext: vscode.ExtensionContext
let logger: ReturnType<typeof createLogger>

// This method is called when your extension is activated.
// Your extension is activated the very first time the command is executed.
export async function activate(context: vscode.ExtensionContext) {
	extensionContext = context
	outputChannel = vscode.window.createOutputChannel(Package.outputChannel)
	context.subscriptions.push(outputChannel)

	logger = createLogger(outputChannel, "Extension", LogLevel.DEBUG)
	logger.info(`${Package.name} extension activated`)
	logger.debug(`Package configuration: ${JSON.stringify(Package)}`)

	try {
		await migrateSettings(context, outputChannel)
		logger.debug("Settings migrated successfully")
	} catch (error) {
		logger.error("Failed to migrate settings", error)
	}

	initializeI18n(context.globalState.get("language") ?? formatLanguage(vscode.env.language))
	logger.info(
		`i18n initialized with language: ${context.globalState.get("language") || formatLanguage(vscode.env.language)}`,
	)

	TerminalRegistry.initialize()
	logger.info("TerminalRegistry initialized")

	claudeCodeOAuthManager.initialize(context)
	logger.info("Claude Code OAuth manager initialized")

	const defaultCommands = vscode.workspace.getConfiguration(Package.name).get<string[]>("allowedCommands") || []

	if (!context.globalState.get("allowedCommands")) {
		context.globalState.update("allowedCommands", defaultCommands)
		logger.debug(`Initialized default allowedCommands: ${defaultCommands.join(", ")}`)
	}

	const contextProxy = await ContextProxy.getInstance(context)
	logger.info("ContextProxy instance created")

	const codeIndexManagers: CodeIndexManager[] = []

	if (vscode.workspace.workspaceFolders) {
		for (const folder of vscode.workspace.workspaceFolders) {
			const manager = CodeIndexManager.getInstance(context, folder.uri.fsPath)

			if (manager) {
				codeIndexManagers.push(manager)

				void manager.initialize(contextProxy).catch((error) => {
					logger.error(`CodeIndexManager initialization failed for ${folder.uri.fsPath}`, error)
				})

				context.subscriptions.push(manager)
			}
		}
	}
	logger.info(`CodeIndexManager initialized for ${codeIndexManagers.length} workspace folders`)

	const provider = new ClineProvider(context, outputChannel, "sidebar", contextProxy)
	logger.info("ClineProvider created with renderContext: sidebar")

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(ClineProvider.sideBarId, provider, {
			webviewOptions: { retainContextWhenHidden: true },
		}),
	)
	logger.info(`WebviewViewProvider registered with ID: ${ClineProvider.sideBarId}`)

	try {
		await autoImportSettings(outputChannel, {
			providerSettingsManager: provider.providerSettingsManager,
			contextProxy: provider.contextProxy,
			customModesManager: provider.customModesManager,
		})
		logger.debug("Auto-import settings completed")
	} catch (error) {
		logger.error("Auto-import settings failed", error)
	}

	registerCommands({ context, outputChannel, provider })
	logger.info("Commands registered successfully")

	/**
	 * We use the text document content provider API to show the left side for diff
	 * view by creating a virtual document for the original content. This makes it
	 * readonly so users know to edit the right side if they want to keep their changes.
	 *
	 * This API allows you to create readonly documents in VSCode from arbitrary
	 * sources, and works by claiming an uri-scheme for which your provider then
	 * returns text contents. The scheme must be provided when registering a
	 * provider and cannot change afterwards.
	 *
	 * Note how the provider doesn't create uris for virtual documents - its role
	 * is to provide contents given such an uri. In return, content providers are
	 * wired into the open document logic so that providers are always considered.
	 *
	 * https://code.visualstudio.com/api/extension-guides/virtual-documents
	 */
	const diffContentProvider = new (class implements vscode.TextDocumentContentProvider {
		provideTextDocumentContent(uri: vscode.Uri): string {
			return Buffer.from(uri.query, "base64").toString("utf-8")
		}
	})()

	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider(DIFF_VIEW_URI_SCHEME, diffContentProvider),
	)

	context.subscriptions.push(vscode.window.registerUriHandler({ handleUri }))

	// Register code actions provider.
	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider({ pattern: "**/*" }, new CodeActionProvider(), {
			providedCodeActionKinds: CodeActionProvider.providedCodeActionKinds,
		}),
	)

	registerCodeActions(context)
	registerTerminalActions(context)
	logger.debug("Code actions and terminal actions registered")

	vscode.commands.executeCommand(`${Package.name}.activationCompleted`)
	logger.debug("Activation completed command executed")

	const socketPath = process.env.ROO_CODE_IPC_SOCKET_PATH
	const enableLogging = typeof socketPath === "string"

	if (process.env.NODE_ENV === "development") {
		const watchPaths = [
			{ path: context.extensionPath, pattern: "**/*.ts" },
			{ path: path.join(context.extensionPath, "../packages/types"), pattern: "**/*.ts" },
		]

		logger.debug(
			`Core auto-reloading: Watching for changes in ${watchPaths.map(({ path }) => path).join(", ")}`,
		)

		let reloadTimeout: NodeJS.Timeout | undefined
		const DEBOUNCE_DELAY = 1_000

		const debouncedReload = (uri: vscode.Uri) => {
			if (reloadTimeout) {
				clearTimeout(reloadTimeout)
			}

			logger.debug(`File changed: ${uri.fsPath}, scheduling reload...`)

			reloadTimeout = setTimeout(() => {
				logger.debug("Reloading host after debounce delay...")
				vscode.commands.executeCommand("workbench.action.reloadWindow")
			}, DEBOUNCE_DELAY)
		}

		watchPaths.forEach(({ path: watchPath, pattern }) => {
			const relPattern = new vscode.RelativePattern(vscode.Uri.file(watchPath), pattern)
			const watcher = vscode.workspace.createFileSystemWatcher(relPattern, false, false, false)

			watcher.onDidChange(debouncedReload)
			watcher.onDidCreate(debouncedReload)
			watcher.onDidDelete(debouncedReload)

			context.subscriptions.push(watcher)
		})

		context.subscriptions.push({
			dispose: () => {
				if (reloadTimeout) {
					clearTimeout(reloadTimeout)
				}
			},
		})
	}

	initializeModelCacheRefresh()
	logger.debug("Background model cache refresh initialized")

	logger.info(`Activation completed. Total subscriptions: ${context.subscriptions.length}`)

	return new API(outputChannel, provider, socketPath, enableLogging)
}

// This method is called when your extension is deactivated.
export async function deactivate() {
	logger.info(`${Package.name} extension deactivated`)

	try {
		await McpServerManager.cleanup(extensionContext)
		logger.debug("McpServerManager cleanup completed")
	} catch (error) {
		logger.error("McpServerManager cleanup failed", error)
	}

	TerminalRegistry.cleanup()
	logger.debug("TerminalRegistry cleanup completed")

	const { ClineProvider } = await import("./core/webview/ClineProvider")
	const activeInstances = ClineProvider.getActiveInstances()
	logger.debug(`Disposing ${activeInstances.size} ClineProvider instances`)

	for (const provider of activeInstances) {
		if (typeof provider.dispose === "function") {
			try {
				await provider.dispose()
			} catch (error) {
				logger.error("Error disposing provider", error)
			}
		}
	}

	logger.debug("Extension deactivation completed")
}
