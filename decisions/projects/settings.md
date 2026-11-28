# Project settings

What a project remembers about how its sessions start.

## A project's settings are one JSON column, edited from its … menu

- **Problem:** worktree mode needs per-project choices (where worktrees go, which untracked files they get, a setup
  script, whether new sessions start in one), and more will follow; a column each would need a migration each.
- **Decision:** `projects.settings`, one JSON text column, `{}` until saved, decoded by `ProjectSettingsValueObject`.
  Every key has a default and falls back to it when a stored value no longer decodes, so a new setting is a schema field
  and a stored project always reads. The extension writes the object whole. **Project Settings…** in a Sessions-list
  project's … menu opens a form in the view's dialog; Save sends `saveProjectSettings {projectPath, settings}`, which
  gives a listed project its row first. The settings are personal: they live in Aggregor's database, not in the
  repository.
- **Solution:** the repository stores an object column as its JSON text, through `Schema.fromJsonString`. SQL can't
  query or constrain inside the column, which no read needs. Renaming a key needs the decoder to read the old one for a
  while, where a column rename needs two releases. New Session reads them when it starts a session in a worktree (see
  `sessions/worktrees.md`); Clean Up Worktrees reads `cleanUpBaseBranch`, the branch whose merged branches it ticks,
  `dev` until changed, since the user's repositories merge their work into `dev` and release from `main`.
- **Alternatives considered:** a column per setting, a migration each. VS Code's resource-scoped settings, which would
  write into the project's `.vscode/settings.json`. A file in the repository (`aggregor.json`, like Conductor's
  `conductor.json` or Orca's `orca.yaml`) to share settings with a team: left until a team needs it; the one shared
  convention, `.worktreeinclude`, is read from the repository as it is.

## The setup script is a field of several lines

- **Problem:** the setup script was a one-line input, and a browser drops the line breaks of text pasted into one. A
  script of four commands was saved as one line, so its first command took the others as its arguments, and the script's
  fallback built `aggregor-pty` with cargo, 40 s, before the agent of every new worktree started.
- **Decision:** the setup script is typed and shown in a field of several lines, and stored as typed, line breaks
  included. The shell already runs it as a script, so nothing else changes. Enter in the field starts a new line and no
  longer saves the form, as in any such field.
- **Solution:** `SettingsTextAreaField`, beside `SettingsTextField` in the project settings form, on `@pkg/ui`'s
  `Textarea`, which grows with its text (`field-sizing: content`). A script saved as one line stays as it is until it is
  entered again.
- **Alternatives considered:** a `multiline` prop on `SettingsTextField`, one component drawing two different inputs.
  Splitting a stored one-line script back into commands, which can't tell where a command ended. Asking for commands
  joined by `;`, which keeps the trap for the next pasted script.
