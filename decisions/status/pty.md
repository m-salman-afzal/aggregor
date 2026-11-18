# aggregor-pty

The binary that runs each agent and records its status.

## `aggregor-pty` runs each agent and records its status

- **Problem:** status has to come from the agent's own OSC 7501 reports and titles, which only something sitting between
  the agent and its terminal can read, and VS Code's terminal API can't.
- **Decision:** a Rust binary in `apps/pty`, on portable-pty 0.9 (last released February 2025, kept because it also does
  native Windows), rusqlite with bundled SQLite, base64, rustix for raw mode and window size, and signal-hook. It passes
  every byte through, answers `OSC 7501 ; ?` with the bare reply, checks reports against the spec's rules and limits,
  and writes the root record onto the session's row: `status`, `statusKind`, `statusMessage`, `statusProgress`,
  `statusChangedAt` (only when the state changes), `hasWorked`, `reportedTitle` and, from OSC 0/2, `terminalTitle`, and
  `agentSessionId` when that title is a bare UUID (see "Codex resumes its own conversation by id"). It starts at
  `unknown`, `clear` and a full reset go back to `unknown`, and the agent's exit writes `exited`; reports with an `id`
  are not read yet (session tasks, not built). A writer thread keeps the latest pending change and writes title changes
  at most every 500 ms. The agent runs whatever happens to the database; errors go to `aggregor-pty.log` beside it, at
  most 10 lines a run. A session's tmux session runs `aggregor-pty --database ‹path› --session ‹id› -- ‹agent command›`:
  the tmux infra service wraps the agent's launch plan, and `getDatabaseFilePath` gives it and the database layer the
  same path. The reports carry what each agent knows, in one format. Two title columns leave step 4's title rule to the
  domain. Codex's title spinner changes about ten times a second, and every write makes the window read the rows it
  changed.
- **Alternatives considered:** writing the pty layer ourselves on rustix: fewer and newer crates, but Unix only. One
  `agentTitle` column with the binary picking the title. Writing the database from the output thread, which a locked
  database would stall. Printing errors, which would land on the agent's screen.

## `aggregor-pty` answers `OSC 7501 ; ?` before passing the output on

- **Problem:** Claude asks `OSC 7501 ; ?` together with a DA1 query that tmux answers, and takes OSC 7501 as unsupported
  when tmux's DA1 reply arrives first. It never asks again, so that session shows only legacy title marks (`✳`) and
  stays at `unknown` until the agent restarts. Passing a chunk to tmux before scanning it let tmux answer first whenever
  our write waited on tmux.
- **Decision:** scan each chunk of the agent's output, answering queries, before writing it to our terminal, so our
  reply always reaches the agent ahead of anything tmux says about the same chunk.
- **Alternatives considered:** answering DA1 ourselves as well, which takes the terminal's identity away from tmux.

## Rust for `aggregor-pty`, checked like the TypeScript

- **Decision:** edition 2024, the toolchain pinned to 1.99.1 in `apps/pty/rust-toolchain.toml`, `rustfmt.toml` at
  Prettier's 120 columns. `apps/pty` is a pnpm workspace package, so `pnpm pty:check` (`cargo fmt --check` and
  `cargo clippy -D warnings`) runs in `pnpm quality`, `pnpm pty:test` runs the tests, and the pre-commit hook runs
  `rustfmt --check` on staged `.rs` files. `.vscode/settings.json` points rust-analyzer at the crate. The extension's
  `build:pty` copies the host build to `apps/extension/bin/`, which `compile`, `package` and the `verify-in-vscode`
  skill run. One command checks the whole repo, and the end-to-end test builds its database from the extension's
  migrations, so a schema change that breaks the binary fails its test.
