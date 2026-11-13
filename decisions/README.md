# Decisions

Why Aggregor works as it does: each problem we met, what we decided and why, the solution as built, and the alternatives
we turned down. The code, [DDD.md](../DDD.md), [storage.md](../storage.md) and [AGENTS.md](../AGENTS.md) say what holds
now; these files say why.

Decisions are grouped by feature: a file per feature, and a folder per feature once it has two files. There are no
dates, milestones or PR numbers; git keeps the history.

## Adding or changing a decision

Add a decision once it is agreed, in the same commit as the code it shapes, in its feature's file, or a new file when no
feature fits. When a decision changes, rewrite its entry to say what holds now, and move the old choice into its
Alternatives considered with why it was dropped. Leave a field out rather than guess.

```markdown
## What we decided, as a short sentence

- **Problem:** what forced a choice.
- **Decision:** what we picked, and why it won.
- **Solution:** how it is built: where it lives, how it works, and its limits when they matter. A link to the page that
  shows how it works, with the date it was made, when one was made.
- **Alternatives considered:** each option weighed, and why it lost.
```

## Index

- [product.md](product.md): What Aggregor is, and the order its big pieces come in.
- [workflow/development.md](workflow/development.md): Running and checking changes without touching the real VS Code.
- [workflow/stackedPrs.md](workflow/stackedPrs.md): How work lands: stacks of small PRs and their titles.
- [workflow/workingMode.md](workflow/workingMode.md): Who decides what, and where decisions, components and problems are
  written down.
- [architecture/constants.md](architecture/constants.md): Where constants live and what they may hold.
- [architecture/layers.md](architecture/layers.md): DDD.md's layers: what each holds and how they talk.
- [conventions/effect.md](conventions/effect.md): How the extension uses Effect.
- [conventions/lint.md](conventions/lint.md): What lint checks, where its setup lives, and how its messages read.
- [conventions/naming.md](conventions/naming.md): What things are called, and when a comment is worth it.
- [storage/database.md](storage/database.md): The SQLite tables, their rows and how they are read.
- [storage/files.md](storage/files.md): The folder Aggregor keeps its files in.
- [storage/migrations.md](storage/migrations.md): How stored data survives an update.
- [projects/projectList.md](projects/projectList.md): Which projects the Sessions view lists.
- [projects/workspace.md](projects/workspace.md): The project in view, and the workspace file Aggregor writes for it.
- [sessions/archive.md](sessions/archive.md): Archiving sessions, and stopping or keeping their agents.
- [sessions/ordering.md](sessions/ordering.md): How projects and sessions are put in order.
- [sessions/terminals.md](sessions/terminals.md): Where a session's agent runs, its tab, and resuming it.
- [sessions/titles.md](sessions/titles.md): The name a session shows.
- [agents.md](agents.md): Which CLIs a session can run, and how a session picks one.
- [status/pty.md](status/pty.md): The binary that runs each agent and records its status.
- [status/statusDisplay.md](status/statusDisplay.md): How a session's status shows on its row.
- [alerts.md](alerts.md): How a session out of view gets the user's attention: notifications and badge counts.
- [sessionsView/menus.md](sessionsView/menus.md): The Sessions view's title buttons and menus, its rows' buttons and
  menus, and the questions commands ask.
- [sessionsView/webview.md](sessionsView/webview.md): The Sessions view drawn in a webview of our own.
- [commitMessage.md](commitMessage.md): The Source Control button that writes a commit message.
- [tracing.md](tracing.md): Span names, the trace log, and the skill that reads it.
- [release/build.md](release/build.md): How the extension is bundled, checked and packaged.
- [release/dependencies.md](release/dependencies.md): How dependency versions are pinned and updated.
- [release/publishing.md](release/publishing.md): How a version is bumped, released and published.
