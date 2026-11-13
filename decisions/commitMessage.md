# Commit messages

The Source Control button that writes a commit message.

## Commit messages come from a shell command

- **Decision:** `aggregorApp.commitCommand` runs in the repository root with the staged diff on stdin and prints the
  message. The default runs `claude -p` on `claude-haiku-5-5` at low effort, with the prompt on one line and no double
  quotes so it runs the same under sh and cmd.exe.

## Wait for the git extension before reading its API

- **Problem:** the git extension may not be active yet when aggregor reads its exports.
- **Decision:** call its `activate()` and use what it returns.
