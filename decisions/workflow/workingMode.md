# Working mode

Who decides what, and where decisions, components and problems are written down.

## Claude implements, the user decides

- **Decision:** Claude writes the code; the user decides where code goes, which APIs and how. Each PR starts with a
  decision list with a recommended default per item. Every commit needs the user's explicit OK, even after a stack's
  decisions are approved. The user owns the design and reviews each change before it is committed.
- **Alternatives considered:** the user types while Claude guides (the earlier learning mode).

## Ledgers for storage and decisions

- **Decision:** `storage.md` gets an entry for anything new the extension stores: a table in its database, a file under
  `globalStorageUri`, or a key in `globalState`; `decisions/` gets every decision, kept up to date each session. The
  user wants a running record of what the extension stores, and of each choice and its reasons.

## Problems for later are GitHub issues, each with its branch

- **Problem:** problems put off for later sat in the decisions' Limits, a plan file's notes, the README and code
  comments, where nothing tracked them and a new conversation had to find them again.
- **Decision:** when the user asks for an issue, the `issue` skill (`.claude/skills/issue`) files it on GitHub with what
  was reported, what might have gone wrong, how it was checked and the proposed solution, labelled `bug`, `enhancement`
  or `help wanted`, then makes its branch with `gh issue develop` from `dev`, linked to the issue and pushed, without
  checking it out. GitHub tracks them in one place, each one says enough to start on it cold, and its branch is ready.
- **Alternatives considered:** a problems list in the repo, which is one more ledger to keep current; issues without
  branches.

## Components are listed in components.md

- **Problem:** what Aggregor is built on (tmux, aggregor-pty and its crates, SQLite, Effect, Drizzle, the build and
  release tools) was spread across decision entries, with no one place saying what part of each is used.
- **Decision:** `components.md` lists every component by where it runs (the user's machine, inside the extension,
  building and checking, releasing): what it is, what part we use, why, and the alternatives, naming the decision entry
  that weighed them. A component no entry weighed says so, and its other options are marked as not weighed. `decisions/`
  keeps the full reasoning; `AGENTS.md` asks for components.md to change in the same commit as the use. A component's
  use and its reason read in one place, without walking the decision history.
- **Alternatives considered:** keeping it in the decisions only, which are grouped by feature, not by component.

## Explainers are linked from the decision they explain

- **Problem:** the pages made to show how something works (a migration run, the layers, the Effect rules) were found
  again only by searching past sessions.
- **Decision:** a decision's Solution links the page that shows how it works, with the date it was made, since a page
  shows the code as it was that day. Only "Every schema change is a migration on the user's database" has one so far.
- **Solution:** the pages are private artifacts, so the links open only for the user, though the repo is public.

## Decisions are kept by feature, in `decisions/`

- **Problem:** one `decisions.md`, by milestone, stack and step, grew past 2,600 lines, and a reader looking for why a
  feature works as it does had to know when it was decided.
- **Decision:** a `decisions/` folder with a file per feature, and a folder per feature once it has two files; each
  entry holds only the problem, the decision and why it won, the solution as built, and the alternatives considered. No
  dates, milestones, PR numbers or steps: a changed decision is rewritten to say what holds, and the old choice moves to
  its alternatives with why it was dropped. A reader looks for a feature, not a date, and git keeps the history.
- **Solution:** `decisions/README.md` holds the format and an index of every file. A decision goes into its feature's
  file in the same commit as the code it shapes.
- **Alternatives considered:** one file by milestone, stack and step, with dates and **Replaces:**/**Replaced by:**
  links, as before, which reads in the order things happened but buries a feature's current decision; a file per stack,
  which still splits a feature across stacks; a file per milestone, which leaves files of nearly 2,000 lines.
