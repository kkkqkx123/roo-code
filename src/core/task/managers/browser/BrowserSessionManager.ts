import * as vscode from "vscode"
import type { ClineProvider } from "../../../webview/ClineProvider"
import { BrowserSession } from "../../../../services/browser/BrowserSession"
import { ErrorHandler } from "../../../error/ErrorHandler"

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
    private errorHandler: ErrorHandler

    constructor(options: BrowserSessionManagerOptions) {
        this.taskId = options.taskId
        this.context = options.context
        this.providerRef = options.providerRef
        this.onStatusUpdate = options.onStatusUpdate
        this.onWebviewUpdate = options.onWebviewUpdate
        this.errorHandler = new ErrorHandler()

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

    public async ensureConnection(): Promise<boolean> {
        try {
            return await this.executeWithRetry(
                async () => {
                    const isActive = this.isSessionActive()
                    if (!isActive) {
                        console.warn(`[BrowserSessionManager#${this.taskId}] Browser session not active`)
                        return false
                    }
                    return true
                },
                "ensureConnection",
                3
            )
        } catch (error) {
            console.error(`[BrowserSessionManager#${this.taskId}] Failed to ensure connection:`, error)
            await this.errorHandler.handleError(
                error instanceof Error ? error : new Error(String(error)),
                {
                    operation: "ensureConnection",
                    taskId: this.taskId,
                    timestamp: Date.now()
                }
            )
            return false
        }
    }

    public dispose(): void {
        try {
            this.browserSession.dispose()
        } catch (error) {
            console.error(`[BrowserSessionManager#${this.taskId}] Error disposing browser session:`, error)
        }
    }

    private async executeWithRetry<T>(
        operation: () => Promise<T>,
        operationName: string,
        maxRetries: number = 3
    ): Promise<T> {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                console.log(`[BrowserSessionManager#${operationName}] Attempt ${attempt + 1}/${maxRetries}`)
                const result = await operation()
                console.log(`[BrowserSessionManager#${operationName}] Operation completed successfully`)
                return result
            } catch (error) {
                console.error(`[BrowserSessionManager#${operationName}] Error on attempt ${attempt + 1}: ${error}`)
                
                const result = await this.errorHandler.handleError(
                    error instanceof Error ? error : new Error(String(error)),
                    {
                        operation: operationName,
                        taskId: this.taskId,
                        timestamp: Date.now()
                    }
                )

                if (attempt === maxRetries - 1 || !result.shouldRetry) {
                    console.log(`[BrowserSessionManager#${operationName}] Max retries reached or no retry allowed, throwing error`)
                    throw error
                }

                const delay = 1000 * (attempt + 1)
                console.log(`[BrowserSessionManager#${operationName}] Retrying after ${delay}ms`)
                await this.delay(delay)
            }
        }
        throw new Error(`Operation ${operationName} failed after ${maxRetries} attempts`)
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }
}
