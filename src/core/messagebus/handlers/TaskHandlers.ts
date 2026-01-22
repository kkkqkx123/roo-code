import { MessageBusServer } from "../MessageBusServer"
import { ClineProvider } from "../../webview/ClineProvider"
import type { TaskMessages } from "../MessageTypes"
import type { TaskResponses } from "../MessageTypes"
import * as vscode from "vscode"

export class TaskHandlers {
  constructor(
    private messageBus: MessageBusServer,
    private provider: ClineProvider
  ) {
    this.registerHandlers()
  }

  private registerHandlers(): void {
    this.messageBus.register("task.create", this.handleCreateTask.bind(this))
    this.messageBus.register("task.cancel", this.handleCancelTask.bind(this))
    this.messageBus.register("task.clear", this.handleClearTask.bind(this))
    this.messageBus.register("task.askResponse", this.handleAskResponse.bind(this))
  }

  private async handleCreateTask(message: TaskMessages.Create): Promise<TaskResponses.Created> {
    try {
      const task = await this.provider.createTask(message.text, message.images)
      
      await this.provider.postStateToWebview()
      await this.provider.postMessageToWebview({ type: "invoke", invoke: "newChat" })
      
      return {
        type: "task.created",
        taskId: task.taskId
      }
    } catch (error) {
      await this.provider.postMessageToWebview({ type: "invoke", invoke: "newChat" })
      vscode.window.showErrorMessage(
        `Failed to create task: ${error instanceof Error ? error.message : String(error)}`
      )
      throw error
    }
  }

  private async handleCancelTask(message: TaskMessages.Cancel): Promise<TaskResponses.Cancelled> {
    const currentTask = this.provider.getCurrentTask()
    if (currentTask && currentTask.taskId === message.taskId) {
      currentTask.cancelCurrentRequest()
    }
    
    return {
      type: "task.cancelled",
      taskId: message.taskId
    }
  }

  private async handleClearTask(message: TaskMessages.Clear): Promise<TaskResponses.Cleared> {
    await this.provider.clearTask()
    
    return {
      type: "task.cleared"
    }
  }

  private async handleAskResponse(message: TaskMessages.AskResponse): Promise<void> {
    const currentTask = this.provider.getCurrentTask()
    if (currentTask) {
      currentTask.handleWebviewAskResponse(message.askResponse, message.text, message.images)
    }
  }
}