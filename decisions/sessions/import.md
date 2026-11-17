# Importing sessions

## A project imports its agents' earlier conversations as sessions

- **Problem:** Aggregor listed only the sessions it started. A conversation the user had with an agent in the project's
  folder before Aggregor, or outside it, couldn't be listed or resumed from the Sessions view.
- **Decision:** a project's … menu has **Import Sessions…**, a dialog in the webview that lists, under each agent, the
  conversations that agent had in the project's folder and that aren't sessions yet, newest first, each with its title
  and date; the ticked ones become sessions in the project's root, named with their title, and clicking one resumes that
  conversation. Claude Code, Codex, OpenCode and GitHub Copilot record the folder each conversation ran in, so all four
  are read; Antigravity resumes only its latest conversation (`-c`), and a custom agent's history is unknown, so neither
  is offered. One list for every agent, rather than a picker per agent, since a project rarely has many.
- **Solution:**
  - `IAgentHistoryInfraService.listAgentConversations(agentId, folderPath)` reads the agent's own store, read-only and
    when asked: Claude Code's `~/.claude/projects/<folder with each symbol as ->/*.jsonl`, only the files at the top
    (subagents' transcripts sit in a folder per conversation), the title from the last `custom-title` or `ai-title` in
    its last 64 KB, else the first prompt in its first 64 KB; Codex's `threads` table in `state_5.sqlite`, as Codex's
    own list filters it; OpenCode's `session_v2` and its first user message, without child sessions; Copilot's
    `session-state/*/workspace.yaml`, whose `cwd` must match. A conversation with no title and no prompt never got
    going, and isn't listed. Each store follows the variable its agent reads to move it.
  - A new column, `sessions.importedAgentSessionId`, holds the agent's id. When set, it fills `${sessionId}` in the
    agent's arguments, and `${agentSessionId}` until the agent reports its own, and the session resumes from its first
    click (`SessionEntity.conversationId`, `latestAgentSessionId`, `hasConversation`). OpenCode's id is stored without
    its `ses_`, which its arguments add.
  - A conversation is a session already when its id is a session's `id` (Aggregor gives Claude, OpenCode and Copilot its
    own id), `agentSessionId` (Codex) or `importedAgentSessionId`; importing checks again, so a second Import adds
    nothing twice. A removed session's conversation is offered again.
  - `SessionImportService` lists and imports; the dialog asks with `ListImportableSessions` and sends
    `aggregorApp.importSessions` with the ticked ones.
- **Alternatives considered:**
  - Writing the imported id into `agentSessionId`: aggregor-pty is that column's only writer.
  - Using the agent's id as Aggregor's session id: Aggregor's ids are UUID v7, and older Claude ids are v4.
  - Running each CLI's own list (`opencode session list`, `codex resume` pickers): slower, and each prints a different
    shape.
  - An agent picker in the dialog, as the issue first proposed: a second step for a short list.
