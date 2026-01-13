import { ToolArgs } from "./types"

export function getGetWorkspaceDiagnosticsDescription(args: ToolArgs): string {
  const maxResults = args.settings?.maxDiagnosticMessages ?? 100
  
  return `## get_workspace_diagnostics
Description: Request diagnostic information for specific files, folders, or the entire workspace. This tool queries VSCode's diagnostic API to retrieve error, warning, and other diagnostic information for the specified targets. It provides detailed diagnostic data including severity, source, code, and location information.

Parameters:
- targets: (optional) Array of file paths, folder paths, or glob patterns to get diagnostics for. If not provided, gets diagnostics for the entire workspace.
- severity: (optional) Array of diagnostic severities to include. Options: ["error", "warning", "information", "hint"]. Default: ["error", "warning"]
- sources: (optional) Array of diagnostic sources to filter by (e.g., "typescript", "eslint"). Default: all sources
- codes: (optional) Array of diagnostic codes to filter by (e.g., "TS2532", "no-unused-vars"). Default: all codes
- maxResults: (optional) Maximum number of diagnostic results to return. Default: ${maxResults}
- includeRelatedInformation: (optional) Whether to include related diagnostic information. Default: false
- includeTags: (optional) Whether to include diagnostic tags. Default: false
- sortBy: (optional) Sort order for results. Options: ["severity", "file", "line", "source"]. Default: "severity"
- summaryOnly: (optional) Whether to return only summary information. Default: false

Usage:
<get_workspace_diagnostics>
<args>
  <targets>
    <target>src/</target>
    <target>tests/*.ts</target>
  </targets>
  <severity>
    <level>error</level>
    <level>warning</level>
  </severity>
  <sources>
    <source>typescript</source>
  </sources>
  <maxResults>50</maxResults>
  <summaryOnly>false</summaryOnly>
</args>
</get_workspace_diagnostics>

Examples:

1. Get diagnostics for entire workspace:
<get_workspace_diagnostics>
<args>
</args>
</get_workspace_diagnostics>

2. Get error diagnostics for specific folder:
<get_workspace_diagnostics>
<args>
  <targets>
    <target>src/components/</target>
  </targets>
  <severity>
    <level>error</level>
  </severity>
</args>
</get_workspace_diagnostics>

3. Get diagnostics with specific sources and codes:
<get_workspace_diagnostics>
<args>
  <targets>
    <target>src/main.ts</target>
  </targets>
  <sources>
    <source>typescript</source>
    <source>eslint</source>
  </sources>
  <codes>
    <code>TS2532</code>
    <code>no-unused-vars</code>
  </codes>
  <maxResults>20</maxResults>
</args>
</get_workspace_diagnostics>

4. Get summary diagnostics for multiple files:
<get_workspace_diagnostics>
<args>
  <targets>
    <target>src/file1.ts</target>
    <target>src/file2.ts</target>
  </targets>
  <summaryOnly>true</summaryOnly>
</args>
</get_workspace_diagnostics>

IMPORTANT: You MUST use this diagnostic query strategy:
- Use specific targets to focus on relevant areas of code
- Filter by severity to focus on most critical issues first
- Use maxResults to prevent overwhelming diagnostic output
- Use summaryOnly for high-level diagnostic overview
- Combine with other tools like read_file to get context for diagnostic issues`
}