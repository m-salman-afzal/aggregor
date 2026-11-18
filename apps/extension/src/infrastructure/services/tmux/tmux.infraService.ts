import {
  endFolderShell,
  prepareFolderShellTerminalCommand,
  readFolderShellPathShownInTerminal,
  showFolderShellInTerminal
} from "@infraServices/tmux/folderShell.utils.ts";
import {
  findPtyBinaryPath,
  prepareSessionTabCommand,
  readRunningSessionIds,
  readShownSessionIdsByTabProcessId,
  refreshRunningSessionIds,
  showSessionInTab,
  stopSessionAgent,
  waitForSessionAgentStart,
  watchStartedOrStoppedSessionIds
} from "@infraServices/tmux/sessionAgent.utils.ts";
import {
  checkTmuxVersion,
  listTmuxSessionNames,
  probeOwnScope,
  runTmuxCommand
} from "@infraServices/tmux/tmuxServer.utils.ts";
import {getDatabaseFilePath} from "@infraUtils/database.utils.ts";
import {getTmuxSocketPath} from "@infraUtils/tmuxSocket.utils.ts";
import {ITmuxInfraService} from "@interfaces/tmux.infraService.interface.ts";
import {PTY_BINARY} from "@pkg/constants/src/terminal.constant.ts";
import {TMUX} from "@pkg/constants/src/tmux.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {streamVsCodeEvent} from "@pkg/vscode/src/vscode.utils.ts";
import {Effect, Layer, Stream, SubscriptionRef} from "effect";
import {Path} from "effect/Path";
import {ChildProcessSpawner} from "effect/process/ChildProcessSpawner";

import type {TmuxDependencies, TmuxServer} from "@infraServices/tmux/tmux.infraService.type.ts";
import type {FolderShellRequest, SessionTabCommandRequest} from "@interfaces/tmux.infraService.interface.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";

// An agent can end, or tmux be killed, while the window is away; a tab whose tmux session ended closes with it.
const watchTmuxChangeHints = Effect.fn("TmuxInfraService.watchTmuxChangeHints")(function* (
  tmuxDependencies: TmuxDependencies
) {
  const windowStateChanges = yield* streamVsCodeEvent(tmuxDependencies.window.onDidChangeWindowState);
  const closedTerminals = yield* streamVsCodeEvent(tmuxDependencies.window.onDidCloseTerminal);
  const tmuxChangeHints = Stream.merge(
    Stream.filter(windowStateChanges, (windowState) => windowState.focused),
    closedTerminals
  );

  yield* Stream.runForEach(tmuxChangeHints, () =>
    Effect.withTracerEnabled(refreshRunningSessionIds(tmuxDependencies), false)
  );
});

const makeTmuxServer = Effect.fn("TmuxInfraService.makeTmuxServer")(function* () {
  const vsCodeApi = yield* VsCodeApi;
  const childProcessSpawner = yield* ChildProcessSpawner;
  const tmuxServer: TmuxServer = {
    canRunInOwnScope: yield* probeOwnScope(childProcessSpawner),
    childProcessSpawner,
    path: yield* Path,
    tmuxConfigPath: vsCodeApi.Uri.joinPath(vsCodeApi.extensionUri, TMUX.CONFIG_FILE).fsPath,
    tmuxSocketPath: yield* getTmuxSocketPath()
  };

  return tmuxServer;
});

const makeTmuxDependencies = Effect.fn("TmuxInfraService.makeTmuxDependencies")(function* () {
  const vsCodeApi = yield* VsCodeApi;
  const tmuxServer = yield* makeTmuxServer();
  const ptyBinaryPath = vsCodeApi.Uri.joinPath(vsCodeApi.extensionUri, PTY_BINARY).fsPath;
  const initialSessionIds = yield* readRunningSessionIds(tmuxServer);
  const tmuxDependencies: TmuxDependencies = {
    ...tmuxServer,
    databaseFilePath: yield* getDatabaseFilePath(),
    ptyBinaryPath: yield* Effect.result(findPtyBinaryPath(ptyBinaryPath)),
    runningSessionIds: yield* SubscriptionRef.make(initialSessionIds),
    window: vsCodeApi.window
  };

  return tmuxDependencies;
});

const makeFolderShellMembers = Effect.fn("TmuxInfraService.makeFolderShellMembers")(function* (tmuxServer: TmuxServer) {
  return {
    endFolderShell: (folderPath: ProjectPathValueObject) => endFolderShell(tmuxServer, folderPath),
    prepareFolderShellTerminalCommand: (folderShellRequest: FolderShellRequest) =>
      prepareFolderShellTerminalCommand(tmuxServer, folderShellRequest),
    readFolderShellPathShownInTerminal: (terminalProcessId: number) =>
      readFolderShellPathShownInTerminal(tmuxServer, terminalProcessId),
    showFolderShellInTerminal: (terminalProcessId: number, folderShellRequest: FolderShellRequest) =>
      showFolderShellInTerminal(tmuxServer, terminalProcessId, folderShellRequest)
  };
});

const makeSessionAgentMembers = Effect.fn("TmuxInfraService.makeSessionAgentMembers")(function* (
  tmuxDependencies: TmuxDependencies
) {
  return {
    prepareSessionTabCommand: (sessionTabCommandRequest: SessionTabCommandRequest) =>
      prepareSessionTabCommand(tmuxDependencies, sessionTabCommandRequest),
    readShownSessionIdsByTabProcessId: readShownSessionIdsByTabProcessId(tmuxDependencies),
    refreshRunningSessionIds: refreshRunningSessionIds(tmuxDependencies),
    runningSessionIds: tmuxDependencies.runningSessionIds,
    showSessionInTab: (tabProcessId: number, sessionId: EntityIdValueObject) =>
      showSessionInTab(tmuxDependencies, tabProcessId, sessionId),
    startedOrStoppedSessionIds: yield* watchStartedOrStoppedSessionIds(tmuxDependencies.runningSessionIds),
    stopSessionAgent: (sessionId: EntityIdValueObject) => stopSessionAgent(tmuxDependencies, sessionId),
    waitForSessionAgentStart: (sessionId: EntityIdValueObject) => waitForSessionAgentStart(tmuxDependencies, sessionId)
  };
});

// A server already running keeps the config it started with, so this window's tmux.conf is read into it again.
const makeTmuxInfraService = Effect.fn("TmuxInfraService.make")(function* () {
  const tmuxDependencies = yield* makeTmuxDependencies();
  const runningSessionNames = yield* listTmuxSessionNames(tmuxDependencies);
  if (runningSessionNames.length > 0)
    yield* Effect.ignore(runTmuxCommand(tmuxDependencies, ["source-file", tmuxDependencies.tmuxConfigPath]), {
      log: "Warn",
      message: "Could not read this window's tmux.conf into the running tmux server"
    });
  yield* Effect.forkScoped(watchTmuxChangeHints(tmuxDependencies));

  return {
    checkTmuxVersion: checkTmuxVersion(tmuxDependencies.childProcessSpawner),
    ...(yield* makeFolderShellMembers(tmuxDependencies)),
    ...(yield* makeSessionAgentMembers(tmuxDependencies))
  };
});

export const TmuxInfraService = Layer.effect(ITmuxInfraService, makeTmuxInfraService());
