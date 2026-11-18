import {readTerminalProcessId} from "@infraServices/vscode/terminal/terminal.utils.ts";
import {
  NoFolderShellTerminalOpenError,
  TerminalLaunchFailedError
} from "@interfaces/terminal.infraService.interface.ts";
import {FOLDER_SHELL_TERMINAL} from "@pkg/constants/src/terminal.constant.ts";
import {streamVsCodeEvent} from "@pkg/vscode/src/vscode.utils.ts";
import {Array, Effect, Result, Schema, Stream, SubscriptionRef} from "effect";

import type {TerminalDependencies} from "@infraServices/vscode/terminal/terminal.infraService.type.ts";
import type {
  FolderShellTerminalOptions,
  FolderShellTerminalRequest,
  TerminalCommand
} from "@interfaces/terminal.infraService.interface.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {Terminal} from "vscode";

class FolderShellNotClosedByUserError extends Schema.TaggedError<
  FolderShellNotClosedByUserError,
  {readonly brand: unique symbol}
>()("FolderShellNotClosedByUserError", {}) {}

// A terminal VS Code restores after a reload keeps its name but not the env it was launched with.
const findFolderShellTerminal = Effect.fn("TerminalInfraService.findFolderShellTerminal")(function* (
  terminals: readonly Terminal[]
) {
  const folderShellTerminal = Array.findFirst(
    terminals,
    (terminal) => terminal.exitStatus === undefined && terminal.name === FOLDER_SHELL_TERMINAL.NAME
  );

  return yield* Effect.fromResult(Result.fromOption(folderShellTerminal, () => NoFolderShellTerminalOpenError.make()));
});

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
export const prepareFolderShellTerminalOptions = Effect.fn("TerminalInfraService.prepareFolderShellTerminalOptions")(
  function* (aggregorFolderPath: string, terminalCommand: TerminalCommand) {
    const folderShellTerminalOptions: FolderShellTerminalOptions = {
      cwd: aggregorFolderPath,
      name: FOLDER_SHELL_TERMINAL.NAME,
      shellArgs: terminalCommand.commandArguments,
      shellPath: terminalCommand.command
    };

    return folderShellTerminalOptions;
  }
);

const launchFolderShellTerminal = Effect.fn("TerminalInfraService.launchFolderShellTerminal")(function* (
  terminalDependencies: TerminalDependencies,
  folderShellTerminalRequest: FolderShellTerminalRequest
) {
  const folderShellTerminalOptions = yield* prepareFolderShellTerminalOptions(
    terminalDependencies.aggregorFolderPath,
    folderShellTerminalRequest.terminalCommand
  );

  return yield* Effect.try({
    catch: (cause) => TerminalLaunchFailedError.make({cause}),
    try: () =>
      terminalDependencies.window.createTerminal({
        ...folderShellTerminalOptions,
        shellArgs: [...folderShellTerminalOptions.shellArgs]
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
  const shownFolderShellPath = yield* SubscriptionRef.get(terminalDependencies.shownFolderShellPath);
  const isClosedByUser =
    closedTerminal.exitStatus !== undefined &&
    closedTerminal.exitStatus.reason === terminalDependencies.TerminalExitReason.User;
  if (closedTerminal.name !== FOLDER_SHELL_TERMINAL.NAME || !isClosedByUser || shownFolderShellPath === undefined)
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
