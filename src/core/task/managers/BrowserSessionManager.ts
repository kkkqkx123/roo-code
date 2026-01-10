import * as vscode from "vscode"
import type { ClineProvider } from "../../webview/ClineProvider"
import { BrowserSession } from "../../../services/browser/BrowserSession"

export interface BrowserSessionManagerOptions {
    taskId: string
    context: vscode.ExtensionContext
    providerRef: WeakRef<ClineProvider>
    onStatusUpdate?: (message: string) => void
    onWebviewUpdate?: (isActive: boolean) => void
}

export class BrowserSessionManager {
    readonly taskId: string
    private context: vscode.ExtensionContext
    private providerRef: WeakRef<ClineProvider>
    private browserSession: BrowserSession
    private onStatusUpdate?: (message: string) => void
    private onWebviewUpdate?: (isActive: boolean) => void

    constructor(options: BrowserSessionManagerOptions) {
        this.taskId = options.taskId
        this.context = options.context
        this.providerRef = options.providerRef
        this.onStatusUpdate = options.onStatusUpdate
        this.onWebviewUpdate = options.onWebviewUpdate

        this.browserSession = new BrowserSession(this.context, (isActive: boolean) => {
            this.handleStateChange(isActive)
        })
    }

    private handleStateChange(isActive: boolean): void {
        const statusMessage = isActive ? "Browser session opened" : "Browser session closed"
        this.onStatusUpdate?.(statusMessage)
        this.onWebviewUpdate?.(isActive)

        if (isActive) {
            this.autoOpenBrowserSessionPanel()
        }
    }

    private autoOpenBrowserSessionPanel(): void {
        try {
            const { BrowserSessionPanelManager } = require("../../webview/BrowserSessionPanelManager")
            const providerRef = this.providerRef.deref()
            if (providerRef) {
                BrowserSessionPanelManager.getInstance(providerRef)
                    .show()
                    .catch(() => {})
            }
        } catch (err) {
            console.error("[BrowserSessionManager] Failed to auto-open Browser Session panel:", err)
        }
    }

    public getBrowserSession(): BrowserSession {
        return this.browserSession
    }

    public isSessionActive(): boolean {
		return this.browserSession.isSessionActive()
	}

    public getViewportSize(): { width?: number; height?: number } {
        return this.browserSession.getViewportSize()
    }

    public dispose(): void {
        this.browserSession.dispose()
    }
}
