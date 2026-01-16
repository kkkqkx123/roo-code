# Mode Architecture Design Document

## Overview

This document outlines the proper architecture for mode management in Roo Code, focusing on the separation of concerns between mode coordination and mode execution.

## Current Architecture Problems

### 1. Tool Availability Issues

Currently, the `switch_mode` tool is available to all modes, which violates the principle that mode coordination should be centralized. This creates:

- **Architectural Inconsistency**: Any mode can attempt to coordinate mode switches
- **User Experience Issues**: Mode switches can be initiated from inappropriate contexts
- **Permission Complexity**: Mode switch approval logic is scattered

### 2. Ask Question Tool Overreach

The `ask_followup_question` tool includes mode selection parameters, allowing modes to embed mode switching in their questions. This:

- **Blurs Responsibilities**: Question asking and mode coordination are mixed
- **Creates Inconsistent UX**: Mode switches can appear in unexpected places
- **Increases Complexity**: Every mode needs to understand mode switching

## Proposed Architecture

### Core Principles

1. **Single Responsibility**: Each component has one clear purpose
2. **Centralized Coordination**: Mode switching is handled by a coordinator
3. **Clear Boundaries**: Modes focus on execution, not coordination
4. **Consistent UX**: Mode changes happen in predictable ways

### Architecture Components

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Coordinator Mode                           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  switch_mode tool (exclusive access)              │    │
│  │  mode coordination logic                        │    │
│  │  user approval handling                         │    │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Mode Execution Layer                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐    │
│  │   Code Mode │  │   Ask Mode  │  │  Architect Mode │    │
│  │             │  │             │  │                 │    │
│  │  - Tools    │  │  - Tools    │  │  - Tools        │    │
│  │  - Prompts  │  │  - Prompts  │  │  - Prompts      │    │
│  │  - Logic    │  │  - Logic    │  │  - Logic        │    │
│  │             │  │             │  │                 │    │
│  │  No switch_ │  │  No switch_ │  │  No switch_     │    │
│  │  mode tool  │  │  mode tool  │  │  mode tool      │    │
│  └─────────────┘  └─────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Tool System Layer                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  ask_followup_question (no mode param)            │    │
│  │  Tool filtering by mode                           │    │
│  │  Permission system                                │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Mode Coordination Flow

```
User Request
     │
     ▼
Current Mode (Code/Ask/Architect)
     │
     │  Needs mode switch?
     │──────────────────────┐
     │                      │
     ▼                      ▼
Continue in current    Request coordinator mode
mode with available    via internal mechanism
tools                  (not switch_mode tool)
     │                      │
     │                      ▼
     │              Coordinator Mode
     │              ┌─────────────────┐
     │              │  Evaluate need  │
     │              │  Get approval   │
     │              │  Execute switch │
     │              └─────────────────┘
     │                      │
     └──────────────────────┘
              Success
                 │
                 ▼
         Target Mode Activated
```

## Implementation Details

### 1. Tool Filtering

The tool filtering system in [`src/core/prompts/tools/filter-tools-for-mode.ts`](file:///d:\项目\agent\Roo-Code\src\core\prompts\tools\filter-tools-for-mode.ts:1-453) needs modification:

```typescript
export function filterNativeToolsForMode(
    nativeTools: OpenAI.Chat.ChatCompletionTool[],
    mode: string | undefined,
    // ... other parameters
): OpenAI.Chat.ChatCompletionTool[] {
    // ... existing logic
    
    // NEW: Coordinator-only tools
    if (modeSlug !== 'coordinator') {
        allowedToolNames.delete('switch_mode')
    }
    
    // ... rest of filtering
}
```

### 2. Ask Question Tool Simplification

The [`src/core/tools/AskFollowupQuestionTool.ts`](file:///d:\项目\agent\Roo-Code\src\core\tools\AskFollowupQuestionTool.ts:1-106) should be simplified:

```typescript
interface Suggestion {
    text: string
    // Remove mode parameter
}

interface AskFollowupQuestionParams {
    question: string
    follow_up: Suggestion[] // No mode field in suggestions
}
```

### 3. Coordinator Mode Implementation

A new coordinator mode should be implemented with:

```typescript
const coordinatorMode: ModeConfig = {
    slug: 'coordinator',
    name: 'Coordinator',
    roleDefinition: 'Coordinate between different modes and handle mode transitions',
    groups: ['coordinator'], // Special group with coordinator tools
    // ... other properties
}
```

### 4. Tool Groups

A new tool group for coordinator-specific tools:

```typescript
const TOOL_GROUPS = {
    // ... existing groups
    coordinator: {
        tools: ['switch_mode', 'coordinate_mode'],
        description: 'Tools for mode coordination and switching'
    }
}
```

## Benefits

### 1. Clear Architecture
- Single responsibility for each component
- Clear boundaries between coordination and execution
- Predictable behavior

### 2. Better User Experience
- Mode switches happen in consistent contexts
- No unexpected mode changes from questions
- Clear coordinator role

### 3. Easier Maintenance
- Centralized mode switching logic
- Simplified tool interfaces
- Clear architectural patterns

### 4. Extensibility
- Easy to add new modes without coordination logic
- Coordinator can be enhanced independently
- Tool system remains focused

## Migration Strategy

### Phase 1: Foundation
1. Create coordinator mode configuration
2. Implement coordinator tool group
3. Add coordinator-only tool filtering

### Phase 2: Tool Updates
1. Remove mode parameter from ask_followup_question
2. Update all tool descriptions and usage
3. Test tool filtering in isolation

### Phase 3: Integration
1. Implement mode coordination logic
2. Add coordinator mode activation
3. Test end-to-end mode switching

### Phase 4: Cleanup
1. Remove deprecated functionality
2. Update documentation
3. Validate user workflows

## Testing Considerations

### Unit Tests
- Tool filtering by mode
- Coordinator mode tool availability
- Ask question tool without mode parameter

### Integration Tests
- Mode switching flow
- Coordinator mode activation
- Tool availability across modes

### User Acceptance Tests
- Mode switching UX
- Question asking without mode switches
- Coordinator mode behavior

## Conclusion

This architecture provides a clean separation between mode coordination and mode execution, leading to:

- **Better Architecture**: Clear responsibilities and boundaries
- **Improved UX**: Consistent and predictable mode behavior
- **Easier Maintenance**: Focused components with single purposes
- **Future Extensibility**: Clear patterns for adding new functionality

The coordinator pattern ensures that mode switching is handled centrally while allowing individual modes to focus on their specific tasks and tools.