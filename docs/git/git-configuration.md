# Git Information Configuration in Roo Code

## Overview
This document describes how git information is configured and controlled in Roo Code, including both git status information and git properties.

## Configuration Points

### 1. Git Status Configuration (`maxGitStatusFiles`)

The main git status information is controlled by the `maxGitStatusFiles` setting:

- **Location**: Context Management Settings UI
- **Default Value**: 0 (disabled by default)
- **Range**: 0-50 (controlled by slider)
- **Purpose**: Controls number of git status file entries included in LLM context

#### Behavior:
- `maxGitStatusFiles = 0`: Git status is completely disabled
- `maxGitStatusFiles > 0`: Git status is enabled, showing up to N file entries
- Always shows branch information when enabled (> 0)

#### Technical Implementation:
- Type definition: `maxGitStatusFiles: z.number().optional()`
- Applied in `getEnvironmentDetails.ts`: `maxGitStatusFiles = 0` (default override)
- Conditional check: `if (maxGitStatusFiles > 0)`

### 2. Git Properties Configuration

Git properties (repository URL, name, default branch) are automatically collected when:
- The workspace is a git repository
- Git is installed and accessible
- No separate configuration needed - this is always enabled when possible

## Privacy and Security Considerations

### Default Behavior
- Git status is **disabled by default** (`maxGitStatusFiles = 0`)
- This protects user privacy by not exposing git information unless explicitly enabled
- Users must consciously choose to share git status information

### User Control
- Users can control git status exposure through the settings UI
- Slider control from 0 (disabled) to 50 (maximum files shown)
- Setting to 0 completely disables git status reporting

## User Interface

### Settings Location
- Path: Settings → Context Management → Git status max files
- Label: "Git status max files" / "Git 状态最大文件数" 
- Description: "Maximum number of file entries to include in git status context. Set to 0 to disable."

### Visual Control
- Interactive slider (0-50 range)
- Numeric display showing current value
- Immediate effect when changed

## Technical Flow

### Git Status Information
```
User Setting (maxGitStatusFiles) 
    ↓
State Coordinator
    ↓
getEnvironmentDetails() function
    ↓
Conditional git status collection (if maxGitStatusFiles > 0)
    ↓
LLM Context (when enabled)
```

### Git Properties Information
```
Automatic detection (no user setting)
    ↓
getWorkspaceGitInfo() function
    ↓
ClineProvider.gitProperties getter
    ↓
Available to LLM context and analytics
```

## Security Implications

### Protected Information
When `maxGitStatusFiles = 0` (default):
- No git file status exposed to LLM
- No branch information shared
- No repository structure revealed

### When Enabled
When `maxGitStatusFiles > 0`:
- Git branch information shared
- File modification status shared
- Repository structure partially revealed

## Best Practices

### For Users
- Keep at 0 if privacy is a concern
- Enable only when git context is needed for tasks
- Adjust number based on sensitivity of file information

### For Development
- Default disabled is the safest option
- Clear user control through UI settings
- Respect user privacy preferences