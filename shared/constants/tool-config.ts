import type { ToolGroup, ToolName } from "../types"

export const toolParamNames = [
	"command",
	"path",
	"content",
	"regex",
	"file_pattern",
	"recursive",
	"action",
	"url",
	"coordinate",
	"text",
	"server_name",
	"tool_name",
	"arguments",
	"uri",
	"question",
	"result",
	"diff",
	"mode_slug",
	"reason",
	"line",
	"mode",
	"message",
	"cwd",
	"follow_up",
	"task",
	"size",
	"query",
	"args",
	"start_line",
	"end_line",
	"todos",
	"prompt",
	"image",
	"files",
	"operations",
	"patch",
	"file_path",
	"old_string",
	"new_string",
	"expected_replacements",
] as const

export const TOOL_GROUPS: Record<ToolGroup, { tools: readonly string[]; alwaysAvailable?: boolean; customTools?: readonly string[]; description?: string }> = {
	read: {
		tools: ["read_file", "fetch_instructions", "search_files", "list_files", "codebase_search", "get_workspace_diagnostics"],
	},
	edit: {
		tools: ["apply_diff", "write_to_file"],
		customTools: ["search_and_replace", "search_replace", "edit_file", "apply_patch"],
	},
	browser: {
		tools: ["browser_action"],
	},
	command: {
		tools: ["execute_command"],
	},
	mcp: {
		tools: ["use_mcp_tool", "access_mcp_resource"],
	},
	modes: {
		tools: ["switch_mode", "new_task"],
		alwaysAvailable: true,
	},
	coordinator: {
		tools: ["switch_mode", "new_task"],
		description: "Tools for mode coordination and switching",
	},
}

export const ALWAYS_AVAILABLE_TOOLS: ToolName[] = [
	"ask_followup_question",
	"attempt_completion",
	"new_task",
	"update_todo_list",
	"run_slash_command",
] as const

export const TOOL_ALIASES: Record<string, ToolName> = {
	write_file: "write_to_file",
} as const
