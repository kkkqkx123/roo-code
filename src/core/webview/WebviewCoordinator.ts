import * as vscode from "vscode"
import * as path from "path"
import fs from "fs/promises"

import {
	type ExtensionMessage,
	type ExtensionState,
} from "../../shared/ExtensionMessage"
import { WebviewMessage } from "../../shared/WebviewMessage"
import { getNonce } from "./getNonce"
import { getUri } from "./getUri"
import { webviewMessageHandler } from "./webviewMessageHandler"
import { MarketplaceManager } from "../../services/marketplace"

export class WebviewCoordinator {
	private view?: vscode.WebviewView | vscode.WebviewPanel
	private webviewDisposables: vscode.Disposable[] = []
	private isViewLaunched = false
	private context: vscode.ExtensionContext
	private outputChannel: vscode.OutputChannel

	constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
		this.context = context
		this.outputChannel = outputChannel
	}

	/**
	 * Resolves the webview view and sets up the webview
	 */
	public async resolveWebviewView(webviewView: vscode.WebviewView | vscode.WebviewPanel): Promise<void> {
		this.view = webviewView

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
		// Get the local path to main script run in the webview
		const scriptUri = this.getWebviewUri(webview, "webview-ui", "build", "main.js")
		const cssUri = this.getWebviewUri(webview, "webview-ui", "build", "main.css")

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
	 * Gets the HTML content for production mode
	 */
	private async getHtmlContent(webview: vscode.Webview): Promise<string> {
		// Get the local path to main script run in the webview
		const scriptUri = this.getWebviewUri(webview, "out", "webview-ui", "main.js")
		const cssUri = this.getWebviewUri(webview, "out", "webview-ui", "main.css")

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
		// This would be implemented to handle messages from the webview
		// The actual implementation would depend on the message handler logic
		webview.onDidReceiveMessage(
			async (message: WebviewMessage) => {
				try {
					// Handle the message using the webviewMessageHandler
					// This would need to be adapted based on the actual message handler implementation
					console.log("Received message from webview:", message)
				} catch (error) {
					console.error("Error handling webview message:", error)
				}
			},
			undefined,
			this.webviewDisposables,
		)
	}

	/**
	 * Gets a webview URI for a resource
	 */
	private getWebviewUri(webview: vscode.Webview, ...pathSegments: string[]): vscode.Uri {
		return webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, ...pathSegments))
	}

	/**
	 * Gets a secret from the secret storage
	 */
	private async getSecret(key: string): Promise<string | undefined> {
		// This would be implemented to get secrets from the secret storage
		// The actual implementation would depend on the secret storage setup
		return undefined
	}

	/**
	 * Gets a global state value
	 */
	private async getGlobalState(key: string): Promise<any> {
		// This would be implemented to get global state
		// The actual implementation would depend on the global state setup
		return undefined
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