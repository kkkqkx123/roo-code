import { MessageBusServer } from "../MessageBusServer"
import { ClineProvider } from "../../webview/ClineProvider"
import type { MCPMessages } from "../MessageTypes"
import type { MCPResponses } from "../MessageTypes"

export class MCPHandlers {
  constructor(
    private messageBus: MessageBusServer,
    private provider: ClineProvider
  ) {
    this.registerHandlers()
  }

  private registerHandlers(): void {
    this.messageBus.register("mcp.toggle", this.handleToggle.bind(this))
    this.messageBus.register("mcp.restart", this.handleRestart.bind(this))
    this.messageBus.register("mcp.refreshAll", this.handleRefreshAll.bind(this))
    this.messageBus.register("mcp.toggleToolAlwaysAllow", this.handleToggleToolAlwaysAllow.bind(this))
    this.messageBus.register("mcp.toggleToolEnabledForPrompt", this.handleToggleToolEnabledForPrompt.bind(this))
    this.messageBus.register("mcp.updateTimeout", this.handleUpdateTimeout.bind(this))
    this.messageBus.register("mcp.deleteServer", this.handleDeleteServer.bind(this))
  }

  private async handleToggle(message: MCPMessages.Toggle): Promise<MCPResponses.Toggled> {
    try {
      await this.provider
        .getMcpHub()
        ?.toggleServerDisabled(
          message.serverName,
          !message.enabled,
          "global"
        )
      
      return {
        type: "mcp.toggled",
        serverName: message.serverName,
        enabled: message.enabled
      }
    } catch (error) {
      this.provider.log(
        `Failed to toggle MCP server ${message.serverName}: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`
      )
      throw error
    }
  }

  private async handleRestart(message: MCPMessages.Restart): Promise<MCPResponses.Restarted> {
    try {
      await this.provider.getMcpHub()?.restartConnection(message.serverName, "global")
      
      return {
        type: "mcp.restarted",
        serverName: message.serverName
      }
    } catch (error) {
      this.provider.log(
        `Failed to retry connection for ${message.serverName}: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`
      )
      throw error
    }
  }

  private async handleRefreshAll(message: MCPMessages.RefreshAll): Promise<MCPResponses.Refreshed> {
    const mcpHub = this.provider.getMcpHub()

    if (mcpHub) {
      await mcpHub.refreshAllConnections()
    }
    
    return {
      type: "mcp.refreshed",
      servers: mcpHub?.getServers() ?? []
    }
  }

  private async handleToggleToolAlwaysAllow(message: MCPMessages.ToggleToolAlwaysAllow): Promise<MCPResponses.ToolAlwaysAllowToggled> {
    try {
      await this.provider
        .getMcpHub()
        ?.toggleToolAlwaysAllow(
          message.serverName,
          "global",
          message.toolName,
          message.alwaysAllow
        )
      
      return {
        type: "mcp.toolAlwaysAllowToggled",
        serverName: message.serverName,
        toolName: message.toolName,
        alwaysAllow: message.alwaysAllow
      }
    } catch (error) {
      this.provider.log(
        `Failed to toggle auto-approve for tool ${message.toolName}: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`
      )
      throw error
    }
  }

  private async handleToggleToolEnabledForPrompt(message: MCPMessages.ToggleToolEnabledForPrompt): Promise<MCPResponses.ToolEnabledForPromptToggled> {
    try {
      await this.provider
        .getMcpHub()
        ?.toggleToolEnabledForPrompt(
          message.serverName,
          "global",
          message.toolName,
          message.isEnabled
        )
      
      return {
        type: "mcp.toolEnabledForPromptToggled",
        serverName: message.serverName,
        toolName: message.toolName,
        isEnabled: message.isEnabled
      }
    } catch (error) {
      this.provider.log(
        `Failed to toggle enabled for prompt for tool ${message.toolName}: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`
      )
      throw error
    }
  }

  private async handleUpdateTimeout(message: MCPMessages.UpdateTimeout): Promise<MCPResponses.TimeoutUpdated> {
    try {
      await this.provider
        .getMcpHub()
        ?.updateServerTimeout(
          message.serverName,
          message.timeout,
          "global"
        )
      
      return {
        type: "mcp.timeoutUpdated",
        serverName: message.serverName,
        timeout: message.timeout
      }
    } catch (error) {
      this.provider.log(
        `Failed to update timeout for ${message.serverName}: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`
      )
      throw error
    }
  }

  private async handleDeleteServer(message: MCPMessages.DeleteServer): Promise<MCPResponses.ServerDeleted> {
    try {
      await this.provider
        .getMcpHub()
        ?.deleteServer(message.serverName)
      
      return {
        type: "mcp.serverDeleted",
        serverName: message.serverName
      }
    } catch (error) {
      this.provider.log(
        `Failed to delete MCP server ${message.serverName}: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`
      )
      throw error
    }
  }
}