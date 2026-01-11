Problem Statement

The mode-to-API-profile mapping is stored in VSCode's global secrets storage, which is shared across all workspaces. When a parent task spawns a child task and the user switches to another workspace and changes their API profile, the global mapping gets overwritten. When the child completes and the parent task resumes, it reads from this global state and continues with the wrong API profile.

This causes:

Wrong model execution - Parent resumes with an unintended API profile
Capability mismatch - The resumed model may lack features the parent task requires
Silent failures - No error is shown; the task just behaves unexpectedly
The issue affects multi-workspace users, orchestrator workflows, and any task that gets resumed from history.

Summary
Implements task-level provider profile (API configuration) persistence, mirroring the existing sticky mode behavior (on the mode pulldown). This ensures:

Each task retains its designated provider profile
Switching profiles in one workspace doesn't alter tasks in other active workspaces
When resuming a task from history, the original provider profile is restored
How It Works
New Task Creation: When a new task is created, _taskApiConfigName is initialized asynchronously from the current provider state via initializeTaskApiConfigName(). Falls back to "default" if provider state is unavailable.

History Item Loading: When loading from history, _taskApiConfigName is set synchronously from historyItem.apiConfigName during construction.

Profile Switching: When activateProviderProfile() is called, updates the task's _taskApiConfigName and persists to task history via the new persistStickyProviderProfileToCurrentTask() method.

Task Restoration: When createTaskWithHistoryItem() opens a task from history, restores the task's specific apiConfigName by calling activateProviderProfile() with persistTaskHistory: false to avoid re-persisting during restoration.

Message Persistence: When saveClineMessages() is called, the apiConfigName is passed to taskMetadata() and persisted with the task. A race condition guard ensures async initialization doesn't overwrite a newer profile value set during initialization.

Changes
packages/types/src/history.ts: Added apiConfigName field to HistoryItemSchema
src/core/task-persistence/taskMetadata.ts: Added apiConfigName parameter to TaskMetadataOptions and included it in the returned history item
src/core/task/Task.ts: Added _taskApiConfigName property with taskApiConfigReady promise for async initialization, getters/setters (getTaskApiConfigName(), taskApiConfigName, setTaskApiConfigName()), and updated saveClineMessages() to persist the profile
src/core/webview/ClineProvider.ts: Added persistStickyProviderProfileToCurrentTask() private method, modified activateProviderProfile() to accept persistModeConfig and persistTaskHistory options, and added profile restoration logic in createTaskWithHistoryItem()
src/core/webview/tests/ClineProvider.sticky-profile.spec.ts: Added 11 comprehensive tests covering profile switching, task restoration, error handling, and multi-workspace isolation
src/core/task/tests/Task.sticky-profile-race.spec.ts: Added test for race condition prevention when profile is set during async initialization