# Mode Switch Tool Design Analysis

## Current Issues

### 1. Mode Switch Tool Availability

The current implementation incorrectly makes the `switch_mode` tool available to all modes, when it should only be available to the coordinator mode. This creates several problems:

- **Tool Confusion**: Non-coordinator modes can attempt to switch modes, which violates the architectural principle that mode coordination should be centralized
- **Permission Issues**: Mode switches require approval, but the tool is available in contexts where it shouldn't be
- **Architectural Violation**: The current design allows any mode to request mode switches, bypassing the coordinator pattern

### 2. Ask Question Tool Mode Parameter

The `ask_followup_question` tool currently includes a `mode` parameter in its suggestions, which allows modes to specify mode switches in their follow-up questions. This creates:

- **Inconsistent UX**: Users can be prompted to switch modes from within any mode's questions
- **Mode Leakage**: Mode-specific logic bleeds into general question-asking functionality
- **Unnecessary Complexity**: The tool should focus on asking questions, not managing mode transitions

## Analysis of Current Implementation

### Switch Mode Tool Analysis

From [`src/core/tools/SwitchModeTool.ts`](file:///d:\项目\agent\Roo-Code\src\core\tools\SwitchModeTool.ts:1-94), the tool is implemented as a general-purpose tool that:

1. Validates mode existence
2. Checks if already in target mode
3. Requests user approval
4. Executes the mode switch via `task.providerRef.deref()?.handleModeSwitch(mode_slug)`

However, this tool is currently available to ALL modes through the tool filtering system in [`src/core/prompts/tools/filter-tools-for-mode.ts`](file:///d:\项目\agent\Roo-Code\src\core\prompts\tools\filter-tools-for-mode.ts:1-453).

### Ask Question Tool Mode Parameter Analysis

From [`src/core/tools/AskFollowupQuestionTool.ts`](file:///d:\项目\agent\Roo-Code\src\core\tools\AskFollowupQuestionTool.ts:1-106), the tool accepts suggestions with optional `mode` parameters:

```typescript
interface Suggestion {
    text: string
    mode?: string  // This should be removed
}
```

This allows any mode to embed mode switch suggestions in their questions, which is inappropriate.

## Proposed Architecture Changes

### 1. Coordinator-Only Mode Switch Tool

The `switch_mode` tool should be restricted to only the coordinator mode. Here's the proposed architecture:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Code Mode     │    │   Ask Mode       │    │  Architect Mode │
│                 │    │                  │    │                 │
│  No switch_mode │    │  No switch_mode  │    │  No switch_mode │
│  tool available │    │  tool available   │    │  tool available │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ Coordinator Mode │
                    │                 │
                    │ switch_mode     │
                    │ tool available  │
                    └─────────────────┘
                                 │
                    ┌─────────────────┐
                    │ Mode Switch     │
                    │ Handler         │
                    └─────────────────┘
```

### 2. Ask Question Tool Simplification

The `ask_followup_question` tool should:
- Remove the `mode` parameter from suggestions
- Focus purely on asking questions and gathering user input
- Not be involved in mode switching decisions

### 3. Mode Coordination Flow

```
User Request → Current Mode → Coordinator Mode → Target Mode
     │            │              │                │
     │            │              │                ▼
     │            │              │         Execute in
     │            │              │         Target Mode
     │            │              │
     │            └──────────────┼────────────────┘
     │                           │
     └───────────────────────────┘
```

## Implementation Requirements

### 1. Tool Filtering Changes

Modify [`src/core/prompts/tools/filter-tools-for-mode.ts`](file:///d:\项目\agent\Roo-Code\src\core\prompts\tools\filter-tools-for-mode.ts:1-453) to:

```typescript
// Add coordinator-specific tool filtering
if (modeSlug !== 'coordinator') {
    allowedToolNames.delete('switch_mode')
}
```

### 2. Ask Question Tool Changes

Modify [`src/core/tools/AskFollowupQuestionTool.ts`](file:///d:\项目\agent\Roo-Code\src\core\tools\AskFollowupQuestionTool.ts:1-106) to:

```typescript
interface Suggestion {
    text: string
    // Remove mode parameter
}
```

### 3. Coordinator Mode Implementation

Ensure there's a dedicated coordinator mode that:
- Has access to the `switch_mode` tool
- Can coordinate between different modes
- Handles mode transition logic

## Benefits of This Design

1. **Clear Separation of Concerns**: Mode switching is centralized in the coordinator
2. **Consistent UX**: Users only encounter mode switches in appropriate contexts
3. **Simplified Tool Interface**: Tools focus on their core functionality
4. **Better Architecture**: Follows the coordinator pattern properly
5. **Reduced Complexity**: Modes don't need to understand mode switching logic

## Migration Strategy

1. **Phase 1**: Implement coordinator mode with switch_mode tool access
2. **Phase 2**: Remove switch_mode tool from other modes
3. **Phase 3**: Remove mode parameter from ask_followup_question tool
4. **Phase 4**: Update documentation and user flows

## Testing Considerations

- Ensure coordinator mode properly handles mode switches
- Verify other modes cannot access switch_mode tool
- Test ask_followup_question tool without mode parameter
- Validate mode transition flows work correctly

## Conclusion

This design change will create a more robust and architecturally sound mode system where:
- Mode coordination is centralized
- Tools have clear, focused responsibilities
- User experience is consistent and predictable
- The system is easier to maintain and extend