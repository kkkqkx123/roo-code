import type OpenAI from "openai"

const GET_WORKSPACE_DIAGNOSTICS_BASE_DESCRIPTION = `Query diagnostic information for specific files, folders, or the entire workspace. Returns detailed diagnostic data including severity, source, code, and location information.`

export function createGetWorkspaceDiagnosticsTool(): OpenAI.Chat.ChatCompletionTool {
  const description = GET_WORKSPACE_DIAGNOSTICS_BASE_DESCRIPTION + 
    ` Structure: { targets?: string[], severity?: ("error"|"warning"|"information"|"hint")[], sources?: string[], codes?: (string|number)[], maxResults?: number, includeRelatedInformation?: boolean, includeTags?: boolean, sortBy?: ("severity"|"file"|"line"|"source"), summaryOnly?: boolean }. ` +
    `Example: { targets: ["src/"], severity: ["error", "warning"], maxResults: 50 }`

  return {
    type: "function",
    function: {
      name: "get_workspace_diagnostics",
      description,
      strict: true,
      parameters: {
        type: "object",
        properties: {
          targets: {
            type: "array",
            description: "File paths, folder paths, or glob patterns to get diagnostics for. If not provided, gets diagnostics for entire workspace",
            items: {
              type: "string"
            }
          },
          severity: {
            type: "array",
            description: "Diagnostic severities to include. Default: ['error', 'warning']",
            items: {
              type: "string",
              enum: ["error", "warning", "information", "hint"]
            }
          },
          sources: {
            type: "array",
            description: "Diagnostic sources to filter by (e.g., 'typescript', 'eslint')",
            items: {
              type: "string"
            }
          },
          codes: {
            type: "array",
            description: "Diagnostic codes to filter by (e.g., 'TS2532', 'no-unused-vars')",
            items: {
              type: "string"
            }
          },
          maxResults: {
            type: "number",
            description: "Maximum number of diagnostic results to return. Default: 100"
          },
          includeRelatedInformation: {
            type: "boolean",
            description: "Whether to include related diagnostic information. Default: false"
          },
          includeTags: {
            type: "boolean",
            description: "Whether to include diagnostic tags. Default: false"
          },
          sortBy: {
            type: "string",
            description: "Sort order for results. Default: 'severity'",
            enum: ["severity", "file", "line", "source"]
          },
          summaryOnly: {
            type: "boolean",
            description: "Whether to return only summary information. Default: false"
          }
        },
        required: [],
        additionalProperties: false
      }
    }
  } satisfies OpenAI.Chat.ChatCompletionTool
}

export const get_workspace_diagnostics = createGetWorkspaceDiagnosticsTool()