# Stacked PRs

How work lands: stacks of small PRs and their titles.

## Stacked PRs

- **Decision:** small feature-sliced PRs on `stack/<name>/<n>/<type>/<slug>` branches, cut by the `stack` skill. Auto PR
  opens each into the branch below and joins them into a GitHub stack; the top PR lands with a merge commit, never a
  squash. Once the branches below have landed, the lowest open branch opens into dev.

## PR titles are commit subjects with a feature scope, plus the stack's step

- **Problem:** `gh pr create --fill` takes the commit's subject as the title only when the PR opens with one commit;
  with more it falls back to the branch name (a branch such as `stack/harness foundation/1/feat/sqlite storage`). Scopes
  varied (`feat(extension)!:` next to `feat!:`), a stack PR's title didn't say its stack or step, and nothing checked
  the format, though each PR title goes into its merge commit.
- **Decision:** Auto PR titles each PR with its first commit's subject (`--fill-first`), and a stack PR adds
  `[<name> <n>]`: `feat(storage): keep sessions in SQLite [harness-foundation 1]`. A title is
  `<type>(<scope>): <subject>`, with `!` before the colon for a breaking change, and the scope is required: a feature
  (`sessions`, `projects`, `agents`, `status`, `alerts`, `workspace`, `commit-message`, `storage`), or `lint`, `deps`,
  `release`, or `repo` for anything no feature covers. The PR Title workflow fails any other title on a PR into anything
  but `main`, whose release PR is titled `v<version>`. The default commit prompt stays generic, with an optional scope
  for any repository; `.vscode/settings.json` overrides `aggregorApp.commitCommand` with the same prompt and aggregor's
  scopes, each with what it covers. Renovate writes `build(deps):` and `ci(deps):`, `bumpp` `chore(release):`. A PR that
  adds a feature no scope covers adds its scope to both lists. One title format from every source; a feature scope says
  what a change is about, and each stack PR's place shows in the PR list.
- **Alternatives considered:** titles built from the branch name (`feat(harness-foundation): sqlite storage`),
  consistent but with terse slugs; no stack in the title, since the branch name and GitHub's stack view show it. For
  scopes: none at all (briefly the choice), which drops what a title can say; one per package (`extension`, `pty`,
  `eslint`, ...), which needs no list but says `extension` on most commits; one per DDD layer, which most features cut
  across.

## A stack's bottom branch doesn't track dev

- **Problem:** m3 0 was cut with `git switch -c … origin/dev`, which made it track `origin/dev`, so its push went
  straight to `dev`: no PR, no GitHub stack, and a subject without a scope on `dev`.
- **Decision:** the stack skill cuts the bottom with `git switch --no-track -c`, so its first push gives it its own
  upstream (`push.autoSetupRemote`). One flag where the branch is cut, rather than a step to remember at every push.
