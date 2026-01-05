import * as vscode from "vscode"
import fs from "fs/promises"

import { type ExtensionMessage } from "../../shared/ExtensionMessage"
import { WebviewMessage } from "../../shared/WebviewMessage"
import { getNonce } from "./getNonce"
import { getUri } from "./getUri"
import { webviewMessageHandler } from "./webviewMessageHandler"
import { MarketplaceManager } from "../../services/marketplace"
import { ClineProvider } from "./ClineProvider"

export class WebviewCoordinator {
	private view?: vscode.WebviewView | vscode.WebviewPanel
	private webviewDisposables: vscode.Disposable[] = []
	private isViewLaunched = false
	private context: vscode.ExtensionContext
	private outputChannel: vscode.OutputChannel
	private provider: ClineProvider
	private marketplaceManager?: MarketplaceManager

	constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel, provider: ClineProvider, marketplaceManager?: MarketplaceManager) {
		this.context = context
		this.outputChannel = outputChannel
		this.provider = provider
		this.marketplaceManager = marketplaceManager
	}

	/**
	 * Resolves the webview view and sets up the webview
	 */
	public async resolveWebviewView(webviewView: vscode.WebviewView | vscode.WebviewPanel): Promise<void> {
		this.view = webviewView

		// Clear any existing webview resources before setting up new ones
		this.clearWebviewResources()

		// Set webview options
		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,
			// Restrict the webview to only load resources from the `out` and `webview-ui/build` directories
			localResourceRoots: [
				vscode.Uri.joinPath(this.context.extensionUri, "out"),
				vscode.Uri.joinPath(this.context.extensionUri, "webview-ui/build"),
			],
			// Enable forms for input handling
			enableForms: true,
		}

		// Set the HTML content that will fill the webview view
		if (this.context.extensionMode === vscode.ExtensionMode.Development) {
			webviewView.webview.html = await this.getHMRHtmlContent(webviewView.webview)
		} else {
			webviewView.webview.html = await this.getHtmlContent(webviewView.webview)
		}

		// Set up message listener
		this.setWebviewMessageListener(webviewView.webview)

		// Mark view as launched
		this.isViewLaunched = true
	}

	/**
	 * Posts a message to the webview
	 */
	public async postMessageToWebview(message: ExtensionMessage): Promise<void> {
		if (!this.view) {
			return
		}

		await this.view.webview.postMessage(message)
	}

	/**
	 * Gets the HTML content for development mode with HMR
	 */
	private async getHMRHtmlContent(webview: vscode.Webview): Promise<string> {
		let localPort = "5173"

		try {
			const portFilePath = vscode.Uri.joinPath(this.context.extensionUri, "..", ".vite-port").fsPath

			try {
				const port = await fs.readFile(portFilePath, "utf-8")
				localPort = port.trim()
				this.outputChannel.appendLine(`[WebviewCoordinator:Vite] Using Vite server port from ${portFilePath}: ${localPort}`)
			} catch (err) {
				this.outputChannel.appendLine(
					`[WebviewCoordinator:Vite] Port file not found at ${portFilePath}, using default port: ${localPort}`,
				)
			}
		} catch (err) {
			this.outputChannel.appendLine(`[WebviewCoordinator:Vite] Failed to read Vite port file: ${err}`)
		}

		const localServerUrl = `localhost:${localPort}`

		// Check if local dev server is running.
		try {
			const axios = (await import("axios")).default
			await axios.get(`http://${localServerUrl}`)
		} catch (error) {
			vscode.window.showErrorMessage("Vite dev server is not running. Please run 'pnpm dev' in the webview-ui directory.")
			return this.getHtmlContent(webview)
		}

		const nonce = getNonce()

		// Get the OpenRouter base URL from configuration
		const state = await this.provider.getStateToPostToWebview()
		const openRouterBaseUrl = state.apiConfiguration.openRouterBaseUrl || "https://openrouter.ai"
		// Extract the domain for CSP
		const openRouterDomain = openRouterBaseUrl.match(/^(https?:\/\/[^\/]+)/)?.[1] || "https://openrouter.ai"

		const stylesUri = getUri(webview, this.context.extensionUri, ["webview-ui", "build", "assets", "index.css"])
		const codiconsUri = getUri(webview, this.context.extensionUri, ["assets", "codicons", "codicon.css"])
		const materialIconsUri = getUri(webview, this.context.extensionUri, ["assets", "vscode-material-icons", "icons"])
		const imagesUri = getUri(webview, this.context.extensionUri, ["assets", "images"])
		const audioUri = getUri(webview, this.context.extensionUri, ["webview-ui", "audio"])

		const file = "src/index.tsx"
		const scriptUri = `http://${localServerUrl}/${file}`

		const reactRefresh = /*html*/ `
			<script nonce="${nonce}" type="module">
				import RefreshRuntime from "http://localhost:${localPort}/@react-refresh"
				RefreshRuntime.injectIntoGlobalHook(window)
				window.$RefreshReg$ = () => {}
				window.$RefreshSig$ = () => (type) => type
				window.__vite_plugin_react_preamble_installed__ = true
			</script>
		`

		const csp = [
			"default-src 'none'",
			`font-src ${webview.cspSource} data:`,
			`style-src ${webview.cspSource} 'unsafe-inline' https://* http://${localServerUrl} http://0.0.0.0:${localPort}`,
			`img-src ${webview.cspSource} https://storage.googleapis.com https://img.clerk.com data:`,
			`media-src ${webview.cspSource}`,
			`script-src 'unsafe-eval' ${webview.cspSource} https://* https://*.posthog.com http://${localServerUrl} http://0.0.0.0:${localPort} 'nonce-${nonce}'`,
			`connect-src ${webview.cspSource} ${openRouterDomain} https://* https://*.posthog.com ws://${localServerUrl} ws://0.0.0.0:${localPort} http://${localServerUrl} http://0.0.0.0:${localPort}`,
		]

		return /*html*/ `
			<!DOCTYPE html>
			<html lang="en">
				<head>
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
					<meta http-equiv="Content-Security-Policy" content="${csp.join("; ")}">
					<link rel="stylesheet" type="text/css" href="${stylesUri}">
					<link href="${codiconsUri}" rel="stylesheet" />
					<script nonce="${nonce}">
						window.IMAGES_BASE_URI = "${imagesUri}"
						window.AUDIO_BASE_URI = "${audioUri}"
						window.MATERIAL_ICONS_BASE_URI = "${materialIconsUri}"
					</script>
					<title>Roo Code</title>
				</head>
				<body>
					<div id="root"></div>
					${reactRefresh}
					<script type="module" src="${scriptUri}"></script>
				</body>
			</html>
		`
	}

	/**
	 * Gets the HTML content for production mode
	 */
	private async getHtmlContent(webview: vscode.Webview): Promise<string> {
		// Get the local path to main script run in the webview
		const scriptUri = getUri(webview, this.context.extensionUri, ["out", "webview-ui", "main.js"])
		const cssUri = getUri(webview, this.context.extensionUri, ["out", "webview-ui", "main.css"])

		const nonce = getNonce()

		// Use a nonce to only allow specific scripts to be run
		return `<!DOCTYPE html>
		<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data:; script-src 'nonce-${nonce}';">
				<link href="${cssUri}" rel="stylesheet">
				<title>Roo Code</title>
			</head>
			<body>
				<div id="root"></div>
				<script nonce="${nonce}">
					const vscode = acquireVsCodeApi()
					const apiKey = ${JSON.stringify(await this.getSecret("apiKey") || "")}
					const openRouterApiKey = ${JSON.stringify(await this.getSecret("openRouterApiKey") || "")}
					const requestyApiKey = ${JSON.stringify(await this.getSecret("requestyApiKey") || "")}
					const glhfApiKey = ${JSON.stringify(await this.getSecret("glhfApiKey") || "")}
					const openAiApiKey = ${JSON.stringify(await this.getSecret("openAiApiKey") || "")}
					const geminiApiKey = ${JSON.stringify(await this.getSecret("geminiApiKey") || "")}
					const azureApiKey = ${JSON.stringify(await this.getSecret("azureApiKey") || "")}
					const azureBaseUrl = ${JSON.stringify(await this.getSecret("azureBaseUrl") || "")}
					const azureModelId = ${JSON.stringify(await this.getSecret("azureModelId") || "")}
					const openAiBaseUrl = ${JSON.stringify(await this.getSecret("openAiBaseUrl") || "")}
					const openAiModelId = ${JSON.stringify(await this.getSecret("openAiModelId") || "")}
					const ollamaModelId = ${JSON.stringify(await this.getSecret("ollamaModelId") || "")}
					const ollamaBaseUrl = ${JSON.stringify(await this.getSecret("ollamaBaseUrl") || "")}
					const lmStudioModelId = ${JSON.stringify(await this.getSecret("lmStudioModelId") || "")}
					const lmStudioBaseUrl = ${JSON.stringify(await this.getSecret("lmStudioBaseUrl") || "")}
					const anthropicBaseUrl = ${JSON.stringify(await this.getSecret("anthropicBaseUrl") || "")}
					const maxRequestsPerTask = ${JSON.stringify(await this.getSecret("maxRequestsPerTask") || "")}
					const lastShownAnnouncementId = ${JSON.stringify(await this.getGlobalState("lastShownAnnouncementId") || "")}
				</script>
				<script type="module" nonce="${nonce}" src="${scriptUri}"></script>
			</body>
		</html>`
	}

	/**
	 * Sets up the webview message listener
	 */
	private setWebviewMessageListener(webview: vscode.Webview): void {
		const onReceiveMessage = async (message: WebviewMessage) =>
			webviewMessageHandler(this.provider, message, this.marketplaceManager)

		const messageDisposable = webview.onDidReceiveMessage(onReceiveMessage)
		this.webviewDisposables.push(messageDisposable)
	}

	/**
	 * Gets a secret from the secret storage
	 */
	private async getSecret(key: string): Promise<string | undefined> {
		return await this.context.secrets.get(key)
	}

	/**
	 * Gets a global state value
	 */
	private async getGlobalState(key: string): Promise<any> {
		return await this.context.globalState.get(key)
	}

	/**
	 * Clears webview resources
	 */
	public clearWebviewResources(): void {
		while (this.webviewDisposables.length) {
			const x = this.webviewDisposables.pop()
			if (x) {
				x.dispose()
			}
		}
	}

	/**
	 * Disposes the webview coordinator
	 */
	public dispose(): void {
		this.clearWebviewResources()
		
		if (this.view && "dispose" in this.view) {
			this.view.dispose()
		}
	}

	/**
	 * Gets the current webview panel
	 */
	public getView(): vscode.WebviewView | vscode.WebviewPanel | undefined {
		return this.view
	}

	/**
	 * Checks if the view is launched
	 */
	public getIsViewLaunched(): boolean {
		return this.isViewLaunched
	}
}