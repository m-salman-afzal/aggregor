# Menus and buttons

The Sessions view's buttons and menus, on its lists and its rows, and the questions commands ask.

## The view's title bar is empty; its buttons sit on the Sessions list's header

- **Problem:** VS Code's title bar held New Session…, Add Project, Open Settings and a … menu whose items were text with
  glyphs, apart from the webview's lists and their icons.
- **Decision:** the manifest gives the view no title actions; the Sessions list's header in the webview holds New
  Session…, Add Project and Open Settings as buttons, always shown, then its … menu (Stop All Agents, Archive All
  Sessions). VS Code still draws the view's name above. One place for a list's actions, drawn like every row.
- **Solution:** `LIST_INLINE_ACTIONS` and `LIST_ACTION_GROUPS` in the webview's `sessions.constant.ts`. Open Settings
  (`aggregorApp.openSettings`) opens the Settings editor at `@ext:<extension id>`; `routes.ts` registers it straight to
  `openAggregorSettingsInSettingsEditor` in `@pkg/vscode`, with `presentAppCommandError`, since it reads and writes no
  data.
- **Alternatives considered:** a toolbar of its own at the webview's top, a row that holds nothing else; keeping VS
  Code's title actions, with their glyphs and apart from the lists; a controller and a settings service for Open
  Settings, so every command takes the same path.

## What a command asks shows as a dialog in the view

- **Problem:** a question, a rename or a pick asked in VS Code's quick pick, at the window's top centre, while the
  action that needed it started in the side bar; the eye has to jump there and back, which tires.
- **Decision:** every question, text and pick a command asks (a confirmation, Rename, the project and agent pickers)
  shows as a dialog in the Sessions view, over its lists, which blur behind it; the view comes into sight for it if it
  was hidden. Each opens with an icon for what it asks. A pick lists its choices as rows to click, each with its icon,
  its name over its description, a badge where it has one (the default agent's), and a second action where it has one,
  drawn as an icon button (an agent's star, Set as Default). A question says what its answer does, then offers Cancel
  and the answer as buttons; an answer that destroys something or cuts it short is red under a warning icon, and Cancel
  takes the focus, so Enter is the safe key. A text opens with its input focused and its text selected. Cancel, Escape
  and a click outside cancel. The folder picker stays VS Code's, the system's own dialog. The answer is given where the
  action started.
- **Solution:** `IUserInputPromptInfraService` keeps its methods; its infrastructure runs
  `SESSIONS_VIEW.SHOW_PROMPT_COMMAND` with a `ViewPrompt` (`@pkg/vscode`'s `viewPrompt.schema.ts`) and decodes the
  `ViewPromptAnswer` the command resolves with. The Sessions view registers that command: it keeps the one prompt
  waiting (a new one cancels it), sends it to the webview with its icons as webview URIs, sends it again when the page
  reloads, and resolves with the webview's `PromptAnswered`, or cancelled when the view closes. Neither layer imports
  the other: the command id and the schema in `@pkg/constants` and `@pkg/vscode` are their contract. A
  `QuestionRequest`'s answers say whether they are destructive, which `makeStopAgentsQuestion` and Remove's question
  set. The webview draws it with shadcn's dialog and input on Base UI.
- **Alternatives considered:** VS Code's quick pick and input box, as before; modal warnings, a system dialog outside
  the window; a notification with buttons, which can be missed; infrastructure posting to the webview itself, which
  would make it import the view; a question's answers as rows like a pick's, built first, which read as a list rather
  than a confirmation; Set as Default as a text button, which cut an agent's name short in a narrow view.

## Menu items have icons

- **Problem:** menu items that are text only are hard to tell apart at a glance.
- **Decision:** every item in the webview's menus draws a lucide icon before its label (`ROW_ACTIONS`), muted until the
  item is highlighted; Remove and Remove Project are red. The commands' titles in the manifest are plain words, since no
  VS Code menu shows them any more and the Command Palette hides them.
- **Alternatives considered:** a Unicode glyph and an em space at the start of each manifest title (∧ Move Up, ⤓
  Archive), which VS Code's text-only menus needed while the rows were a tree; codicons, which VS Code drops from menu
  items; emoji, drawn in colour and wider than the rest.

## A row has buttons, a … menu, and the same menu on right-click

- **Problem:** the webview's rows had no actions after the tree's menus went, so Archive, Move Up and Down, Stop Agent,
  Rename, Remove and New Session in a project could be reached from no row.
- **Decision:** a session's and a project's row shows its buttons and a … button over its end while it is hovered or
  focused, or while its menu is open; right-clicking it opens the same menu. A session's button is Archive, or Unarchive
  in the Archive; a project in the Sessions list has + for New Session. A list's header shows its buttons always. The
  menu items are the tree's, in its groups (order, agents, the row itself) and under the same conditions: Stop Agent
  only while the agent runs, Remove Project only for an added project. Move Up and Move Down share one row, Move, as its
  two arrow buttons, each shown only where the row moves that way. Each runs its command on the row's node id. The
  buttons sit over the row's end on the hover colour, so showing them changes no row's size, and a right-click is what
  the tree offered.
- **Solution:** shadcn's dropdown and context menus on Base UI, in `@pkg/ui`; Base UI builds its context menu from its
  menu's parts, so `actionMenuItems.tsx` draws the items for both. The webview picks the items from the row's DTO
  (`sessionRow.utils.ts`, `projectGroup.utils.ts`); every item is a `ROW_ACTIONS` constant with its command, label and
  lucide icon, and the two moves name the row they share (`sharedRowLabel`). `rowActions.constant.ts` holds the two ways
  the buttons sit. Keyboard access beyond Tab and the menus' own keys comes with drag and drop.
- **Alternatives considered:** Move Up and Move Down as two menu items, which took two rows for one idea; the buttons in
  line after the row's text, which grew the row while hovered; buttons always shown, which crowd every row; Archive
  inside the … menu, a click more for the commonest action; the menus' items sent by the host, which would move the
  view's drawing into the extension.
