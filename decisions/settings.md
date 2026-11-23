# Settings

Aggregor's settings in VS Code's Settings editor.

## Settings are grouped by what they are about

- **Problem:** every setting sat in one flat list under Aggregor App, fourteen of them, with nothing in the Settings
  editor's sidebar to jump to one area.
- **Decision:** six groups, each named for what its settings are about: Sessions (`openSessionIn`, `pinSessionTabs`,
  `sessionMemoryLimit`), Agents (`agents`, `defaultAgent`, `skipAgentPicker`), Source Control (`commitCommand`,
  `autoCommit`, `autoPush`, `openPullRequestIn`), Notifications (`notifyOn`), Appearance (`fontSize`, `accentColor`) and
  Diagnostics (`traceLogging`). The keys stay as they are (`aggregorApp.autoCommit`): the groups come from the manifest
  alone, so nobody's `settings.json` changes.
- **Solution:** `contributes.configuration` in `apps/extension/package.json` is a list of categories, each with a
  `title` and its `properties`. VS Code lists the titles under Extensions › Aggregor App in the Settings editor's
  sidebar, in the order written, and draws each as a heading over its settings. Within a group VS Code sorts the
  settings by key. Open Settings searches `@ext:<extension id>`, and a search lists its results without headings, so
  there the groups show in the sidebar only, under Extensions.
- **Alternatives considered:** nested keys such as `aggregorApp.sourceControl.autoCommit`, which rename every key and
  add nothing to the sidebar; `openPullRequestIn` in a group of its own, one setting under a second git heading;
  `notifyOn` under Sessions, which hides the one setting that decides when Aggregor interrupts.
