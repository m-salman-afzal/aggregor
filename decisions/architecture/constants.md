# Constants

Where constants live and what they may hold.

## Constants live in `@pkg/constants`, split by feature

- **Problem:** every constant went into `extension.constant.ts` or `message.constant.ts`. Later, file names, timings,
  environment variables, external commands and VS Code's ids sat as loose constants or bare literals in the files that
  used them, so the database's folder name lived in a helper and the tmux socket's in another.
- **Decision:** one `@pkg/constants/src/<feature>.constant.ts` per feature (app, commitMessage, database, git, agent,
  process, project, session, sessionAlert, sessionsView, terminal, tmux, vscode, workspace), each with
  `<FEATURE>_COMMANDS`, `_LABELS` (titles, buttons, placeholders), `_NOTICES` (confirmations and offers) and `_ERRORS`
  (failure texts) as it needs them, and every other constant outside the domain: file and folder names, environment
  variables, external commands, VS Code's and other extensions' ids, timings, modes and patterns. Constants that
  describe one thing share an object with a label per value: `AGGREGOR_FOLDER`, `DATABASE_FILE`, `TMUX`,
  `AGENT_START_WAIT`, `SESSIONS_VIEW`, `ROW_ICONS`, `SELECT_ROW_RETRY`, `DESKTOP_NOTIFICATION`, `DESKTOP_NOTIFIERS`,
  `GIT_EXTENSION`, `AGENT_ICON`, `COMMAND_SEARCH`, `AGGREGOR_WORKSPACE`, `ANCHOR_FOLDER_SETTINGS`, `SESSION_TO_REOPEN`.
  `vscode.constant.ts` holds VS Code's own command ids, which several features run. The domain's patterns stay beside
  its rules, since the domain imports only `effect` and itself; a model's `BASE_COLUMNS` and the session repository's
  join are code. Log messages and a command line's arguments stay in their code. `aggregor/constant-placement` flags a
  module-level const named in UPPER_CASE, or set to a bare literal, in the extension outside the domain and models, and
  in `@pkg/vscode`. `drizzle.config.ts` reads `MIGRATIONS_FOLDER`. A feature's ids, words and settings sit together, a
  constant's file says who uses it, and one change to a name or a timing touches one line.
- **Alternatives considered:** by kind (ids, UI, runtime, messages). Only ids and texts in `@pkg/constants`, the rest
  beside its code. Letting the domain import `@pkg/constants` for its title patterns, which would tie the domain to a
  package presentation and infrastructure share.

## Constants hold no logic

- **Problem:** some constants chose their text: `SESSION_NOTICES`' stop and archive lines on agent and turn counts, the
  tmux and aggregor-pty errors on what was found, the row tooltip on whether the agent left a message. A choice in a
  text file is out of sight of the code that makes it, and none of its cases reads as a whole sentence.
- **Decision:** a constant is a literal, or a text with holes: an arrow whose whole body is one template literal. A text
  that depends on a case is one constant per case, and a util beside the code that uses it picks one: the presenter for
  an error's message, `application/utils/sessionQuestion.utils.ts` (`@applicationUtils`, a new alias) for the stop and
  archive questions, `sessions.utils.ts` for the tooltip. `CONSTANT_BANS` in `syntaxBans.ts` bans conditions, calls,
  spreads and operators in `@pkg/constants`, and any other function there. Archive's Stop Agent line is now the one Stop
  Agent uses, which it repeated word for word. Each text reads whole where it is kept, and each choice sits with the
  code that makes it.
- **Alternatives considered:** no functions in constants at all, with `{placeholder}` texts filled by a formatter, which
  TypeScript can't check.
