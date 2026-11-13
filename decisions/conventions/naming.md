# Naming and comments

What things are called, and when a comment is worth it.

## Comments are rare and say only what the code does now

- **Problem:** comments restated what well-named code already says, and described history and options not taken.
- **Decision:** a comment only where the code can't say why at a glance, such as a platform limit or a hidden
  constraint, in one line; no history, no library defaults we override, no options we didn't take. History and options
  go here instead. The naming rules make code readable on its own, so comments stay a rarity.

## "Project", not "repo"

- **Decision:** "repository" means only a DDD repository or a git repository. Lint's abbreviation rule suggests
  "project" for "repo".

## Names say what a thing is to the user

- **Problem:** `IPromptInfraService` read like an LLM prompt, and `clickedProject` named the gesture, not the thing.
- **Decision:** `IUserInputPromptInfraService` (`userInputPrompt.infraService.ts`), whose `askForText` takes a
  `question`; "prompt" is kept for LLM prompts. `chosenProject` and `chosenSession` for what a command acts on, chosen
  from its row or the picker: `newSessionInChosenProject` (also the command ID), `openChosenSession`,
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
