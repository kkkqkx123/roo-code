import { MessageBusServer } from "../MessageBusServer"
import { ClineProvider } from "../../webview/ClineProvider"
import type { CheckpointMessages } from "../MessageTypes"
import type { CheckpointResponses } from "../MessageTypes"
import pWaitFor from "p-wait-for"
import * as vscode from "vscode"
import { t } from "../../../i18n"

export class CheckpointHandlers {
  constructor(
    private messageBus: MessageBusServer,
    private provider: ClineProvider
  ) {
    this.registerHandlers()
  }

  private registerHandlers(): void {
    this.messageBus.register("checkpoint.diff", this.handleDiff.bind(this))
    this.messageBus.register("checkpoint.restore", this.handleRestore.bind(this))
  }

  private async handleDiff(message: CheckpointMessages.Diff): Promise<CheckpointResponses.DiffResult> {
    const currentTask = this.provider.getCurrentTask()
    if (!currentTask) {
      throw new Error("No active task")
    }

    const diff = await currentTask.checkpointDiff({
      commitHash: message.commitHash,
      mode: message.mode,
      ts: message.ts,
      previousCommitHash: message.previousCommitHash
    })
    
    return {
      type: "checkpoint.diffResult",
      diff
    }
  }

  private async handleRestore(message: CheckpointMessages.Restore): Promise<CheckpointResponses.Restored> {
    const { ts, commitHash, mode } = message
    
    if (mode === "restore") {
      const cancelResult = await this.provider.cancelTask()
      if (!cancelResult.success) {
        console.error(`[CheckpointHandlers] Failed to cancel task during checkpoint restore: ${cancelResult.error}`)
      }

      try {
        await pWaitFor(() => this.provider.getCurrentTask()?.isInitialized === true, { timeout: 3_000 })
      } catch (error) {
        vscode.window.showErrorMessage(t("common:errors.checkpoint_timeout"))
      }
    }

    try {
      const currentTask = this.provider.getCurrentTask()
      if (!currentTask) {
        throw new Error("No active task")
      }

      await currentTask.checkpointRestore({
        ts,
        commitHash,
        mode,
        operation: "delete"
      })
    } catch (error) {
      vscode.window.showErrorMessage(t("common:errors.checkpoint_failed"))
      throw error
    }
    
    return {
      type: "checkpoint.restored",
      commitHash: message.commitHash
    }
  }
}