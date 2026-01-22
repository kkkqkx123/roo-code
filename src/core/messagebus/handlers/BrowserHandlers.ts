import { MessageBusServer } from "../MessageBusServer"
import { ClineProvider } from "../../webview/ClineProvider"
import type { BrowserMessages } from "../MessageTypes"
import type { BrowserResponses } from "../MessageTypes"
import { discoverChromeHostUrl, tryChromeHostUrl } from "../../../services/browser/browserDiscovery"
import { BrowserSessionPanelManager } from "../../webview/BrowserSessionPanelManager"

export class BrowserHandlers {
  constructor(
    private messageBus: MessageBusServer,
    private provider: ClineProvider
  ) {
    this.registerHandlers()
  }

  private registerHandlers(): void {
    this.messageBus.register("browser.testConnection", this.handleTestConnection.bind(this))
    this.messageBus.register("browser.killSession", this.handleKillSession.bind(this))
    this.messageBus.register("browser.openSessionPanel", this.handleOpenSessionPanel.bind(this))
    this.messageBus.register("browser.showSessionPanelAtStep", this.handleShowSessionPanelAtStep.bind(this))
    this.messageBus.register("browser.refreshSessionPanel", this.handleRefreshSessionPanel.bind(this))
  }

  private async handleTestConnection(message: BrowserMessages.TestConnection): Promise<BrowserResponses.ConnectionResult> {
    if (!message.url) {
      const chromeHostUrl = await discoverChromeHostUrl()

      if (chromeHostUrl) {
        return {
          type: "browser.connectionResult",
          success: !!chromeHostUrl,
          result: {
            text: `Auto-discovered and tested connection to Chrome: ${chromeHostUrl}`,
            endpoint: chromeHostUrl
          }
        }
      } else {
        return {
          type: "browser.connectionResult",
          success: false,
          error: "No Chrome instances found on network. Make sure Chrome is running with remote debugging enabled (--remote-debugging-port=9222)."
        }
      }
    } else {
      const hostIsValid = await tryChromeHostUrl(message.url)

      return {
        type: "browser.connectionResult",
        success: hostIsValid,
        result: hostIsValid
          ? {
              text: `Successfully connected to Chrome: ${message.url}`
            }
          : undefined,
        error: hostIsValid ? undefined : "Failed to connect to Chrome"
      }
    }
  }

  private async handleKillSession(message: BrowserMessages.KillSession): Promise<BrowserResponses.SessionKilled> {
    const task = this.provider.getCurrentTask()
    if (task) {
      await task.getBrowserSession().closeBrowser()
      await this.provider.postStateToWebview()
    }
    
    return {
      type: "browser.sessionKilled"
    }
  }

  private async handleOpenSessionPanel(message: BrowserMessages.OpenSessionPanel): Promise<BrowserResponses.SessionPanelOpened> {
    const panelManager = BrowserSessionPanelManager.getInstance(this.provider)
    await panelManager.toggle()
    
    return {
      type: "browser.sessionPanelOpened"
    }
  }

  private async handleShowSessionPanelAtStep(message: BrowserMessages.ShowSessionPanelAtStep): Promise<BrowserResponses.SessionPanelShownAtStep> {
    const panelManager = BrowserSessionPanelManager.getInstance(this.provider)

    if (message.forceShow) {
      panelManager.resetManualCloseFlag()
    }

    if (message.forceShow || panelManager.shouldAllowAutoOpen()) {
      await panelManager.show()

      if (typeof message.stepIndex === "number" && message.stepIndex >= 0) {
        await panelManager.navigateToStep(message.stepIndex)
      }
    }
    
    return {
      type: "browser.sessionPanelShownAtStep",
      stepIndex: message.stepIndex
    }
  }

  private async handleRefreshSessionPanel(message: BrowserMessages.RefreshSessionPanel): Promise<BrowserResponses.SessionPanelRefreshed> {
    const panelManager = BrowserSessionPanelManager.getInstance(this.provider)
    const task = this.provider.getCurrentTask()
    if (task) {
      const messages = task.clineMessages || []
      const browserSessionStartIndex = messages.findIndex(
        (m) =>
          m.ask === "browser_action_launch" ||
          (m.say === "browser_session_status" && m.text?.includes("opened")),
      )
      const browserSessionMessages =
        browserSessionStartIndex !== -1 ? messages.slice(browserSessionStartIndex) : []
      const isBrowserSessionActive = task.isBrowserSessionActive()
      await panelManager.updateBrowserSession(browserSessionMessages, isBrowserSessionActive)
    }
    
    return {
      type: "browser.sessionPanelRefreshed"
    }
  }
}