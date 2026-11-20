# Importing sessions

## A project imports its agents' earlier conversations as sessions

- **Problem:** Aggregor listed only the sessions it started. A conversation the user had with an agent in the project's
  folder before Aggregor, or outside it, couldn't be listed or resumed from the Sessions view.
- **Decision:** a project's … menu has **Import Sessions…**, a dialog in the webview that lists, under each agent, the
  conversations that agent had in the project's folder or one of its worktrees and that aren't sessions yet, newest
  first, each with its title and date; the ticked ones become sessions in the folder they ran in, named with their
  title, and clicking one resumes that conversation. Claude Code, Codex, OpenCode and GitHub Copilot record the folder
  each conversation ran in, so all four are read; Antigravity resumes only its latest conversation (`-c`), and a custom
  agent's history is unknown, so neither is offered. One list for every agent, rather than a picker per agent, since a
  project rarely has many.
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

## Conversations from the project's worktrees import into their worktree

- **Problem:** a conversation the user had in one of the project's git worktrees, made by Aggregor or by hand, wasn't
  offered, since only the project's own folder was read.
- **Decision:** the list reads each agent's history for the project's folder and for every worktree `git worktree list`
  gives now, and an imported conversation becomes a session in its worktree. Only worktrees that exist are read: an
  agent resumes a conversation only from the folder it ran in, so one from a removed worktree can't be resumed. Within
  each agent, the dialog shows the main folder's conversations under "<agent> · main folder" and the worktrees' under
  "<agent> · worktrees", each worktree row's second line leading with its folder name and branch, so the user sees where
  a conversation would resume.
- **Solution:**
  - `SessionImportService` yields `IWorktreeInfraService`; a project that is no git repository has no worktrees, and a
    project that is itself a linked worktree isn't read twice. The folders are read concurrently and each on its own, so
    a folder whose history can't be read hides only its own conversations, and an agent stays newest first across all of
    them.
  - `ImportableSessionDto.worktree` holds the worktree's `{branchName, worktreePath}`, absent for the main folder;
    `ImportedSessionDto.worktreePath` comes back with the request and becomes the session's `worktreePath`.
  - Importing checks the worktree again: one gone since the list was drawn is skipped, and the span's
    `worktreeGoneCount` says how many.
  - Remove Session removes a session's worktree only when it sits in Aggregor's worktrees folder or the project's
    worktree folder setting (`isMadeByAggregor`), so a session imported into the user's own worktree leaves it in place.
- **Alternatives considered:**
  - One section per worktree: a long dialog when a project has many worktrees, for a folder name the row already shows.
  - Reading the folders of removed worktrees from each agent's history: their conversations can't be resumed.

## The import dialog's search filters the list in the webview

- **Problem:** with worktrees read too, an agent can offer many conversations, and finding one by scrolling is slow.
- **Decision:** a search field above **Select all** filters the rows in the webview: a row shows when its title or its
  second line (worktree, branch, date) holds the typed text, ignoring case and surrounding spaces. The whole list is
  already on the page, and the back end takes complete requests, so a search needs no round trip.
- **Solution:** the checklist's hook keeps the search text and the ticked rows. A section with no row left disappears,
  and a line says when nothing matches. **Select all** ticks or unticks the rows shown; a ticked row the search hides
  stays ticked and is imported.
- **Alternatives considered:**
  - Searching in the host: a round trip per keystroke for a list the page already holds.
  - Unticking rows the search hides: the user would lose picks by narrowing the list.
