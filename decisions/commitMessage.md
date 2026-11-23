# Commit messages

The Source Control button that writes a commit message.

## Commit messages come from a shell command

- **Decision:** `aggregorApp.commitCommand` runs in the repository root with the staged diff on stdin and prints the
  message. The default runs `claude -p` on `claude-haiku-5-5` at low effort, with the prompt on one line and no double
  quotes so it runs the same under sh and cmd.exe.

## The default command loads none of the user's Claude Code setup

- **Problem:** `claude -p` loads the user's CLAUDE.md, memory, plugin hooks and MCP servers even with `--system-prompt`
  and `--tools ""`: a 600-byte diff sent 10k to 158k input tokens, Haiku thought for about 1,000 tokens, and the message
  took 7 to 9 seconds.
- **Decision:** the default adds `--strict-mcp-config --setting-sources ""`, so no settings file, plugin, hook or MCP
  server loads. The same diff sends 3.4k tokens with no thinking, in about 2.6 seconds, most of it Claude Code starting.
- **Solution:** the two flags in `aggregorApp.commitCommand`'s default and in `.vscode/settings.json`'s override.
  Sign-in still works, since it is not read from settings.
- **Alternatives considered:** `--bare`, leaner still, which signs in only with `ANTHROPIC_API_KEY` and so fails on a
  Claude subscription; `--setting-sources project`, which still loads the repository's own settings (about 8k tokens);
  turning thinking off with `MAX_THINKING_TOKENS=0`, which Haiku 5.5 ignored.

## The button commits and pushes, unless a setting turns either off

- **Problem:** the button wrote the message and, with `aggregorApp.autoCommit` on, committed; the push that nearly
  always follows was a second click, and auto commit itself was off until someone found the setting.
- **Decision:** `aggregorApp.autoCommit` and the new `aggregorApp.autoPush` are both on by default, so one click writes
  the message, commits and pushes. Auto push covers only the commit the button makes, and does nothing while auto commit
  is off. A branch with an upstream is pushed to it. A branch with none, as every new worktree's is, is published to
  `origin`, or to the repository's only remote, with its upstream set; a repository with no remote is only committed,
  with no error; several remotes with none called `origin`, or no branch checked out, fail with a message. A push that
  git refuses (rejected, offline, not signed in) leaves the commit in place and says the push failed: nothing is pulled
  and nothing is forced.
- **Solution:** `CommitMessageService.commitAsSettingsSay` calls `IGitInfraService.commit` and then its new `push`, and
  annotates its span with the two settings. The adapter pushes through the Git extension's API (`repository.push`), as
  it commits, so VS Code's credential helper answers and a failure is a `PushFailedError` on `GitInfraService.push`'s
  span, with its own message. The Git extension's API commits with `postCommitCommand: null`, so VS Code's own
  `git.postCommitCommand` never runs after a commit of ours, and this push is the only one. Publishing a worktree's
  branch gives it an upstream, and the title sync renames only a branch never pushed (see
  [worktrees.md](sessions/worktrees.md)), so a commit made before the agent's first title keeps the branch's first name.
- **Alternatives considered:** one setting with three values (message only, commit, commit and push), which rules out
  auto push without auto commit but is not the second switch asked for; leaving the push to VS Code's
  `git.postCommitCommand`, which the Git extension's API never runs; `git push` from a shell, which has no way to answer
  a credential prompt (`GIT_COMMAND.ENVIRONMENT` makes the git command line fail instead); failing on a branch with no
  upstream, which every new worktree's first commit would hit; an error for a repository with no remote, shown on every
  commit of a local-only repository.

## Wait for the git extension before reading its API

- **Problem:** the git extension may not be active yet when aggregor reads its exports.
- **Decision:** call its `activate()` and use what it returns.

## Nothing staged is an error, with no Stage All

- **Problem:** with nothing staged, the button offered **Stage All & Generate** in its error message, which kept a
  question inside the use case and a `stageAll` on the git port for one button.
- **Decision:** nothing staged fails with `NothingStagedError`, whose message says to stage the changes in Source
  Control, one click away beside the button. The use case asks nothing, and the git port lost `stageAll`.
- **Alternatives considered:** the Stage All button, built first; staging everything without asking, which commits what
  the user may not want.
