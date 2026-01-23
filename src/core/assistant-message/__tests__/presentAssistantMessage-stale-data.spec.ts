import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { writeToFileTool } from "../../tools/WriteToFileTool"
import type { ToolUse } from "@shared/types/tool-config"

// Mock the Task class with minimal implementation for testing
const mockTask: any = {
	cwd: "/test",
	taskId: "test",
	instanceId: "test",
	
	// Mock arrays and methods
	assistantMessageContent: [],
	userMessageContent: [],
	consecutiveMistakeCount: 0,
	
	getCurrentStreamingContentIndex: vi.fn(() => 0),
	setCurrentStreamingContentIndex: vi.fn(),
	getAssistantMessageContent: vi.fn(() => mockTask.assistantMessageContent),
	getUserMessageContent: vi.fn(() => mockTask.userMessageContent),
	hasCompletedReadingStream: vi.fn(() => true),
	setPresentAssistantMessageLocked: vi.fn(),
	isPresentAssistantMessageLocked: vi.fn(() => false),
	setPresentAssistantMessageHasPendingUpdates: vi.fn(),
	hasPresentAssistantMessagePendingUpdates: vi.fn(() => false),
	recordToolUsage: vi.fn(),
	recordToolError: vi.fn(),
	getDidRejectTool: vi.fn(() => false),
	setDidRejectTool: vi.fn(),
	getDidAlreadyUseTool: vi.fn(() => false),
	setDidAlreadyUseTool: vi.fn(),
	setUserMessageContentReady: vi.fn(),
	ask: vi.fn(async () => ({ response: "yesButtonClicked", text: "", images: [] })),
	say: vi.fn(async () => {}),
	sayAndCreateMissingParamError: vi.fn(async () => "missing param error"),
	didEditFile: false,
	fileContextTracker: { trackFileContext: vi.fn() },
	diffViewProvider: {
		editType: undefined,
		isEditing: false,
		originalContent: "",
		open: vi.fn(),
		update: vi.fn(),
		saveChanges: vi.fn(),
		revertChanges: vi.fn(),
		reset: vi.fn(),
		pushToolWriteResult: vi.fn(async () => "tool result"),
		setRelPath: vi.fn(),
		scrollToFirstDiff: vi.fn(),
		saveDirectly: vi.fn()
	},
	providerRef: {
		deref: vi.fn(() => ({
			getState: vi.fn(async () => ({ 
				experiments: {}, 
				diagnosticsEnabled: true, 
				writeDelayMs: 100,
				mode: "code",
				customModes: []
			})),
			postMessageToWebview: vi.fn(),
			getMcpHub: vi.fn()
		}))
	},
	api: {
		getModel: vi.fn(() => ({ id: "claude-3" }))
	},
	rooIgnoreController: { validateAccess: vi.fn(() => true) },
	rooProtectedController: { isWriteProtected: vi.fn(() => false) },
	processQueuedMessages: vi.fn()
}

describe("WriteToFileTool - Path Stabilization During Streaming", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		// Reset the tool's partial state before each test
		writeToFileTool.resetPartialState()
	})

	afterEach(() => {
		vi.restoreAllMocks()
		vi.useRealTimers()
	})

	it("should track path stabilization during streaming", async () => {
		const task = mockTask
		
		// Simulate a scenario where path evolves during streaming
		const extendingBlock: ToolUse<"write_to_file"> = {
			type: "tool_use" as const,
			name: "write_to_file",
			params: { path: "/core/prompts/sec", content: "test content" },
			partial: true,
			id: "test-id"
		}
		
		// First partial update - should track the path
		await writeToFileTool.handlePartial(task, extendingBlock)
		
		// Verify that the tool is tracking the path
		expect(writeToFileTool['lastSeenPartialPath']).toBe("/core/prompts/sec")
	})

	it("should handle path extension during streaming", async () => {
		const task = mockTask
		
		// First partial update with shorter path
		const partialBlock1: ToolUse<"write_to_file"> = {
			type: "tool_use" as const,
			name: "write_to_file",
			params: { path: "/core/prompts/sec", content: "content1" },
			partial: true,
			id: "test-id"
		}
		
		// Second partial update with extended path
		const partialBlock2: ToolUse<"write_to_file"> = {
			type: "tool_use" as const,
			name: "write_to_file",
			params: { path: "/core/prompts/sections", content: "content1content2" },
			partial: true,
			id: "test-id"
		}
		
		// Process first block
		await writeToFileTool.handlePartial(task, partialBlock1)
		expect(writeToFileTool['lastSeenPartialPath']).toBe("/core/prompts/sec")
		
		// Process second block - should detect extension
		await writeToFileTool.handlePartial(task, partialBlock2)
		expect(writeToFileTool['lastSeenPartialPath']).toBe("/core/prompts/sections")
	})

	it("should defer directory creation for extending paths", async () => {
		const task = mockTask
		
		// Simulate a partial block with an extending path
		const partialBlock: ToolUse<"write_to_file"> = {
			type: "tool_use" as const,
			name: "write_to_file",
			params: { path: "/core/prompts/sec", content: "partial content" },
			partial: true,
			id: "test-id"
		}
		
		// Process the partial block
		await writeToFileTool.handlePartial(task, partialBlock)
		
		// The path should be tracked
		expect(writeToFileTool['lastSeenPartialPath']).toBe("/core/prompts/sec")
	})

	it("should reset partial state after complete block execution", async () => {
	const task = mockTask
		
		// Set up a partial state first
		const partialBlock: ToolUse<"write_to_file"> = {
			type: "tool_use" as const,
			name: "write_to_file",
			params: { path: "/core/prompts/sections/skills.ts", content: "final content" },
			partial: true,
			id: "test-id"
		}
		
		await writeToFileTool.handlePartial(task, partialBlock)
		expect(writeToFileTool['lastSeenPartialPath']).toBe("/core/prompts/sections/skills.ts")
		
		// Test that resetPartialState clears the tracked path
		writeToFileTool.resetPartialState()
		expect(writeToFileTool['lastSeenPartialPath']).toBeUndefined()
	})

	it("should maintain path tracking across multiple streaming updates", async () => {
		const task = mockTask
		
		// Simulate incremental path updates
		const pathUpdates = [
			"/core/",
			"/core/p", 
			"/core/pr",
			"/core/prom",
			"/core/prompts",
			"/core/prompts/",
			"/core/prompts/s",
			"/core/prompts/skills.ts"
		]
		
		// Process each incremental update
		for (let i = 0; i < pathUpdates.length; i++) {
			const block: ToolUse<"write_to_file"> = {
				type: "tool_use" as const,
				name: "write_to_file",
				params: { path: pathUpdates[i], content: `content${i}` },
				partial: true,
				id: `test-id-${i}`
			}
			
			await writeToFileTool.handlePartial(task, block)
			expect(writeToFileTool['lastSeenPartialPath']).toBe(pathUpdates[i])
		}
	})
})