# Git Information Flow in Roo Code

## Overview
This document describes how git information flows from the local repository to the LLM context in Roo Code.

## Complete Flow Path

```
Git Information (getGitStatus) 
    ↓
getEnvironmentDetails() function 
    ↓
ApiRequestManager.recursivelyMakeClineRequests() 
    ↓
Environment details added to user message content
    ↓
API conversation history
    ↓
Sent to LLM as context
```

## Detailed Process

### 1. Git Data Collection
- `getGitStatus(cline.cwd, maxGitStatusFiles)` collects:
  - Current git branch information (e.g., "## main...origin/main")
  - Modified/added/deleted files in working directory
  - Limited by `maxGitStatusFiles` setting (0 = disabled)

### 2. Context Assembly
- `getEnvironmentDetails()` function:
  - Calls `getGitStatus()` when `maxGitStatusFiles > 0`
  - Formats git status as: `# Git Status\n${gitStatus}`
  - Wraps all environment details in `<environment_details>...</environment_details>` XML tags

### 3. LLM Delivery
- Through the pipeline: `Task.recursivelyMakeClineRequests()` → `ApiRequestManager.recursivelyMakeClineRequests()`
- Environment details added to user message content as: `{ type: "text", text: environmentDetails }`
- Included in API conversation history sent to the LLM

## Git Information Included

The LLM receives git context including:
- **Current Branch**: e.g., `## main...origin/main [ahead 1]`
- **File Status**: Modified (`M`), Added (`A`), Deleted (`D`), etc. indicators
- **File Paths**: Names of changed files (limited by `maxGitStatusFiles`)
- **Repository State**: Working directory changes relative to git index

## Configuration

Controlled by the `maxGitStatusFiles` setting in provider state:
- `0` = Git status disabled
- `> 0` = Number of files to include in git status output
- Can include additional files indication (e.g., `... 5 more files`)

## Enhanced Git Properties

The git properties enhancement provides additional repository information:
- **Repository URL**: Full HTTPS URL of the git repository
- **Repository Name**: Owner/repo format (e.g., "RooCodeInc/Roo-Code")  
- **Default Branch**: Main/default branch name (e.g., "main", "master")

This rich git context helps the AI understand the repository structure and current state when performing tasks.