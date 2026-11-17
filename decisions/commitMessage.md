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
