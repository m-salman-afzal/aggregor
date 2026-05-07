# Yamac — VSCode AI Coding Assistant Extension Roadmap

A universal AI agent interface for VSCode, built incrementally to learn extension development.

---

## Phase 1 — Foundation: Auto Commit Message Generator

Learn the basics of VSCode extension development through a focused, useful feature.

### What you'll learn

- Extension activation and command registration
- Calling the VSCode Git API
- Calling an external AI API (Anthropic/OpenAI)
- Input boxes, quick picks, and basic VS Code UI primitives
- Extension settings (user-configurable prompt templates)

### Milestones

- [ ] 1.1 Scaffold the extension with `yo code` (TypeScript)
- [ ] 1.2 Register a command: `yamac.generateCommitMessage`
- [ ] 1.3 Read staged file diffs via the VSCode Git extension API
- [ ] 1.4 Call an AI API with the diff and a system prompt
- [ ] 1.5 Show the generated message in an input box (editable before committing)
- [ ] 1.6 Let the user customize the prompt template via VS Code settings (`yamac.commitPrompt`)
- [ ] 1.7 Add a button in the Source Control panel (SCM input area) to trigger generation
- [ ] 1.8 Support multiple AI providers (Anthropic, OpenAI) via a setting

---

## Phase 2 — Chat Panel: Talk to an Agent

Build the core UI: a side panel where you can chat with an AI agent.

### What you'll learn

- Webview panels (custom HTML/CSS/JS inside VSCode)
- Message passing between extension host and webview
- Managing conversation history/state
- Streaming responses from AI APIs

### Milestones

- [ ] 2.1 Create a Webview panel for the chat interface
- [ ] 2.2 Build a minimal chat UI (HTML + CSS, no framework needed yet)
- [ ] 2.3 Wire up message passing: webview → extension → AI API → webview
- [ ] 2.4 Stream AI responses token by token into the chat
- [ ] 2.5 Support multiple agents/providers switchable from the panel
- [ ] 2.6 Add conversation history (persisted across sessions via `ExtensionContext.globalState`)

---

## Phase 3 — File Editing: Agent-Proposed Changes

The core of Cursor-like functionality: the agent suggests edits, you accept or reject them.

### What you'll learn

- Reading and writing files via `vscode.workspace.fs`
- Creating and displaying diffs (`vscode.diff`)
- Decorations and inline editor overlays
- Custom editor providers

### Milestones

- [ ] 3.1 Parse agent output for file edit blocks (a defined format: file path + content)
- [ ] 3.2 Show a diff view for each proposed change (VSCode's built-in diff editor)
- [ ] 3.3 Add Accept / Reject / Accept All / Reject All actions (CodeLens or buttons)
- [ ] 3.4 Apply accepted changes atomically to disk
- [ ] 3.5 Support multi-file edits in a single agent response
- [ ] 3.6 Show a summary panel of all pending changes before applying

---

## Phase 4 — Context Awareness: Feed the Agent Your Codebase

The agent needs to understand your code to be useful.

### What you'll learn

- Workspace file tree traversal
- Reading open editor tabs and selections
- Respecting `.gitignore` / building a context window
- VSCode diagnostics API (errors, warnings)

### Milestones

- [ ] 4.1 Attach the current file and selection to every agent request
- [ ] 4.2 Let the user `@mention` files/folders to include them as context
- [ ] 4.3 Build a lightweight project index (file tree + symbol names)
- [ ] 4.4 Attach relevant diagnostics (lint errors) automatically when asking about a file
- [ ] 4.5 Add a token budget indicator so the user knows how much context is being sent

---

## Phase 5 — Agent Plugins: Connect Any Agent

Make the architecture universal — plug in any agent backend.

### What you'll learn

- Defining a plugin/provider interface in TypeScript
- Dynamic provider loading
- MCP (Model Context Protocol) basics
- Extension contribution points (letting other extensions register providers)

### Milestones

- [ ] 5.1 Define a `AgentProvider` interface (send message → stream response)
- [ ] 5.2 Implement built-in providers: Anthropic Claude, OpenAI, Ollama (local)
- [ ] 5.3 Add MCP server support so agents can call tools (read file, run terminal, search)
- [ ] 5.4 Let users add custom providers via JSON config
- [ ] 5.5 Expose a VSCode contribution point so other extensions can register providers

---

## Phase 6 — Power Features

Polish and advanced capabilities once the foundation is solid.

- [ ] Inline completions (ghost text suggestions like Copilot)
- [ ] Terminal command suggestions with accept/reject
- [ ] Agent-driven test generation
- [ ] Voice input to the chat panel
- [ ] Multi-agent workflows (one agent plans, another executes)
- [ ] Local model support (llama.cpp, LM Studio via OpenAI-compatible API)

---

## Tech Stack

| Concern        | Choice                            | Why                                           |
| -------------- | --------------------------------- | --------------------------------------------- |
| Language       | TypeScript                        | VSCode is TypeScript-native; great API types  |
| Extension type | Standard (not Web)                | Needs Node.js for API calls and file system   |
| AI SDK         | `@anthropic-ai/sdk` + `openai`    | Direct, no middleware                         |
| Webview UI     | Vanilla HTML/CSS/JS → React later | Start simple, migrate when complexity demands |
| Build          | esbuild (via vsce)                | Fast, standard for extensions                 |

---

## Key VSCode APIs to Learn (in order)

1. `vscode.commands` — register and execute commands
2. `vscode.window` — input boxes, quick picks, notifications, panels
3. `vscode.extensions.getExtension('vscode.git')` — git integration
4. `vscode.workspace` — file system, settings, workspace folders
5. `vscode.WebviewPanel` — custom HTML panels
6. `vscode.TextEditor` + `TextEditorEdit` — reading/writing editor content
7. `vscode.languages` — diagnostics, CodeLens, hover providers
8. `vscode.scm` — Source Control Manager integration

---

## Start Here (Phase 1, Step 1)

```bash
npm install -g yo generator-code
yo code
# Choose: New Extension (TypeScript)
# Name: yamac
```
