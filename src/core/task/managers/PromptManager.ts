import * as vscode from "vscode"

import { SYSTEM_PROMPT } from "../../prompts/system"
import { getModelId, type ProviderSettings } from "@roo-code/types"
import type { ModeConfig, CustomModePrompts, TodoItem } from "@roo-code/types"
import { DiffStrategy } from "../../../shared/tools"
import { McpHub } from "../../../services/mcp/McpHub"
import { RooIgnoreController } from "../../ignore/RooIgnoreController"
import type { ClineProvider } from "../../webview/ClineProvider"

export interface PromptManagerOptions {
	providerRef: WeakRef<ClineProvider>
	taskId: string
	workspacePath: string
	diffStrategy?: DiffStrategy
	rooIgnoreController?: RooIgnoreController
}

export class PromptManager {
	readonly taskId: string
	private providerRef: WeakRef<ClineProvider>
	private workspacePath: string
	private diffStrategy?: DiffStrategy
	private rooIgnoreController?: RooIgnoreController

	constructor(options: PromptManagerOptions) {
		this.taskId = options.taskId
		this.providerRef = options.providerRef
		this.workspacePath = options.workspacePath
		this.diffStrategy = options.diffStrategy
		this.rooIgnoreController = options.rooIgnoreController
	}

	public async getSystemPrompt(
		apiConfiguration?: Partial<ProviderSettings>,
		todoList?: TodoItem[],
		diffEnabled?: boolean,
	): Promise<string> {
		const provider = this.providerRef.deref()
		if (!provider) {
			throw new Error("Provider reference lost")
		}

		const state = await provider.getState()
		const mcpEnabled = state?.mcpEnabled ?? true

		if (mcpEnabled) {
			const mcpHub = provider.getMcpHub()
			if (!mcpHub) {
				throw new Error("MCP Hub not available")
			}

			const mcpServers = mcpHub.getServers()
			const mcpTools = mcpServers.flatMap((server) => server.tools ?? [])

			return SYSTEM_PROMPT(
				provider.context,
				this.workspacePath,
				state?.browserToolEnabled ?? true,
				mcpHub,
				this.diffStrategy,
				state?.browserViewportSize ?? "900x600",
				state?.mode ?? "code",
				state?.customModePrompts,
				undefined,
				state?.customInstructions,
				diffEnabled,
				state?.experiments,
				state?.enableMcpServerCreation,
				state?.language,
				this.rooIgnoreController?.getInstructions(),
				state?.maxReadFileLine !== -1,
				{
					maxConcurrentFileReads: state?.maxConcurrentFileReads ?? 5,
					todoListEnabled: apiConfiguration?.todoListEnabled ?? true,
					browserToolEnabled: state?.browserToolEnabled ?? true,
					useAgentRules: vscode.workspace.getConfiguration("roo-code").get<boolean>("useAgentRules") ?? true,
					newTaskRequireTodos: vscode.workspace.getConfiguration("roo-code").get<boolean>("newTaskRequireTodos") ?? false,
				},
				todoList ?? [],
				apiConfiguration ? getModelId(apiConfiguration) : undefined,
			)
		}

		return SYSTEM_PROMPT(
			provider.context,
			this.workspacePath,
			state?.browserToolEnabled ?? true,
			undefined,
			this.diffStrategy,
			state?.browserViewportSize ?? "900x600",
			state?.mode ?? "code",
			state?.customModePrompts,
			undefined,
			state?.customInstructions,
			diffEnabled,
			state?.experiments,
			state?.enableMcpServerCreation,
			state?.language,
			this.rooIgnoreController?.getInstructions(),
			state?.maxReadFileLine !== -1,
			{
				maxConcurrentFileReads: state?.maxConcurrentFileReads ?? 5,
				todoListEnabled: apiConfiguration?.todoListEnabled ?? true,
				browserToolEnabled: state?.browserToolEnabled ?? true,
				useAgentRules: vscode.workspace.getConfiguration("roo-code").get<boolean>("useAgentRules") ?? true,
				newTaskRequireTodos: vscode.workspace.getConfiguration("roo-code").get<boolean>("newTaskRequireTodos") ?? false,
			},
			todoList ?? [],
			apiConfiguration ? getModelId(apiConfiguration) : undefined,
		)
	}

	public applyCustomPrompt(basePrompt: string, customPrompt: string): string {
		if (!customPrompt || customPrompt.trim() === "") {
			return basePrompt
		}

		return `${basePrompt}

${customPrompt}`
	}

	public async getPromptTemplate(mode: string): Promise<string> {
		const provider = this.providerRef.deref()
		if (!provider) {
			throw new Error("Provider reference lost")
		}

		const state = await provider.getState()
		const customModePrompts = state?.customModePrompts

		if (!customModePrompts) {
			return ""
		}

		const promptComponent = customModePrompts[mode]
		if (!promptComponent) {
			return ""
		}

		const { roleDefinition, customInstructions } = promptComponent

		if (!roleDefinition && !customInstructions) {
			return ""
		}

		return `${roleDefinition || ""}

${customInstructions || ""}`.trim()
	}
}
