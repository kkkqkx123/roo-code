import { MessageBusServer } from "../MessageBusServer"
import { ClineProvider } from "../../webview/ClineProvider"
import type { SettingsMessages } from "../MessageTypes"
import type { SettingsResponses } from "../MessageTypes"
import * as vscode from "vscode"
import { changeLanguage } from "../../../i18n"
import { Package } from "../../../shared/package"
import { Terminal } from "../../../integrations/terminal/Terminal"
import { setTtsEnabled, setTtsSpeed } from "../../../utils/tts"
import { experimentDefault } from "../../experiments/experiment-utils"
import type { Language, RooCodeSettings, ExperimentId } from "@shared/types"

export class SettingsHandlers {
  constructor(
    private messageBus: MessageBusServer,
    private provider: ClineProvider
  ) {
    this.registerHandlers()
  }

  private registerHandlers(): void {
    this.messageBus.register("settings.get", this.handleGetSettings.bind(this))
    this.messageBus.register("settings.update", this.handleUpdateSettings.bind(this))
    this.messageBus.register("settings.updateCustomInstructions", this.handleUpdateCustomInstructions.bind(this))
    this.messageBus.register("settings.updateMode", this.handleUpdateMode.bind(this))
  }

  private async handleGetSettings(message: SettingsMessages.Get): Promise<SettingsResponses.Got> {
    const state = await this.provider.getState()
    
    return {
      type: "settings.got",
      settings: state as any
    }
  }

  private async handleUpdateSettings(message: SettingsMessages.Update): Promise<SettingsResponses.Updated> {
    const getGlobalState = <K extends keyof RooCodeSettings>(key: K) => 
      this.provider.contextProxy.getValue(key)
    
    for (const [key, value] of Object.entries(message.settings)) {
      let newValue = value

      if (key === "language") {
        newValue = value ?? "en"
        changeLanguage(newValue as Language)
      } else if (key === "allowedCommands") {
        const commands = value ?? []

        newValue = Array.isArray(commands)
          ? commands.filter((cmd): cmd is string => typeof cmd === "string" && cmd.trim().length > 0)
          : []

        await vscode.workspace
          .getConfiguration(Package.name)
          .update("allowedCommands", newValue, vscode.ConfigurationTarget.Global)
      } else if (key === "deniedCommands") {
        const commands = value ?? []

        newValue = Array.isArray(commands)
          ? commands.filter((cmd): cmd is string => typeof cmd === "string" && cmd.trim().length > 0)
          : []

        await vscode.workspace
          .getConfiguration(Package.name)
          .update("deniedCommands", newValue, vscode.ConfigurationTarget.Global)
      } else if (key === "ttsEnabled") {
        newValue = value ?? true
        setTtsEnabled(newValue as boolean)
      } else if (key === "ttsSpeed") {
        newValue = value ?? 1.0
        setTtsSpeed(newValue as number)
      } else if (key === "terminalShellIntegrationTimeout") {
        if (value !== undefined) {
          Terminal.setShellIntegrationTimeout(value as number)
        }
      } else if (key === "terminalShellIntegrationDisabled") {
        if (value !== undefined) {
          Terminal.setShellIntegrationDisabled(value as boolean)
        }
      } else if (key === "terminalCommandDelay") {
        if (value !== undefined) {
          Terminal.setCommandDelay(value as number)
        }
      } else if (key === "terminalPowershellCounter") {
        if (value !== undefined) {
          Terminal.setPowershellCounter(value as boolean)
        }
      } else if (key === "terminalZshClearEolMark") {
        if (value !== undefined) {
          Terminal.setTerminalZshClearEolMark(value as boolean)
        }
      } else if (key === "terminalZshOhMy") {
        if (value !== undefined) {
          Terminal.setTerminalZshOhMy(value as boolean)
        }
      } else if (key === "terminalZshP10k") {
        if (value !== undefined) {
          Terminal.setTerminalZshP10k(value as boolean)
        }
      } else if (key === "terminalZdotdir") {
        if (value !== undefined) {
          Terminal.setTerminalZdotdir(value as boolean)
        }
      } else if (key === "terminalCompressProgressBar") {
        if (value !== undefined) {
          Terminal.setCompressProgressBar(value as boolean)
        }
      } else if (key === "mcpEnabled") {
        newValue = value ?? true
        const mcpHub = this.provider.getMcpHub()

        if (mcpHub) {
          await mcpHub.handleMcpEnabledChange(newValue as boolean)
        }
      } else if (key === "experiments") {
        if (!value) {
          continue
        }

        newValue = {
          ...(getGlobalState("experiments") ?? experimentDefault),
          ...(value as Record<ExperimentId, boolean>),
        }
      } else if (key === "customSupportPrompts") {
        if (!value) {
          continue
        }
      }

      await this.provider.contextProxy.setValue(key as keyof RooCodeSettings, newValue)
    }

    await this.provider.postStateToWebview()
    
    return {
      type: "settings.updated",
      settings: message.settings
    }
  }

  private async handleUpdateCustomInstructions(message: SettingsMessages.UpdateCustomInstructions): Promise<SettingsResponses.CustomInstructionsUpdated> {
    await this.provider.updateCustomInstructions(message.text)
    
    return {
      type: "settings.customInstructionsUpdated",
      text: message.text
    }
  }

  private async handleUpdateMode(message: SettingsMessages.UpdateMode): Promise<SettingsResponses.ModeUpdated> {
    await this.provider.setMode(message.mode)
    
    return {
      type: "settings.modeUpdated",
      mode: message.mode
    }
  }
}