# Mode Tool Coordination Implementation Guide

## Overview

This guide provides detailed implementation steps for fixing the mode switch tool design issues in Roo Code. The main problems are:

1. `switch_mode` tool is available to all modes instead of only coordinator mode
2. `ask_followup_question` tool includes mode selection parameters that should be removed

## Current State Analysis

### Problem 1: Universal switch_mode Tool Access

Currently, the `switch_mode` tool is available in all modes through the tool filtering system. This violates the architectural principle that mode coordination should be centralized.

**Files affected:**
- [`src/core/prompts/tools/filter-tools-for-mode.ts`](file:///d:\项目\agent\Roo-Code\src\core\prompts\tools\filter-tools-for-mode.ts:1-453)
- [`src/core/tools/SwitchModeTool.ts`](file:///d:\项目\agent\Roo-Code\src\core\tools\SwitchModeTool.ts:1-94)

### Problem 2: ask_followup_question Mode Parameter

The `ask_followup_question` tool includes a `mode` parameter in suggestions, allowing modes to embed mode switching in their questions.

**Files affected:**
- [`src/core/tools/AskFollowupQuestionTool.ts`](file:///d:\项目\agent\Roo-Code\src\core\tools\AskFollowupQuestionTool.ts:1-106)
- [`src/core/prompts/tools/native-tools/ask_followup_question.ts`](file:///d:\项目\agent\Roo-Code\src\core\prompts\tools\native-tools\ask_followup_question.ts:1-62)

## Implementation Steps

### Step 1: Create Coordinator Mode Configuration

**File:** `src/shared/modes.ts` (add to existing file)

```typescript
// Add coordinator mode to the modes configuration
export const coordinatorMode: ModeConfig = {
    slug: 'coordinator',
    name: 'Coordinator',
    roleDefinition: 'Coordinate between different modes and handle mode transitions. This mode should only be used for managing mode switches and coordinating task delegation.',
    groups: ['coordinator', 'read', 'browser', 'mcp'], // Coordinator tools + basic tools
    description: 'Central coordinator for mode management and task delegation',
    whenToUse: 'When you need to coordinate between different modes or handle mode transitions',
    customInstructions: 'Focus on mode coordination and switching. Do not perform actual development tasks in this mode.'
}

// Update getAllModes to include coordinator mode
export function getAllModes(customModes?: ModeConfig[]): ModeConfig[] {
    const baseModes = [...modes, coordinatorMode] // Include coordinator mode
    
    if (!customModes?.length) {
        return baseModes
    }

    // Process custom modes (existing logic)
    const allModes = [...baseModes]
    customModes.forEach((customMode) => {
        const index = allModes.findIndex((mode) => mode.slug === customMode.slug)
        if (index !== -1) {
            allModes[index] = customMode
        } else {
            allModes.push(customMode)
        }
    })

    return allModes
}
```

### Step 2: Add Coordinator Tool Group

**File:** `src/shared/tools.ts` (create or update)

```typescript
// Add coordinator tool group
export const TOOL_GROUPS = {
    // ... existing groups
    coordinator: {
        tools: ['switch_mode', 'new_task'], // Coordinator-specific tools
        description: 'Tools for mode coordination and task management'
    }
} as const
```

### Step 3: Update Tool Filtering

**File:** `src/core/prompts/tools/filter-tools-for-mode.ts`

Modify the `filterNativeToolsForMode` function:

```typescript
export function filterNativeToolsForMode(
    nativeTools: OpenAI.Chat.ChatCompletionTool[],
    mode: string | undefined,
    customModes: ModeConfig[] | undefined,
    experiments: Record<string, boolean> | undefined,
    codeIndexManager?: CodeIndexManager,
    settings?: Record<string, any>,
    mcpHub?: McpHub,
): OpenAI.Chat.ChatCompletionTool[] {
    // ... existing logic up to allowedToolNames creation
    
    // NEW: Restrict switch_mode to coordinator mode only
    if (modeSlug !== 'coordinator') {
        allowedToolNames.delete('switch_mode')
    }
    
    // Continue with existing filtering logic...
    
    // Conditionally exclude tools based on settings and experiments
    if (!codeIndexManager || 
        !(codeIndexManager.isFeatureEnabled && codeIndexManager.isFeatureConfigured && codeIndexManager.isInitialized)) {
        allowedToolNames.delete('codebase_search')
    }
    
    if (settings?.todoListEnabled === false) {
        allowedToolNames.delete('update_todo_list')
    }
    
    if (!experiments?.runSlashCommand) {
        allowedToolNames.delete('run_slash_command')
    }
    
    // ... rest of existing logic
}
```

### Step 4: Remove Mode Parameter from ask_followup_question

**File:** `src/core/tools/AskFollowupQuestionTool.ts`

```typescript
// Remove mode from Suggestion interface
interface Suggestion {
    text: string
    // mode?: string  // REMOVE THIS LINE
}

// Update parseLegacy method
parseLegacy(params: Partial<Record<string, string>>): AskFollowupQuestionParams {
    const question = params.question || ""
    const follow_up_xml = params.follow_up
    
    const suggestions: Suggestion[] = []
    
    if (follow_up_xml) {
        try {
            const parsedSuggest = parseXml(follow_up_xml, ["suggest"]) as {
                suggest: Array<string | { "#text": string }> | string | { "#text": string }
            }
            
            const rawSuggestions = Array.isArray(parsedSuggest?.suggest) 
                ? parsedSuggest.suggest 
                : [parsedSuggest?.suggest].filter(Boolean)
            
            for (const sug of rawSuggestions) {
                if (typeof sug === 'string') {
                    suggestions.push({ text: sug })
                } else {
                    // Only parse text content, ignore any mode attributes
                    suggestions.push({ text: sug["#text"] })
                }
            }
        } catch (error) {
            throw new Error(`Failed to parse follow_up XML: ${error instanceof Error ? error.message : String(error)}`)
        }
    }
    
    return {
        question,
        follow_up: suggestions
    }
}
```

**File:** `src/core/prompts/tools/native-tools/ask_followup_question.ts`

```typescript
const FOLLOW_UP_PARAMETER_DESCRIPTION = `Required list of 2-4 suggested responses; each suggestion must be a complete, actionable answer`

const FOLLOW_UP_TEXT_DESCRIPTION = `Suggested answer the user can pick`

// Remove FOLLOW_UP_MODE_DESCRIPTION constant

export default {
    type: "function",
    function: {
        name: "ask_followup_question",
        description: ASK_FOLLOWUP_QUESTION_DESCRIPTION,
        strict: true,
        parameters: {
            type: "object",
            properties: {
                question: {
                    type: "string",
                    description: QUESTION_PARAMETER_DESCRIPTION,
                },
                follow_up: {
                    type: "array",
                    description: FOLLOW_UP_PARAMETER_DESCRIPTION,
                    items: {
                        type: "object",
                        properties: {
                            text: {
                                type: "string",
                                description: FOLLOW_UP_TEXT_DESCRIPTION,
                            },
                            // Remove mode property
                        },
                        required: ["text"], // Only text is required now
                        additionalProperties: false,
                    },
                    minItems: 2,
                    maxItems: 4,
                },
            },
            required: ["question", "follow_up"],
            additionalProperties: false,
        },
    },
} satisfies OpenAI.Chat.ChatCompletionTool
```

### Step 5: Update Tool Descriptions

**File:** `src/core/prompts/tools/switch-mode.ts`

```typescript
export function getSwitchModeDescription(): string {
    return `## switch_mode
Description: Request to switch to a different mode. This tool is only available in coordinator mode and allows coordination between different modes when needed, such as switching to Code mode to make code changes. The user must approve the mode switch.
Parameters:
- mode_slug: (required) The slug of the mode to switch to (e.g., "code", "ask", "architect")
- reason: (optional) The reason for switching modes
Usage:
<switch_mode>
<mode_slug>Mode slug here</mode_slug>
<reason>Reason for switching here</reason>
</switch_mode>

Example: Requesting to switch to code mode
<switch_mode>
<mode_slug>code</mode_slug>
<reason>Need to make code changes</reason>
</switch_mode>`
}
```

### Step 6: Update Tests

**File:** `src/core/tools/__tests__/askFollowupQuestionTool.spec.ts`

Update tests to remove mode-related test cases:

```typescript
// Remove or update tests that check for mode attributes
it("should parse suggestions without mode attributes", async () => {
    // This test becomes the main/only test case
    const block: ToolUse = {
        type: "tool_use",
        name: "ask_followup_question",
        params: {
            question: "What would you like to do?",
            follow_up: "<suggest>Option 1</suggest><suggest>Option 2</suggest>",
        },
        partial: false,
    }
    
    // ... rest of test logic
    
    expect(mockCline.ask).toHaveBeenCalledWith(
        "followup",
        expect.stringContaining('"suggest":[{"answer":"Option 1"},{"answer":"Option 2"}]'),
        undefined,
        false,
    )
})

// Remove tests that check for mode attributes in suggestions
```

## Verification Steps

### 1. Test Tool Filtering

Create a test to verify that `switch_mode` is only available in coordinator mode:

```typescript
// In filter-tools-for-mode.spec.ts or similar test file
describe('Coordinator tool filtering', () => {
    it('should only allow switch_mode in coordinator mode', () => {
        const allTools = [/* all available tools */]
        
        const codeModeTools = filterNativeToolsForMode(
            allTools,
            'code',
            [],
            {},
            undefined,
            {},
            undefined
        )
        
        const coordinatorModeTools = filterNativeToolsForMode(
            allTools,
            'coordinator',
            [],
            {},
            undefined,
            {},
            undefined
        )
        
        expect(codeModeTools.find(tool => tool.function?.name === 'switch_mode')).toBeUndefined()
        expect(coordinatorModeTools.find(tool => tool.function?.name === 'switch_mode')).toBeDefined()
    })
})
```

### 2. Test ask_followup_question Changes

Verify that the ask_followup_question tool no longer accepts mode parameters:

```typescript
// In askFollowupQuestionTool.spec.ts
describe('ask_followup_question without mode parameter', () => {
    it('should ignore mode attributes in suggestions', async () => {
        const block: ToolUse = {
            type: "tool_use",
            name: "ask_followup_question",
            params: {
                question: "What would you like to do?",
                follow_up: '<suggest mode="code">Write code</suggest><suggest>Regular option</suggest>',
            },
            partial: false,
        }
        
        // Should parse successfully but ignore mode attributes
        await askFollowupQuestionTool.handle(mockCline, block as ToolUse<"ask_followup_question">, {
            askApproval: vi.fn(),
            handleError: vi.fn(),
            pushToolResult: mockPushToolResult,
            removeClosingTag: vi.fn((tag, content) => content),
            toolProtocol: "xml",
        })
        
        // Should only contain text suggestions, no mode information
        expect(mockCline.ask).toHaveBeenCalledWith(
            "followup",
            expect.stringContaining('"suggest":[{"answer":"Write code"},{"answer":"Regular option"}]'),
            undefined,
            false,
        )
    })
})
```

## Rollback Plan

If issues are discovered after implementation:

1. **Immediate Rollback**: Revert the tool filtering changes to allow switch_mode in all modes
2. **Partial Rollback**: Keep ask_followup_question changes but revert coordinator mode restrictions
3. **Feature Flag**: Implement the changes behind a feature flag for gradual rollout

## Future Enhancements

1. **Smart Coordinator**: Implement intelligent mode switching based on task context
2. **Mode History**: Track mode switch history for better user experience
3. **Coordinator UI**: Dedicated UI for mode coordination and switching
4. **Permission System**: Granular permissions for different types of mode switches

## Conclusion

This implementation guide provides a clear path to fix the mode switch tool design issues by:

1. Centralizing mode switching in a coordinator mode
2. Removing mode parameters from the ask_followup_question tool
3. Maintaining backward compatibility where possible
4. Providing comprehensive testing and verification steps

The changes will result in a cleaner architecture with better separation of concerns and improved user experience.