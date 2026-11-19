import {getFolderShellName} from "@domainServices/folderShell.domainService.ts";
import {
  checkTmuxVersion,
  escapeTmuxFormat,
  findTmuxClient,
  killTmuxSession,
  listTmuxSessionNames,
  prepareOwnScopeArguments,
  prepareTerminalCommand,
  readTmuxSessionPanes,
  runCheckedTmuxCommand,
  runTmuxCommand,
  switchTmuxClient
} from "@infraServices/tmux/tmuxServer.utils.ts";
import {FolderShellNotShownError, FolderShellSwitchFailedError} from "@interfaces/tmux.infraService.interface.ts";
import {FOLDER_SHELL, TMUX, TMUX_CLIENT_WAIT} from "@pkg/constants/src/tmux.constant.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {Array, Effect, Schedule, String} from "effect";

import type {TmuxServer} from "@infraServices/tmux/tmux.infraService.type.ts";
import type {FolderShellRequest} from "@interfaces/tmux.infraService.interface.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";

const nameFolderShell = Effect.fn("TmuxInfraService.nameFolderShell")(function* (
  tmuxServer: TmuxServer,
  folderPath: ProjectPathValueObject
) {
  return yield* getFolderShellName(tmuxServer.path.basename(folderPath), folderPath);
});

// The shell sees no tmux, as in a plain terminal: the user's own tmux starts there, and none of its commands reach Aggregor's.
const prepareShellArguments = Effect.fn("TmuxInfraService.prepareShellArguments")(function* (tmuxServer: TmuxServer) {
  const ownScopeArguments = yield* prepareOwnScopeArguments(tmuxServer, undefined);

  return ["--", TMUX.SETUP_SHELL, "-c", FOLDER_SHELL.START_SCRIPT, TMUX.SETUP_SHELL, ...ownScopeArguments];
});

// One tmux command list: the shell's session, then the session's own options, which tmux applies to the pane it has.
const prepareFolderShellArguments = Effect.fn("TmuxInfraService.prepareFolderShellArguments")(function* (
  tmuxServer: TmuxServer,
  folderShellRequest: FolderShellRequest,
  newSessionFlags: readonly string[]
) {
  const folderShellName = yield* nameFolderShell(tmuxServer, folderShellRequest.folderPath);
  const sessionOptionArguments = [";", "set-option", "-t", `=${folderShellName}:`];

  return [
    ...["new-session", ...newSessionFlags, "-s", folderShellName],
    ...["-c", yield* escapeTmuxFormat(folderShellRequest.folderPath)],
    ...(yield* prepareShellArguments(tmuxServer)),
    ...[...sessionOptionArguments, "status", "on"],
    ...[...sessionOptionArguments, "history-limit", FOLDER_SHELL.HISTORY_LINES],
    ...[...sessionOptionArguments, FOLDER_SHELL.STATUS_LABEL_OPTION, folderShellRequest.statusLabel]
  ];
});

// -A attaches to the folder's shell when it runs, and otherwise starts it with the terminal's own variables.
export const prepareFolderShellTerminalCommand = Effect.fn("TmuxInfraService.prepareFolderShellTerminalCommand")(
  function* (tmuxServer: TmuxServer, folderShellRequest: FolderShellRequest) {
    yield* checkTmuxVersion(tmuxServer.childProcessSpawner);
    const folderShellArguments = yield* prepareFolderShellArguments(tmuxServer, folderShellRequest, ["-A"]);

    return yield* prepareTerminalCommand(tmuxServer, folderShellArguments);
  }
);

// shortcut: a value ending in ";" would end the tmux command there; escape it as "\;" once a variable holds one.
const readSessionEnvironmentFlags = Effect.fn("TmuxInfraService.readSessionEnvironmentFlags")(function* (
  tmuxServer: TmuxServer,
  sessionName: string
) {
  const environmentLines = yield* Effect.orElseSucceed(
    runTmuxCommand(tmuxServer, ["show-environment", "-t", `=${sessionName}:`]),
    (): readonly string[] => []
  );
  // tmux lists a variable the session removed as "-NAME".
  const setVariableLines = Array.filter(
    environmentLines,
    (environmentLine) => !String.startsWith("-")(environmentLine)
  );

  return Array.flatMap(setVariableLines, (setVariableLine) => ["-e", setVariableLine]);
});

// The extension's process lacks what VS Code gives a terminal, git's credential helper among it, so the shown shell's is copied.
const startFolderShell = Effect.fn("TmuxInfraService.startFolderShell")(function* (
  tmuxServer: TmuxServer,
  shownSessionName: string,
  folderShellRequest: FolderShellRequest
) {
  const environmentFlags = yield* readSessionEnvironmentFlags(tmuxServer, shownSessionName);
  const folderShellArguments = yield* prepareFolderShellArguments(tmuxServer, folderShellRequest, [
    "-d",
    ...environmentFlags
  ]);

  yield* runCheckedTmuxCommand(tmuxServer, folderShellArguments);
});

const findTerminalClientOnceAttached = Effect.fn("TmuxInfraService.findTerminalClientOnceAttached")(function* (
  tmuxServer: TmuxServer,
  terminalProcessId: number
) {
  return yield* Effect.retry(findTmuxClient(tmuxServer, terminalProcessId), {
    schedule: Schedule.spaced(TMUX_CLIENT_WAIT.POLL_INTERVAL_MS),
    times: TMUX_CLIENT_WAIT.TIMEOUT_MS / TMUX_CLIENT_WAIT.POLL_INTERVAL_MS
  });
});

const switchTerminalToFolderShell = Effect.fn("TmuxInfraService.switchTerminalToFolderShell")(function* (
  tmuxServer: TmuxServer,
  terminalProcessId: number,
  folderShellRequest: FolderShellRequest
) {
  const terminalClient = yield* findTerminalClientOnceAttached(tmuxServer, terminalProcessId);
  const folderShellName = yield* nameFolderShell(tmuxServer, folderShellRequest.folderPath);
  const runningSessionNames = yield* listTmuxSessionNames(tmuxServer);
  if (!runningSessionNames.includes(folderShellName))
    yield* startFolderShell(tmuxServer, terminalClient.sessionName, folderShellRequest);

  yield* switchTmuxClient(tmuxServer, terminalProcessId, folderShellName);
});

export const showFolderShellInTerminal = Effect.fn("TmuxInfraService.showFolderShellInTerminal")(function* (
  tmuxServer: TmuxServer,
  terminalProcessId: number,
  folderShellRequest: FolderShellRequest
) {
  yield* Effect.mapError(switchTerminalToFolderShell(tmuxServer, terminalProcessId, folderShellRequest), () =>
    FolderShellSwitchFailedError.make({folderPath: folderShellRequest.folderPath})
  );
});

export const readFolderShellPanes = Effect.fn("TmuxInfraService.readFolderShellPanes")(function* (
  tmuxServer: TmuxServer,
  folderPath: ProjectPathValueObject
) {
  const folderShellName = yield* nameFolderShell(tmuxServer, folderPath);

  return yield* readTmuxSessionPanes(tmuxServer, folderShellName);
});

// A shell's tmux session keeps the folder it was started in as its path.
export const readFolderShellPathShownInTerminal = Effect.fn("TmuxInfraService.readFolderShellPathShownInTerminal")(
  function* (tmuxServer: TmuxServer, terminalProcessId: number) {
    const terminalClient = yield* findTmuxClient(tmuxServer, terminalProcessId);

    return ProjectPathValueObjectSchema.make(terminalClient.sessionPath);
  },
  Effect.mapError(() => FolderShellNotShownError.make())
);

export const endFolderShell = Effect.fn("TmuxInfraService.endFolderShell")(function* (
  tmuxServer: TmuxServer,
  folderPath: ProjectPathValueObject
) {
  const folderShellName = yield* nameFolderShell(tmuxServer, folderPath);

  yield* killTmuxSession(tmuxServer, folderShellName);
});
