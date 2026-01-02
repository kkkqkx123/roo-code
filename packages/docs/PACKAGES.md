# Package Analysis

This document describes the architecture and functionality of the core packages in Roo-Code.

## packages/ipc - Inter-Process Communication Module

### Overview

The `ipc` package provides Inter-Process Communication (IPC) capabilities for Roo Code, enabling external applications to communicate with the VS Code extension through a socket-based interface.

### Core Functionality

- **Socket-based Communication**: Uses Unix sockets (Linux/macOS) or named pipes (Windows) for inter-process communication
- **Event-driven Architecture**: Built on Node.js EventEmitter for real-time event handling
- **Command-based Interface**: Supports multiple task commands for lifecycle management

### Supported Commands

#### StartNewTask
Starts a new task with optional configuration and initial message.

**Parameters:**
- `configuration`: RooCode settings object
- `text`: Initial task message (string)
- `images`: Array of image data URIs (optional)
- `newTab`: Whether to open in a new tab (boolean, optional)

#### CancelTask
Cancels a running task.

**Parameters:**
- `data`: Task ID to cancel (string)

#### CloseTask
Closes a task and performs cleanup.

**Parameters:**
- `data`: Task ID to close (string)

#### ResumeTask
Resumes a task from history.

**Parameters:**
- `data`: Task ID to resume (string)

**Error Handling:**
- If the task ID is not found in history, the command fails gracefully without crashing the IPC server
- Errors are logged for debugging purposes but do not propagate to the client

### Emitted Events

- `TaskStarted`: When a task begins
- `TaskCompleted`: When a task finishes
- `TaskAborted`: When a task is cancelled
- `Message`: When a task sends a message
- `Connect`: When client connects to IPC server
- `Disconnect`: When client disconnects from IPC server
- `Ack`: Acknowledgment from server with client ID

### Socket Paths

The socket path is typically located in the system's temporary directory:
- Unix/Linux/macOS: `/tmp/roo-code-{id}.sock`
- Windows: `\\.\pipe\roo-code-{id}`

### Usage Example

```typescript
import { IpcClient } from "@roo-code/ipc"

const client = new IpcClient("/path/to/socket")

// Resume a task
client.sendCommand({
  commandName: "ResumeTask",
  data: "task-123",
})

// Start a new task
client.sendCommand({
  commandName: "StartNewTask",
  data: {
    configuration: {
      /* RooCode settings */
    },
    text: "Hello, world!",
    images: [],
    newTab: false,
  },
})
```

### Dependencies

- `node-ipc`: ^12.0.0 - IPC library for socket communication
- `@roo-code/types`: Shared type definitions

---

## packages/evals - AI Evaluation System

### Overview

The `evals` package is a distributed evaluation platform that runs AI coding tasks in isolated VS Code environments. It provides a comprehensive system for evaluating AI coding capabilities across multiple programming languages.

### Problems Solved

#### Simplified Setup and Deployment
Traditional AI evaluation setups require complex dependency management across multiple programming languages, development tools, and VS Code extensions. The evals system eliminates this friction by:

- **One-Command Deployment**: Single `docker compose up` command starts the entire evaluation infrastructure
- **Pre-configured Environments**: Runner containers include all necessary language runtimes, tools, and VS Code extensions
- **Dependency Isolation**: No host system contamination or version conflicts between different language requirements
- **Reproducible Environments**: Identical evaluation conditions across different machines and deployments

#### Resource Management and Isolation
Running multiple AI evaluation tasks sequentially in a single VS Code instance creates several problems:

- **Memory Accumulation**: VS Code instances gradually consume more memory with each task, eventually leading to crashes
- **State Contamination**: Previous tasks can leave behind files, settings, or processes that affect subsequent evaluations
- **Resource Contention**: Multiple tasks competing for the same VS Code instance create bottlenecks and inconsistent performance
- **Failure Propagation**: A single problematic task can crash the entire evaluation session

The containerized approach solves these issues by:
- **Fresh Environments**: Each task starts with a clean VS Code instance and workspace
- **Memory Reset**: Container termination automatically reclaims all memory and resources
- **Parallel Execution**: Multiple tasks can run simultaneously without interference
- **Fault Isolation**: Individual task failures don't affect other running evaluations

### Architecture Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Web Application                   │
│         (Run Management, Real-time Monitoring, Results)      │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │PostgreSQL│   │  Redis   │   │Controller│
    │  (Data)  │   │ (Pub/Sub)│   │ Container│
    └──────────┘    └──────────┘    └─────┬────┘
                                          │
                              ┌───────────┼───────────┐
                              ▼           ▼           ▼
                        ┌──────────┐ ┌──────────┐ ┌──────────┐
                        │ Runner 1 │ │ Runner 2 │ │ Runner N │
                        │  Container│ │ Container│ │ Container│
                        └──────────┘ └──────────┘ └──────────┘
```

### Core Components

#### Next.js Web Application
The web application serves as the primary interface for creating and monitoring evaluation runs:

- **Run Management**: Create evaluation runs with configurable parameters (model, concurrency, exercise selection)
- **Real-time Monitoring**: Live progress tracking via Server-Sent Events
- **Results Dashboard**: View task completion status, metrics, and outcomes
- **Container Orchestration**: Spawns controller containers for new runs

#### Controller Container
A specialized instance of the `evals-runner` container that acts as the run orchestrator:

- **In-Memory Task Queue**: Uses the `p-queue` npm package to manage task distribution with configurable concurrency limits (1-25)
- **Git Workspace Setup**: Prepares exercise repositories and manages version control
- **Runner Coordination**: Spawns and monitors individual task runner containers
- **Heartbeat Monitoring**: Maintains Redis heartbeat to track controller health
- **Result Aggregation**: Collects task results and finalizes run metrics

#### Runner Containers
Individual containers that execute single evaluation tasks:

- **Isolated Environment**: Fresh VS Code instance with pre-installed language tools and extensions
- **Task Execution**: Runs AI agent with evaluation prompt in VS Code environment
- **IPC Communication**: Connects to VS Code via Unix socket for real-time interaction
- **Unit Testing**: Validates task completion using language-specific test suites
- **Metrics Collection**: Tracks token usage, costs, tool usage, and execution time

#### Supporting Infrastructure
- **Redis**: Provides pub/sub messaging for real-time events and runner registration tracking
- **PostgreSQL**: Stores run configurations, task definitions, execution metrics, and results
- **Docker**: Container orchestration for isolation and scalability

### Supported Languages

The evaluation system supports multiple programming languages:
- Go
- JavaScript/TypeScript
- Python
- Rust
- Java

### Execution Flow

#### 1. Run Initialization
The web application creates an evaluation run with specified parameters:
- **Suite Type**: Full evaluation (all exercises) or partial (selected exercises)
- **Model Configuration**: AI model selection and settings via OpenRouter
- **Concurrency**: Number of parallel task executions (1-25)
- **Exercise Selection**: Programming language and specific coding challenges

#### 2. Controller Deployment
The web application spawns a controller container that:
- **Loads Run Configuration**: Retrieves run parameters and associated tasks from database
- **Prepares Workspace**: Sets up git repository with exercise code and test suites
- **Establishes Monitoring**: Starts Redis heartbeat and event publishing
- **Creates Task Queue**: Initializes concurrent task processing with specified limits

#### 3. Task Distribution
The controller distributes tasks across runner containers using an in-memory queue:
- **p-queue Management**: Uses the `p-queue` npm package to manage task concurrency in memory
- **Container Spawning**: Creates isolated runner containers for each task
- **Resource Management**: Enforces concurrency limits to prevent resource exhaustion
- **Task Assignment**: Each runner receives a single task with full context
- **Progress Tracking**: Monitors runner registration and task status via Redis pub/sub

#### 4. Task Execution
Individual runners execute evaluation tasks:
- **Environment Setup**: Launches VS Code with Roo extension in isolated container
- **Prompt Delivery**: Sends evaluation prompt to AI agent via IPC
- **Code Generation**: AI agent writes code using available tools and context
- **Real-time Events**: Publishes progress updates, token usage, and completion status
- **Validation**: Runs language-specific unit tests to verify correctness

#### 5. Result Collection
The system aggregates and reports results:
- **Event Streaming**: Real-time progress updates flow from runners through Redis to web interface
- **Metrics Aggregation**: Controller collects execution metrics, costs, and success rates
- **Run Completion**: Final results stored in database with comprehensive analytics
- **Cleanup**: Containers terminated and resources released

### Communication Architecture

#### IPC (Inter-Process Communication)
- **Unix Sockets**: Direct communication between CLI and VS Code extension
- **Event Streaming**: Real-time task progress and AI agent interactions
- **Command Interface**: Task lifecycle management (start, cancel, close)
- **Package Used**: `@roo-code/ipc`

#### Redis Pub/Sub
- **Event Broadcasting**: Task events published to run-specific channels
- **Runner Registration**: Active runner tracking per evaluation run
- **Heartbeat Monitoring**: Controller health and availability status
- **Not Used for Queuing**: Task queue management is handled in-memory by the controller using `p-queue`

#### HTTP/SSE
- **Web Interface**: REST API for run management and configuration
- **Real-time Updates**: Server-Sent Events for live progress monitoring
- **Result Retrieval**: Task metrics and completion status

### Task Lifecycle

1. **Initialization**: Container startup and VS Code launch
2. **Connection**: IPC socket establishment and extension activation
3. **Prompt Delivery**: Evaluation challenge sent to AI agent
4. **Execution**: AI agent writes code using available tools
5. **Validation**: Unit test execution to verify correctness
6. **Cleanup**: Container termination and resource cleanup

### Error Handling and Timeouts

- **Task Timeouts**: 30-minute maximum execution time per task
- **Process Cleanup**: Automatic termination of hung processes
- **Container Recovery**: Failed containers are cleaned up and resources released
- **Graceful Degradation**: Individual task failures don't affect other tasks in the run

### Metrics Collected

- **Token Usage**: Input/output tokens and context size tracking
- **Cost Analysis**: API costs per task and aggregated run costs
- **Tool Usage**: Frequency and success rates of different AI tools
- **Execution Time**: Task duration and queue wait times
- **Success Rates**: Pass/fail statistics across languages and exercises

### Configuration

#### Environment Variables

Default ports:
- **PostgreSQL**: 5433 (external) → 5432 (internal)
- **Redis**: 6380 (external) → 6379 (internal)
- **Web Service**: 3446 (external) → 3446 (internal)

#### Run Configuration Options

- **Model Selection**: Choose from available AI models via OpenRouter integration
- **Concurrency Control**: 1-25 parallel task executions based on resource availability
- **Exercise Selection**: Full suite (all exercises) or partial (selected exercises)
- **Custom Settings**: Override default AI agent configuration and behavior
- **System Prompts**: Optional custom prompts for specialized evaluation scenarios

### Dependencies

**Main Dependencies:**
- `@roo-code/ipc`: IPC client for VS Code communication
- `@roo-code/types`: Shared type definitions
- `cmd-ts`: Command-line interface framework
- `drizzle-orm`: Database ORM
- `p-queue`: Task queue management
- `redis`: Redis client for pub/sub
- `zod`: Schema validation

**Development Dependencies:**
- `drizzle-kit`: Database migrations
- `tsx`: TypeScript execution
- `vitest`: Testing framework

### Package Relationship

```
packages/evals (Evaluation System)
    │
    └── Uses ──→ packages/ipc (IPC Communication)
                    │
                    └── Provides Socket Communication to VS Code Extension
```

The `ipc` package serves as the foundational communication layer that enables the `evals` system to interact with VS Code instances running in isolated containers.

### CLI Commands

```bash
# Start database
pnpm db:up

# Start Redis
pnpm redis:up

# Start all services
pnpm services:up

# Run CLI
pnpm cli

# Database migrations
pnpm db:generate
pnpm db:migrate
```

### Resource Recommendations

Memory and CPU limits should scale with concurrency:
```
Memory Limit = 3GB * concurrency
CPU Limit = 2 * concurrency
```
