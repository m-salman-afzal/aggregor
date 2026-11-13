# Files

The folder Aggregor keeps its files in.

## Aggregor keeps its files in one folder, `~/.aggregor`

- **Problem:** the database and `aggregor-pty`'s log sat at the top of `~/.aggregor`, and the anchor folder deep in VS
  Code's global storage, which each profile, and Insiders, has its own of: every profile got its own anchor and saved
  workspace while all of them shared one project list.
- **Decision:** `~/.aggregor` (or `$AGGREGOR_HOME`, which replaced `$AGGREGOR_DATA_DIR`) holds `data/` (`aggregor.db`,
  its WAL files and `aggregor-pty.log`) and `anchor/` (`Aggregor/`, the anchor folder, and `Aggregor.code-workspace` and
  `sessionToReopen.json`; the `saveOffered` marker until then). `getAggregorFolderPath` reads it, and
  `getDatabaseFilePath` and `getAnchorFolderPath` build on it. `VsCodeApi` no longer carries `globalStorageUri`. Nothing
  moves the old files: the first switch after the change finds folder 0 is not the new anchor folder and anchors the
  window again. One place to find everything Aggregor stores, and every profile opens the same Aggregor workspace. A
  second window, in any profile, now shares the anchor folder's settings, as a second window in one profile already did.
- **Alternatives considered:** the anchor folder in global storage. The anchor folder straight under `~/.aggregor`,
  beside the database files. `~/.aggregor` itself as the anchor folder, which would make VS Code watch the database.

## The F5 build keeps its own Aggregor folder, `~/.aggregorDev`

- **Problem:** the build F5 runs and the installed Marketplace build shared `~/.aggregor`: one database, one tmux server
  and one anchor workspace. A dev schema change, which regenerates the migration from zero, broke the installed
  extension's database; F5's sessions showed in the installed extension's list; and the F5 window couldn't open the
  anchor workspace while the other window had it open, since VS Code shows that window instead.
- **Decision:**
  - "Run Extension" in `.vscode/launch.json` sets `AGGREGOR_HOME` to `${userHome}/.aggregorDev`; unset, as in the
    installed extension, it stays `~/.aggregor`. The verify skill keeps its own folder.
  - `AGGREGOR_DATABASE_FILE` names the database file, `data/aggregor.db` in the Aggregor folder by default, to try
    another database; `aggregor-pty` gets it through `--database` and writes its log beside it.
  - Both are read through Effect's `Config` by `readAbsolutePathVariable`; a value that isn't an absolute path fails
    activation with an error naming the variable.
  - `~/.aggregor` keeps what it holds, dev and installed rows alike; `~/.aggregorDev` starts empty. Nothing is copied or
    deleted. The database error messages no longer name `~/.aggregor/data`.

  One variable already moved everything, so F5 only had to set it, and swapping the database is one more.

- **Alternatives considered:**
  - The extension picks `~/.aggregorDev` itself when VS Code runs it in development mode, with no variable; a
    `.env.development` file that `launch.json` loads.
  - Naming the variable `AGGREGOR_DATA_DIR` again: the folder holds `anchor/` and `tmux.sock` besides its own `data/`,
    and beside a database variable it would read as moving only `data/`.
  - Variables for the tmux socket and the anchor folder, which follow the folder, so dev and installed builds already
    get their own; a separate socket variable could put two folders on one tmux server. `AGGREGOR_PTY_BINARY`, for a
    cargo debug build, which `build:pty` already copies in.
  - Expanding a leading `~`, which a shell does before VS Code sees the value and `launch.json` writes as `${userHome}`.
