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
  while, where a column rename needs two releases. The settings take effect with worktree sessions; until then they are
  only stored.
- **Alternatives considered:** a column per setting, a migration each. VS Code's resource-scoped settings, which would
  write into the project's `.vscode/settings.json`. A file in the repository (`aggregor.json`, like Conductor's
  `conductor.json` or Orca's `orca.yaml`) to share settings with a team: left until a team needs it; the one shared
  convention, `.worktreeinclude`, is read from the repository as it is.
