# Development

Running and checking changes without touching the real VS Code.

## Test builds never go into the real VS Code profiles

- **Problem:** a local `.vsix` install records `source: "vsix", pinned: true`, so VS Code ignored v0.0.4 from the
  Marketplace.
- **Decision:** test builds run only in the isolated verify profile; the real profiles install from the Marketplace.

## Verify changes in a headless VS Code

- **Problem:** every visible test window interrupted the user.
- **Decision:** the `verify-in-vscode` skill: headless mutter, driven over CDP on port 9447, reading the trace log from
  disk. Stop, UserPromptSubmit and SessionEnd hooks stop it. Nothing it starts may outlive the turn that started it.
- **Alternatives considered:** a visible window; Xvfb, which the user turned down to stay on Wayland; mutter
  `--headless` on a private D-Bus session.

## A behaviour change is checked in VS Code, not with a new test

- **Problem:** small unit tests for new behaviour, such as the pagination maths and the worktree diff counts, check the
  code apart from the window the user sees, and add files to keep up.
- **Decision:** a behaviour change is verified in the headless VS Code (`verify-in-vscode`) every time, and gets no new
  test. `pnpm test` keeps the migration test and the lint rules' tests.
- **Alternatives considered:** a small vitest test beside each new piece of logic, which was tried and dropped.
