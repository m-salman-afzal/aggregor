# Tree views

The Sessions and Archive views' rows, menus and buttons.

## A gear in the Sessions title bar opens Aggregor's settings

- **Decision:** **Open Settings** (`aggregorApp.openSettings`, `$(gear)`) after Add Project opens the Settings editor at
  `@ext:<extension id>`. `routes.ts` registers it straight to `openAggregorSettingsInSettingsEditor` in `@pkg/vscode`,
  with `presentAppCommandError`, the presenter for commands that cannot fail. It reads and writes no data, and
  presentation already opens settings itself for an error's Open Settings button.
- **Alternatives considered:** a controller, `SettingsService` and an `ISettingsConfig` call, so every command takes the
  same path.

## The session in front stays selected in the Sessions view

- **Problem:** the view selected a session when its terminal became active, which failed for a new session (its row is
  drawn a moment after its tab opens, so the warning "Could not select the active session" was logged and nothing was
  selected), and any click elsewhere in the view moved the selection off it.
- **Decision:** the row of the session whose tab is in front (`viewedSessionId`) is selected whenever that session
  changes, the user selects a project row or nothing, or the view comes into sight. Selecting a session row is left
  alone, since its click opens that session and brings it to the front: putting the old row back first made the
  selection jump between the two; a reveal that misses a row not yet drawn is retried every 250 ms, up to 8 times. With
  no session's tab in front, the selection is left alone. Arrow keys move the tree's focus, not its selection, so
  keyboard navigation still works, and Enter opens the focused session. The highlighted row always says which session
  the editor shows, like Explorer for the active file.
- **Alternatives considered:** selecting from the tree's own refresh, which the API gives no event for. Snapping back
  only from project rows, which still leaves a click on empty space.

## Questions are asked in VS Code's quick pick

- **Problem:** the confirmations were modal warnings, which VS Code draws as a system dialog, outside the window, under
  its default `window.dialogStyle`.
- **Decision:** `IUserInputPromptInfraService.askQuestion` replaces `confirm`: a quick pick titled with the question, a
  row per answer with a line on what it does, then Cancel. Cancel, Escape or a click outside fails with
  `QuestionCancelledError`, which the use cases take as no. Remove's question uses it too. It opens inside the window,
  takes the keyboard as the agent and project pickers do, and can't be lost.
- **Alternatives considered:** a notification with buttons, which can be missed and closes on its own; changing
  `window.dialogStyle`, the user's setting for every extension.

## Menu items start with a glyph

- **Problem:** the … menus are text only, and the user wants to tell their items apart at a glance.
- **Decision:** every menu item's title starts with a plain Unicode glyph, so the items stay in line: ∧ Move Up, ∨ Move
  Down, ■ Stop Agent, Stop Agents and Stop All Agents, ✎ Rename, ⤓ Archive, ⤒ Unarchive, ✕ Remove and Remove Project. An
  em space (`\u2003` in the manifest) follows the glyph: HTML doesn't collapse it, as it does a run of plain spaces. The
  commands are hidden from the Command Palette, so the glyphs show only in the menus. The menu font draws them as text,
  in both themes, with nothing to bundle.
- **Solution:** a screen reader reads each glyph's name before the item; ∧ ∨ are the logical and and or signs, chosen
  because they match each other's size and line, which ⌃ ⌄ and ˄ ˅ don't; ⤓ ⤒ are thin; and the glyphs differ in width,
  so the words after them start a few pixels apart.
- **Alternatives considered:** codicons (`$(archive) Archive`), which VS Code drops from menu items; inline icon buttons
  on the rows, which crowd them; emoji such as 🗑, drawn in colour and wider than the rest.
