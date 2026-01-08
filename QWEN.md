# Roo Code Project Context

## Project Overview

Roo Code is an AI-powered development team that operates directly within your VS Code editor. It's a comprehensive VS Code extension that provides intelligent coding assistance, code generation, refactoring, debugging, and documentation capabilities. The project is built as a monorepo using pnpm workspaces and Turborepo for efficient development workflows.

### Key Features
- **Code Generation**: Generate code from natural language descriptions and specifications
- **Adaptive Modes**: Code, Architect, Ask, Debug, and Custom Modes for different development scenarios
- **Refactoring & Debugging**: Intelligent code refactoring and debugging assistance
- **Documentation**: Automatic documentation generation and updates
- **Codebase Understanding**: Answer questions about your codebase with deep context awareness
- **Task Automation**: Automates repetitive development tasks
- **MCP Integration**: Utilizes Model Context Protocol (MCP) servers for enhanced capabilities
- **Roomote Control**: Remote control of tasks running in your local VS Code instance

### Architecture
The project follows a monorepo structure with multiple packages:
- **`src`**: Main VS Code extension code (the `roo-cline` package)
- **`webview-ui`**: React-based webview UI components for the sidebar and panels
- **`apps/`**: 
  - `vscode-e2e`: End-to-end testing
  - `vscode-nightly`: Nightly build version
- **`packages/`**:
  - `build`: Build configuration
  - `config-eslint`: ESLint configuration
  - `config-typescript`: TypeScript configuration
  - `docs`: Documentation
  - `evals`: Evaluation framework
  - `ipc`: Inter-process communication layer
  - `types`: Shared TypeScript types

## Building and Running

### Prerequisites
- Node.js 20.19.2 (managed via .tool-versions)
- pnpm package manager
- VS Code

### Development Setup
```bash
# Install dependencies
pnpm install

# Run the extension in development mode
# Press F5 in VS Code to start debugging (opens new VS Code window with extension)
```

### Alternative Installation Methods
1. **Automated VSIX Installation**:
   ```bash
   pnpm install:vsix [-y] [--editor=<command>]
   ```

2. **Manual VSIX Installation**:
   ```bash
   pnpm vsix  # Builds the .vsix file in bin/ directory
   code --install-extension bin/roo-cline-<version>.vsix
   ```

### Key Scripts
- `pnpm build` - Build all packages
- `pnpm lint` - Run ESLint
- `pnpm check-types` - Type checking
- `pnpm test` - Run tests. 
Always use command like `cd "d:\项目\agent\Roo-Code\src" && pnpm test --run --dir services/code-index/vector-store/__tests__`, dont't run full test suite.
- `pnpm format` - Format code with Prettier
- `pnpm vsix` - Create VSIX package for distribution
- `pnpm clean` - Clean build artifacts

## Development Conventions

### Code Structure
- **Extension Entry Point**: `src/extension.ts` - Main activation logic
- **Webview UI**: `webview-ui/src/` - React components for the sidebar UI
- **Core Services**: `src/core/` - Core functionality like webview provider, configuration
- **API Integration**: `src/api/` - AI provider integrations (Anthropic, OpenAI, etc.)
- **Services**: `src/services/` - Background services like code indexing, MCP servers
- **Utils**: `src/utils/` - Utility functions and helpers
- **Shared**: `src/shared/` - Shared code between extension and webview

### Technology Stack
- **VS Code Extension API**: Primary platform
- **React**: Webview UI components
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Styling
- **Radix UI**: Accessible UI components
- **Zod**: Schema validation
- **Turborepo**: Build system and caching
- **Vite**: Build tool for webview
- **Next.js**: Web application framework

### AI Provider Support
The extension supports multiple AI providers:
- Anthropic (Claude)
- OpenAI
- Google (Gemini)
- Custom providers via API keys
- VS Code Language Model selector
- MCP (Model Context Protocol) servers

### Testing
- Unit tests using Vitest
- End-to-end tests in `apps/vscode-e2e`
- Type checking with TypeScript
- Linting with ESLint

### Internationalization
The project supports multiple languages with i18n implementation in `src/i18n/`.

## Key Files and Directories

- `package.json` - Root workspace configuration
- `pnpm-workspace.yaml` - Monorepo workspace definition
- `src/extension.ts` - Extension activation entry point
- `src/package.json` - VS Code extension manifest
- `webview-ui/package.json` - Webview UI dependencies
- `apps/web-roo-code/` - Web version of the application
- `packages/types/` - Shared TypeScript types across packages
- `packages/ipc/` - Inter-process communication layer
