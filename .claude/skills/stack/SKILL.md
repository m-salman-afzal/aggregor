---
name: stack
description:
  Start a stack of stacked PRs, or cut the next branch on an existing stack, in aggregor. Use when the user asks to
  start or begin a stack, add the next branch or PR to a stack, or runs /stack.
---

# Stacks

A stack is a chain of branches, each built on the one below it, that GitHub shows and merges as one stack of PRs.

## Branch names

`stack/<name>/<n>/<type>/<slug>`

- `<name>`: the stack, shared by all of its branches. Kebab-case, no slashes.
- `<n>`: the position in the stack, from `0`, without leading zeros.
- `<type>`: `feat`, `fix`, `chore`, `refactor` or `hotfix`.
- `<slug>`: what this branch does. Kebab-case, no slashes.

Derive the name, type and slug from the user's request and show the branch name when creating it. Ask only when the type
is unclear.

## Start a stack

Check that the name is free, since a reused name breaks the parent lookup, then branch from the latest `dev`:

```bash
git ls-remote --heads origin "refs/heads/stack/<name>/*"   # must print nothing
git fetch origin dev
git switch -c stack/<name>/0/<type>/<slug> origin/dev
```

## Next branch

From the top branch of the stack, `stack/<name>/<n>/...`:

```bash
git switch -c stack/<name>/<n+1>/<type>/<slug>
```

Stop and say so if the current branch isn't a stack branch, or if a `stack/<name>/<n+1>/` branch already exists locally
or on origin.

## On push

`.github/workflows/auto-pr.yaml` does the GitHub side, so don't open or retarget stack PRs by hand:

- `n = 0` opens a PR into `dev`.
- `n > 0` opens a PR into the stack's branch at `n - 1` and adds it to that PR's GitHub stack. The stack is created when
  the `n = 1` PR opens.
- A branch with no commits of its own gets no PR until a push that has some.
- Push bottom-up. A branch whose parent isn't on GitHub yet fails the workflow.

Don't run `gh stack init`, `add`, `submit` or `sync`: Auto PR owns the stack on GitHub, and a second owner diverges from
it. `gh stack view` and `gh stack checkout` are fine for reading.

## Changing a lower branch

Commit on that branch, then merge it up through every branch above it, in order, and push them:

```bash
git switch stack/<name>/<k+1>/<type>/<slug>
git merge stack/<name>/<k>/<type>/<slug>
# repeat for k+2, k+3, ... up to the top
```

Never rebase or force-push a stack branch, and don't use **Rebase Stack** on GitHub.

## Landing

Merge the top PR on GitHub with **Create a merge commit**, or run `gh stack merge <top PR number>` and pick the merge
commit method. Every PR in the stack lands on `dev` together as one merge commit. Never squash.

## Still applies

From `AGENTS.md`: post a PR's decision list and wait for approval before writing its code, and commit or push only when
the user asks.
