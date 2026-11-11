---
name: trace
description:
  Find why Aggregor misbehaved from its trace log, check the cause against the code and its stored files, then file it
  as a GitHub issue through the issue skill. Use when the user reports something Aggregor did wrong or stuck, asks to
  read, analyze or debug the trace or the logs, or runs /trace.
---

# Trace

Aggregor writes every span it runs and every Effect log to the **Aggregor App** output channel, which VS Code also
writes to disk per window. This skill reads that file and VS Code's own logs beside it, finds the first thing that went
wrong, proves it from the code and the stored files, and files the issue. It changes nothing: no fix, no staging, no
writes to Aggregor's files.

## 1. Find the log

The installed extension's log, newest last (VS Code keeps a folder per session and one per window):

```bash
find ~/.config/Code/logs -name "Aggregor App.log" -printf '%T+ %s %p\n' | sort | tail
```

- macOS: `~/Library/Application Support/Code/logs`; VS Code Insiders: `Code - Insiders` in place of `Code`.
- F5's Extension Development Host logs under the same tree, in its own session folder.
- The headless test window: `node .claude/skills/verify-in-vscode/vscode.ts log`.

Pick the window whose file grew when the user saw the problem; ask which window when several did.

## 2. Check that it holds spans

A span line reads `[trace] aggregorApp.openSession > … 0.8ms ok`, or `[info] [trace] …` when the
`aggregorApp.traceLogging` setting wrote it. A log with only `[warning]` and `[error]` lines ran at the channel's
default level with trace logging off: read those, then ask the user to turn on **Aggregor App › Trace Logging** in the
Settings editor, reproduce the problem, and run this again. Say what the warnings alone show and what they don't; don't
fill the gaps with guesses.

## 3. Read it

- **A span line** is `<time> [<level>] <root> > <child> > … <duration>ms <outcome> <attribute>=<value> …`. The root is a
  command ID (`aggregorApp.*`, listed in `apps/extension/package.json`) or, for background work such as a watcher, a
  layer's `<Owner>.make`. A span ends after its children, so a call's lines print innermost first.
- **An outcome** is `ok`, or `failed: <ErrorTag> <field>=<value> …`, `failed: defect <Error>: <message>` or
  `failed: interrupted`. The deepest span that failed is where the failure started; the first ancestor that ends `ok`
  handled it. Handled failures are routine (a cancelled pick, a session removed meanwhile); the lead is a failure
  nothing expected, or a handled one followed by the wrong result.
- **Attributes** after the outcome are what the code annotated the span with, such as `projectPath` and
  `workspaceFolderPaths` on `WorkspaceInfraService.showOnlyProjectFolder`.
- **`[warning]` and `[error]` lines** carry the message, then the cause with a stack whose frames are span names:
  `at WorkspaceInfraService.updateWorkspaceFolders (file:///…/dist/extension.js:15984:16)`.
- **From a span to its code:** `<Owner>.<const>` is the const in the file named for the owner:
  `WorkspaceInfraService.showOnlyProjectFolder` is `showOnlyProjectFolder` in
  `apps/extension/src/infrastructure/services/vscode/workspace.infraService.ts`, and `<Owner>.make` is its layer's
  `make<Owner>`. `grep -rn '"<span name>"' apps/extension/src` finds it.
- **The timeline:** take the lines from a little before the user's report to the end, and find the first failure. A
  failure that repeats is usually the effect of an earlier one, whose state it keeps hitting.

## 4. Read VS Code's side

The window's folder (the log path up to `window<n>`) holds VS Code's own logs for the same moments:

- `renderer.log`: VS Code's errors, such as a settings write it refused.
- `exthost/exthost.log`: the extension host's errors and every extension's activation.
- `exthost/<extension id>/…`: other extensions' channels, such as `vscode.git/Git.log`, which shows each repository
  Source Control opened and when.

When a cause hinges on what VS Code does, read its code under `/usr/share/code/resources/app/out/vs/` (minified, one
long line per file: search with `timeout 90 grep -o '.\{0,300\}<needle>.\{0,600\}' <file>`), and note the version from
`/usr/share/code/resources/app/package.json`.

## 5. Check the stored state

Read only, never write: `~/.aggregor` for the installed extension, `~/.aggregorDev` for F5, or `$AGGREGOR_HOME`.

- `anchor/Aggregor.code-workspace`: the workspace's folders and the shown project's settings.
- `anchor/copiedProjectSettings.json`: the project whose settings were last copied in, and what they were.
- `anchor/Aggregor/.vscode/settings.json`: the anchor folder's settings, its terminal folder set to the shown project.
- `anchor/sessionToReopen.json`: the session a reload reopens, when one is pending.
- `data/aggregor.db`: projects and sessions, in SQLite; open it with `?mode=ro`.

Compare what they hold with what the trace says happened, and with what the user saw.

## 6. Explain the cause

Before filing, have the cause in three parts: what the user saw, the chain from the first failure to it (log lines with
their times, and the code at `file:line` that made each step), and what the evidence leaves open. Say which parts the
log proves and which are inferred. Tell the user what you found, with the immediate way out when there is one (such as
reloading the window).

## 7. File it

Follow `.claude/skills/issue/SKILL.md`: its four sections, label and branch. Running this skill is the request to file.

- **Reported:** the user's words.
- **What might have gone wrong:** the chain from step 6.
- **How it was checked:** the log files and lines (times in UTC: VS Code writes local time), the VS Code version, the
  code read and the stored files compared, and what wasn't checked.
- **Proposed solution:** the fix, and how to verify it, in the headless window when it can be reproduced there.

The repo is public. Quote only the lines that matter, write `~/` for the home folder, and replace the name of any
project that isn't Aggregor with `<project>`, unless the user says otherwise.
