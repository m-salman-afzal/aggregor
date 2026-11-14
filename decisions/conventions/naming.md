# Naming and comments

What things are called, and when a comment is worth it.

## A comment is one line, and only for what the code hides

- **Problem:** comments restated what well-named code already says, and described history and options not taken. A rule
  in prose alone didn't hold: file headers, a line above every type, member and constant, and step-by-step narration
  kept coming back.
- **Decision:** a comment only for a hidden side effect or a behaviour a reader can't see in the code, such as a
  platform limit, a workaround or a constraint from outside the file, in one line; nothing that says what a file, type,
  function or line is or does, no history, no library defaults we override, no options we didn't take. History and
  options go here instead. The naming rules make code readable on its own, so comments stay a rarity, and one line
  leaves no room to narrate.
- **Solution:** `aggregor/one-line-comment` (`packages/eslint/src/rules/`), on every TypeScript file, reports a block
  comment that spans lines and line comments on consecutive lines. A directive a tool reads (`eslint-disable`, `@ts-`, a
  triple-slash reference) is not counted, so a one-line reason may sit above one. It can't judge whether a line is
  obvious; that stays with review. CSS and Rust are not linted.
- **Alternatives considered:** prose only, which drifted; a cap on comments per file, which punishes the files with real
  platform quirks.

## "Project", not "repo"

- **Decision:** "repository" means only a DDD repository or a git repository. Lint's abbreviation rule suggests
  "project" for "repo".

## Names say what a thing is to the user

- **Problem:** `IPromptInfraService` read like an LLM prompt, and `clickedProject` named the gesture, not the thing.
- **Decision:** `IUserInputPromptInfraService` (`userInputPrompt.infraService.ts`), and the webview's `UserInput` and
  `userInputDialog/`; "prompt" is kept for LLM prompts. `chosenProject` and `chosenSession` for what a command acts on,
  chosen from its row or the picker: `newSessionInChosenProject` (also the command ID), `openChosenSession`,
  `renameChosenSession`, `removeChosenSession` and `removeChosenProject`, with the raw argument named `projectRow` or
  `sessionRow`. `prepareColumns` became `replaceUndefinedWithNull`, and `writeRowLast` `writeRowAtEnd`. Lint's
  abbreviation rule suggests "chosen" for "clicked", and `AGENTS.md`'s naming rule says it. A name a person reads
  without the code open should say what the thing is.
- **Alternatives considered:** `activeProject` or `openedProject`: "active" and "opened" already describe the project
  shown in the window, and a session you remove or rename may be closed or idle. `selectedProject`: VS Code's tree
  selection, which an inline button doesn't change.

## The CLIs a session runs are agents, one word everywhere

- **Problem:** the code called them harnesses (the settings entries, `HarnessEntity`) and agents (the running process,
  its status, the texts the user reads), two words for one thing.
- **Decision:** agent everywhere: `AgentEntity`, `IAgentRepository`, `AgentIdValueObject`, `AgentIconValueObject`,
  `AgentListItemDto`, `agent.constant.ts`, `assets/agents/`, the settings `aggregorApp.agents`,
  `aggregorApp.defaultAgent` and `aggregorApp.skipAgentPicker`, and the `sessions.agentId` column; the stack's branch
  names keep `harness-foundation`, since pushed branches aren't renamed. Lint (`AGENT_NAME_BAN` in `syntaxBans.ts`)
  rejects the other word in names and texts in the extension and `@pkg/constants`. One word for one thing, and the one
  users already use.
- **Alternatives considered:** harness everywhere, considered the same day and dropped: "agent" is what users, the
  agents' own docs and the product description call them.
