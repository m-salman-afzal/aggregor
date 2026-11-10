---
name: issue
description:
  File a problem in aggregor as a GitHub issue, with a branch for its fix linked to it. Use when the user asks to
  create, open or file an issue, to note a problem down for later, or runs /issue.
---

# Issues

A problem to solve later is a GitHub issue on `m-salman-afzal/aggregor`, with a branch for its fix linked to it, so
nothing waits in prose or in a conversation.

## 1. Know the problem

Before writing, have each of these from the conversation, the code, logs or data. Investigate what's missing, read-only:
don't fix it, and don't stage or commit anything.

- **Reported:** what the user saw, in their own words, quoted, or the line of `decisions.md`, `phase2.md`, the README or
  a `shortcut:` comment that put it off.
- **What might have gone wrong:** the code path involved and the likely causes, the likeliest first, each with why.
- **How it was checked:** what was read or run and what it showed (files, commands, data, logs, versions), and what
  wasn't checked.
- **Proposed solution:** how to confirm the cause when it is still open, the fix for each cause, and how to verify it.

## 2. Write the issue

The repo is public: write `~/` instead of the home folder, times in UTC, and leave out names, emails, tokens and the
contents of other people's files.

- **Title:** the problem as the user sees it, at most 72 characters, no trailing period: "Session stays done after you
  switch to it".
- **Label:** `bug` when something works wrongly, `enhancement` for an improvement or something put off, `help wanted`
  for a check that needs a machine, system or account the agent doesn't have.
- **Body**, written to a file in the scratchpad:

  ```markdown
  ## Reported

  ## What might have gone wrong

  ## How it was checked

  ## Proposed solution
  ```

```bash
gh issue create --repo m-salman-afzal/aggregor --title "<title>" --label <label> --body-file <body file>
```

## 3. Make its branch

From the repo root, `gh issue develop` creates the branch on GitHub, from `dev` and linked under the issue's Development
section, so it is pushed as it is made, then fetches it. The working tree may hold other work, so don't check it out
unless the user asks.

```bash
gh issue develop <number> --repo m-salman-afzal/aggregor --base dev --name <type>/<slug>
```

- `<type>`: `fix` for a bug, `feat` for a new behaviour, `refactor` for the same behaviour done better, `chore` for a
  check or upkeep.
- `<slug>`: what the fix does, in kebab-case.

The branch has no commits of its own, so Auto PR opens no PR until its first push with one; the push runs Checks once.
Work on it later starts with `git switch <type>/<slug>`, and its first commit names the change, since Auto PR titles the
PR with it.

## 4. Report back

The issue's link, its label and the branch's name, one line each; several issues as a list.
