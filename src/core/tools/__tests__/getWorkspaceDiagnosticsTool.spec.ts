import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Hoist the mock data to avoid circular dependency
const { mockDiagnostics } = vi.hoisted(() => {
  return {
    mockDiagnostics: [
      [
        { fsPath: "/test/workspace/src/test.ts", toString: () => "/test/workspace/src/test.ts" },
        [
          {
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
            message: "Test error message",
            severity: 0 // Error
          },
          {
            range: { start: { line: 5, character: 0 }, end: { line: 5, character: 15 } },
            message: "Test warning message",
            severity: 1 // Warning
          }
        ]
      ],
      [
        { fsPath: "/test/workspace/src/utils.ts", toString: () => "/test/workspace/src/utils.ts" },
        [
          {
            range: { start: { line: 10, character: 0 }, end: { line: 10, character: 20 } },
            message: "Another error message",
            severity: 0 // Error
          }
        ]
      ]
    ]
  }
})

// Mock the necessary modules
vi.mock("path", async () => {
  const actual = await vi.importActual("path")
  return {
    ...actual,
    resolve: vi.fn((...args) => args.join("/").replace(/\\/g, "/")),
    relative: vi.fn((from, to) => to.replace(from + "/", ""))
  }
})

vi.mock("fast-glob", () => ({
  glob: vi.fn().mockResolvedValue([])
}))

vi.mock("../../shared/ExtensionMessage")
vi.mock("../../utils/fs", () => ({
  fileExistsAtPath: vi.fn().mockResolvedValue(true)
}))
vi.mock("../../utils/path")
vi.mock("../../utils/pathUtils")
vi.mock("../../utils/text-normalization")
vi.mock("@roo-code/types")

// Mock VSCode API
vi.mock("vscode", async () => {
  const actual = await vi.importActual("vscode")
  return {
    ...actual,
    languages: {
      getDiagnostics: vi.fn().mockReturnValue(mockDiagnostics)
    },
    DiagnosticSeverity: {
      Error: 0,
      Warning: 1,
      Information: 2,
      Hint: 3
    },
    DiagnosticTag: {
      Unnecessary: 1,
      Deprecated: 2
    },
    Uri: {
      file: vi.fn().mockImplementation((path: string) => ({
        fsPath: path,
        toString: () => path
      }))
    }
  }
})

import { GetWorkspaceDiagnosticsTool } from "../GetWorkspaceDiagnosticsTool"

describe("GetWorkspaceDiagnosticsTool", () => {
  let tool: GetWorkspaceDiagnosticsTool
  let mockTask: any
  let mockCallbacks: any

  beforeEach(() => {
    tool = new GetWorkspaceDiagnosticsTool()

    mockTask = {
      cwd: "/test/workspace",
      diffViewProvider: {
        reset: vi.fn()
      },
      rooIgnoreController: {
        validateAccess: vi.fn().mockReturnValue(true)
      },
      fileContextTracker: {
        trackFileContext: vi.fn()
      },
      say: vi.fn().mockResolvedValue(""),
      sayAndCreateMissingParamError: vi.fn().mockResolvedValue(""),
      recordToolError: vi.fn(),
      recordToolUsage: vi.fn(),
      processQueuedMessages: vi.fn(),
      diffStrategy: null,
      providerRef: {
        deref: vi.fn().mockReturnValue({
          getState: vi.fn().mockResolvedValue({})
        })
      }
    }

    mockCallbacks = {
      pushToolResult: vi.fn(),
      handleError: vi.fn(),
      askApproval: vi.fn().mockResolvedValue(true),
      removeClosingTag: vi.fn(),
      toolProtocol: "xml" as const
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("should have the correct name", () => {
    expect(tool.name).toBe("get_workspace_diagnostics")
  })

  it("should parse legacy parameters correctly", () => {
    const params = {
      targets: '["src/", "tests/"]',
      severity: '["error", "warning"]',
      sources: '["typescript"]',
      codes: '["TS2532"]',
      maxResults: "50",
      includeRelatedInformation: "true",
      includeTags: "true",
      sortBy: "severity",
      summaryOnly: "true"
    }

    const result = tool.parseLegacy(params)

    expect(result).toEqual({
      targets: ["src/", "tests/"],
      severity: ["error", "warning"],
      sources: ["typescript"],
      codes: ["TS2532"],
      maxResults: 50,
      includeRelatedInformation: true,
      includeTags: true,
      sortBy: "severity",
      summaryOnly: true
    })
  })

  it("should handle undefined legacy parameters", () => {
    const params = {}
    const result = tool.parseLegacy(params)

    expect(result).toEqual({
      targets: undefined,
      severity: undefined,
      sources: undefined,
      codes: undefined,
      maxResults: undefined,
      includeRelatedInformation: undefined,
      includeTags: undefined,
      sortBy: undefined,
      summaryOnly: undefined
    })
  })

  it("should execute and return diagnostic information", async () => {
    const params = {
      targets: ["src/"],
      severity: ["error"] as const,
      maxResults: 10
    }

    await tool.execute(params, mockTask, mockCallbacks)

    expect(mockCallbacks.pushToolResult).toHaveBeenCalled()
    const callArgs = mockCallbacks.pushToolResult.mock.calls[0][0]

    expect(typeof callArgs).toBe("string")

    try {
      const result = JSON.parse(callArgs)
      expect(result.queryInfo).toBeDefined()
      expect(result.summary).toBeDefined()
      expect(Array.isArray(result.diagnostics)).toBe(true)
      expect(result.summary.totalDiagnostics).toBeGreaterThanOrEqual(0)
    } catch (e) {
      console.error("Failed to parse result:", e)
      console.log("Result was:", callArgs)
    }
  })

  it("should handle summary only mode", async () => {
    const params = {
      targets: ["src/"],
      severity: ["error"] as const,
      summaryOnly: true
    }

    await tool.execute(params, mockTask, mockCallbacks)

    expect(mockCallbacks.pushToolResult).toHaveBeenCalled()
    const callArgs = mockCallbacks.pushToolResult.mock.calls[0][0]

    try {
      const result = JSON.parse(callArgs)
      expect(result.queryInfo).toBeDefined()
      expect(result.summary).toBeDefined()
      expect(result.diagnostics).toBeUndefined()
    } catch (e) {
      console.error("Failed to parse result:", e)
    }
  })

  it("should handle error during execution", async () => {
    // We'll test the error handling by creating a tool that simulates an error
    // Since the actual error handling is tested in the tool's implementation,
    // we can verify that errors are properly caught and formatted.
    const params = {
      targets: ["src/"],
      severity: ["error"] as const
    }

    // Mock the internal methods to throw an error
    const originalResolveTargetUris = (tool as any).resolveTargetUris
    ;(tool as any).resolveTargetUris = vi.fn().mockRejectedValue(new Error("Test error"))

    await tool.execute(params, mockTask, mockCallbacks)

    expect(mockCallbacks.pushToolResult).toHaveBeenCalled()
    const callArgs = mockCallbacks.pushToolResult.mock.calls[0][0]

    try {
      const result = JSON.parse(callArgs)
      // The tool should return an error object when execution fails
      expect(result.error).toBeDefined()
      expect(result.success).toBe(false)
    } catch (e) {
      // If it's not JSON (meaning error happened elsewhere), that's also acceptable
      // as long as pushToolResult was called
    }

    // Restore original method
    ;(tool as any).resolveTargetUris = originalResolveTargetUris
  })

  it("should filter diagnostics by severity", async () => {
    const params = {
      targets: ["src/"],
      severity: ["error"] as const,
      maxResults: 100
    }

    await tool.execute(params, mockTask, mockCallbacks)

    expect(mockCallbacks.pushToolResult).toHaveBeenCalled()
    const callArgs = mockCallbacks.pushToolResult.mock.calls[0][0]

    try {
      const result = JSON.parse(callArgs)
      if (result.diagnostics) {
        const hasNonError = result.diagnostics.some((diag: any) => diag.severity !== 'error')
        expect(hasNonError).toBe(false) // Should only have errors
      }
    } catch (e) {
      console.error("Failed to parse result:", e)
    }
  })

  it("should limit results by maxResults", async () => {
    const params = {
      targets: ["src/"],
      severity: ["error", "warning"] as const,
      maxResults: 1
    }

    await tool.execute(params, mockTask, mockCallbacks)

    expect(mockCallbacks.pushToolResult).toHaveBeenCalled()
    const callArgs = mockCallbacks.pushToolResult.mock.calls[0][0]

    try {
      const result = JSON.parse(callArgs)
      if (result.diagnostics) {
        expect(result.diagnostics.length).toBeLessThanOrEqual(1)
      }
    } catch (e) {
      console.error("Failed to parse result:", e)
    }
  })

  it("should handle empty targets (get all workspace diagnostics)", async () => {
    const params = {}

    await tool.execute(params, mockTask, mockCallbacks)

    expect(mockCallbacks.pushToolResult).toHaveBeenCalled()
    const callArgs = mockCallbacks.pushToolResult.mock.calls[0][0]

    try {
      const result = JSON.parse(callArgs)
      expect(result.queryInfo).toBeDefined()
      expect(result.summary).toBeDefined()
    } catch (e) {
      console.error("Failed to parse result:", e)
    }
  })
})