# Commit messages

The Source Control button that writes a commit message.

## Commit messages come from a shell command

- **Decision:** `aggregorApp.commitCommand` runs in the repository root with the staged diff on stdin and prints the
  message. The default runs `claude -p` on `claude-haiku-5-5` at low effort, with the prompt on one line and no double
  quotes so it runs the same under sh and cmd.exe.

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
