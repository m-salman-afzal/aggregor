import {readTerminalEnvironmentVariable, readTerminalProcessId} from "@infraServices/vscode/terminal/terminal.utils.ts";
import {
  NoFolderShellTerminalOpenError,
  TerminalLaunchFailedError
} from "@interfaces/terminal.infraService.interface.ts";
import {FOLDER_SHELL_TERMINAL} from "@pkg/constants/src/terminal.constant.ts";
import {streamVsCodeEvent} from "@pkg/vscode/src/vscode.utils.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {Array, Effect, Predicate, Result, Schema, Stream, SubscriptionRef} from "effect";

import type {TerminalDependencies} from "@infraServices/vscode/terminal/terminal.infraService.type.ts";
import type {FolderShellTerminalRequest} from "@interfaces/terminal.infraService.interface.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {Terminal} from "vscode";

class FolderShellNotClosedByUserError extends Schema.TaggedError<
  FolderShellNotClosedByUserError,
  {readonly brand: unique symbol}
>()("FolderShellNotClosedByUserError", {}) {}

const readOpeningFolderPath = Effect.fn("TerminalInfraService.readOpeningFolderPath")(function* (terminal: Terminal) {
  return yield* readTerminalEnvironmentVariable(terminal, FOLDER_SHELL_TERMINAL.FOLDER_PATH_ENV);
});

const findFolderShellTerminal = Effect.fn("TerminalInfraService.findFolderShellTerminal")(function* (
  terminals: readonly Terminal[]
) {
  const openingFolderPaths = yield* Effect.forEach(terminals, (terminal) => readOpeningFolderPath(terminal));
  const folderShellTerminal = Array.findFirst(
    terminals,
    (terminal, terminalIndex) =>
      terminal.exitStatus === undefined && Predicate.isString(openingFolderPaths[terminalIndex])
  );

  return yield* Effect.fromResult(Result.fromOption(folderShellTerminal, () => NoFolderShellTerminalOpenError.make()));
});

// The folder the open terminal was launched with stands in until tmux says which folder's shell it shows.
export const readOpeningFolderShellPath = Effect.fn("TerminalInfraService.readOpeningFolderShellPath")(
  function* (terminals: readonly Terminal[]) {
    const folderShellTerminal = yield* findFolderShellTerminal(terminals);
    const openingFolderPath = yield* readOpeningFolderPath(folderShellTerminal);

    return Predicate.isString(openingFolderPath) ? ProjectPathValueObjectSchema.make(openingFolderPath) : undefined;
  },
  Effect.catchTag("NoFolderShellTerminalOpenError", () => Effect.undefined)
);

export const findFolderShellTerminalProcessId = Effect.fn("TerminalInfraService.findFolderShellTerminalProcessId")(
  function* (window: TerminalDependencies["window"]) {
    const folderShellTerminal = yield* findFolderShellTerminal(window.terminals);
    const terminalProcessId = yield* readTerminalProcessId(folderShellTerminal);

    return yield* Effect.fromResult(
      Result.fromNullishOr(terminalProcessId, () => NoFolderShellTerminalOpenError.make())
    );
  }
);

// VS Code labels a terminal with the folder it starts in, so this one starts in Aggregor's, not in one of those it shows.
const launchFolderShellTerminal = Effect.fn("TerminalInfraService.launchFolderShellTerminal")(function* (
  terminalDependencies: TerminalDependencies,
  folderShellTerminalRequest: FolderShellTerminalRequest
) {
  return yield* Effect.try({
    catch: (cause) => TerminalLaunchFailedError.make({cause}),
    try: () =>
      terminalDependencies.window.createTerminal({
        cwd: terminalDependencies.aggregorFolderPath,
        env: {[FOLDER_SHELL_TERMINAL.FOLDER_PATH_ENV]: folderShellTerminalRequest.folderPath},
        name: FOLDER_SHELL_TERMINAL.NAME,
        shellArgs: [...folderShellTerminalRequest.terminalCommand.commandArguments],
        shellPath: folderShellTerminalRequest.terminalCommand.command
      })
  });
});

const findOrLaunchFolderShellTerminal = Effect.fn("TerminalInfraService.findOrLaunchFolderShellTerminal")(function* (
  terminalDependencies: TerminalDependencies,
  folderShellTerminalRequest: FolderShellTerminalRequest,
  shownFolderShellPath: ProjectPathValueObject | undefined
) {
  return yield* Effect.matchEffect(findFolderShellTerminal(terminalDependencies.window.terminals), {
    onFailure: () =>
      Effect.map(
        launchFolderShellTerminal(terminalDependencies, folderShellTerminalRequest),
        (launchedTerminal) => [launchedTerminal, folderShellTerminalRequest.folderPath] as const
      ),
    onSuccess: (openTerminal) => Effect.succeed([openTerminal, shownFolderShellPath] as const)
  });
});

// Serialized on the shown path's permit, so a double-click shows the terminal the first click launched.
export const openFolderShellTerminal = Effect.fn("TerminalInfraService.openFolderShellTerminal")(function* (
  terminalDependencies: TerminalDependencies,
  folderShellTerminalRequest: FolderShellTerminalRequest
) {
  const folderShellTerminal = yield* SubscriptionRef.modifyEffect(
    terminalDependencies.shownFolderShellPath,
    (shownFolderShellPath) =>
      findOrLaunchFolderShellTerminal(terminalDependencies, folderShellTerminalRequest, shownFolderShellPath)
  );

  yield* Effect.sync(() => {
    folderShellTerminal.show();
  });
});

export const assignShownFolderShellPath = Effect.fn("TerminalInfraService.assignShownFolderShellPath")(function* (
  shownFolderShellPath: TerminalDependencies["shownFolderShellPath"],
  folderPath: ProjectPathValueObject
) {
  yield* SubscriptionRef.set(shownFolderShellPath, folderPath);
});

// VS Code says why a terminal closed: the user closing it ends the shell it showed, a reload or a quit only detaches.
const findFolderShellPathClosedByUser = Effect.fn("TerminalInfraService.findFolderShellPathClosedByUser")(function* (
  terminalDependencies: TerminalDependencies,
  closedTerminal: Terminal
) {
  const openingFolderPath = yield* readOpeningFolderPath(closedTerminal);
  const shownFolderShellPath = yield* SubscriptionRef.get(terminalDependencies.shownFolderShellPath);
  const isClosedByUser =
    closedTerminal.exitStatus !== undefined &&
    closedTerminal.exitStatus.reason === terminalDependencies.TerminalExitReason.User;
  if (!Predicate.isString(openingFolderPath) || !isClosedByUser || shownFolderShellPath === undefined)
    return yield* FolderShellNotClosedByUserError.make();

  return shownFolderShellPath;
});

export const watchFolderShellPathsClosedByUser = Effect.fn("TerminalInfraService.watchFolderShellPathsClosedByUser")(
  function* (terminalDependencies: TerminalDependencies) {
    const closedTerminals = yield* streamVsCodeEvent(terminalDependencies.window.onDidCloseTerminal);

    return Stream.filterMapEffect(closedTerminals, (closedTerminal) =>
      Effect.result(findFolderShellPathClosedByUser(terminalDependencies, closedTerminal))
    );
  }
);
