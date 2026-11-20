import {TerminalUtils} from "@infraServices/vscode/terminal/terminal.utils.ts";
import {AggregorFolderUtils} from "@infraUtils/aggregorFolder.utils.ts";
import {ITerminalInfraServiceErrors} from "@interfaces/terminal.infraService.interface.ts";
import {FOLDER_SHELL_TERMINAL} from "@pkg/constants/src/terminal.constant.ts";
import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {VscodeUtils} from "@pkg/vscode/src/vscode.utils.ts";
import {Array, Context, Effect, Layer, Result, Stream, SubscriptionRef} from "effect";

import type {
  FolderShellTerminalOptions,
  FolderShellTerminalRequest,
  TerminalCommand
} from "@interfaces/terminal.infraService.interface.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {Terminal} from "vscode";

class FolderShellTerminalUtilsErrors extends TaggedErrors({
  FolderShellNotClosedByUserError: {}
}) {}

export class FolderShellTerminalUtils extends Context.Service<FolderShellTerminalUtils>()(
  "aggregor-app/infrastructure/services/vscode/terminal/folderShellTerminal.utils/FolderShellTerminalUtils",
  {
    make: Effect.fn("FolderShellTerminalUtils.make")(function* () {
      const vsCodeApi = yield* VsCodeApi;
      const vscodeUtils = yield* VscodeUtils;
      const terminalUtils = yield* TerminalUtils;
      const aggregorFolderUtils = yield* AggregorFolderUtils;
      const aggregorFolderPath = yield* aggregorFolderUtils.getAggregorFolderPath;
      // The folder whose shell the window's Aggregor terminal shows, as tmux last said; no terminal API reports it.
      const shownFolderShellPath = yield* SubscriptionRef.make<ProjectPathValueObject | undefined>(undefined);

      // A terminal VS Code restores after a reload keeps its name but not the env it was launched with.
      const findFolderShellTerminal = Effect.fn("FolderShellTerminalUtils.findFolderShellTerminal")(function* (
        terminals: readonly Terminal[]
      ) {
        const folderShellTerminal = Array.findFirst(
          terminals,
          (terminal) => terminal.exitStatus === undefined && terminal.name === FOLDER_SHELL_TERMINAL.NAME
        );

        return yield* Effect.fromResult(
          Result.fromOption(folderShellTerminal, () =>
            ITerminalInfraServiceErrors.NoFolderShellTerminalOpenError.make()
          )
        );
      });

      const findFolderShellTerminalProcessId = Effect.fn("FolderShellTerminalUtils.findFolderShellTerminalProcessId")(
        function* () {
          const folderShellTerminal = yield* findFolderShellTerminal(vsCodeApi.window.terminals);
          const terminalProcessId = yield* terminalUtils.readTerminalProcessId(folderShellTerminal);

          return yield* Effect.fromResult(
            Result.fromNullishOr(terminalProcessId, () =>
              ITerminalInfraServiceErrors.NoFolderShellTerminalOpenError.make()
            )
          );
        }
      );

      // VS Code labels a terminal with the folder it starts in, so this one starts in Aggregor's, not in one of those it shows.
      const prepareFolderShellTerminalOptions = Effect.fn("FolderShellTerminalUtils.prepareFolderShellTerminalOptions")(
        function* (terminalCommand: TerminalCommand) {
          const folderShellTerminalOptions: FolderShellTerminalOptions = {
            cwd: aggregorFolderPath,
            name: FOLDER_SHELL_TERMINAL.NAME,
            shellArgs: terminalCommand.commandArguments,
            shellPath: terminalCommand.command
          };

          return folderShellTerminalOptions;
        }
      );

      const launchFolderShellTerminal = Effect.fn("FolderShellTerminalUtils.launchFolderShellTerminal")(function* (
        folderShellTerminalRequest: FolderShellTerminalRequest
      ) {
        const folderShellTerminalOptions = yield* prepareFolderShellTerminalOptions(
          folderShellTerminalRequest.terminalCommand
        );

        return yield* Effect.try({
          catch: (cause) => ITerminalInfraServiceErrors.TerminalLaunchFailedError.make({cause}),
          try: () =>
            vsCodeApi.window.createTerminal({
              ...folderShellTerminalOptions,
              shellArgs: [...folderShellTerminalOptions.shellArgs]
            })
        });
      });

      const findOrLaunchFolderShellTerminal = Effect.fn("FolderShellTerminalUtils.findOrLaunchFolderShellTerminal")(
        function* (
          folderShellTerminalRequest: FolderShellTerminalRequest,
          currentShownFolderShellPath: ProjectPathValueObject | undefined
        ) {
          return yield* Effect.matchEffect(findFolderShellTerminal(vsCodeApi.window.terminals), {
            onFailure: () =>
              Effect.map(
                launchFolderShellTerminal(folderShellTerminalRequest),
                (launchedTerminal) => [launchedTerminal, folderShellTerminalRequest.folderPath] as const
              ),
            onSuccess: (openTerminal) => Effect.succeed([openTerminal, currentShownFolderShellPath] as const)
          });
        }
      );

      // Serialized on the shown path's permit, so a double-click shows the terminal the first click launched.
      const openFolderShellTerminal = Effect.fn("FolderShellTerminalUtils.openFolderShellTerminal")(function* (
        folderShellTerminalRequest: FolderShellTerminalRequest
      ) {
        const folderShellTerminal = yield* SubscriptionRef.modifyEffect(
          shownFolderShellPath,
          (currentShownFolderShellPath) =>
            findOrLaunchFolderShellTerminal(folderShellTerminalRequest, currentShownFolderShellPath)
        );

        yield* Effect.sync(() => {
          folderShellTerminal.show();
        });
      });

      const assignShownFolderShellPath = Effect.fn("FolderShellTerminalUtils.assignShownFolderShellPath")(function* (
        folderPath: ProjectPathValueObject
      ) {
        yield* SubscriptionRef.set(shownFolderShellPath, folderPath);
      });

      // VS Code says why a terminal closed: the user closing it ends the shell it showed, a reload or a quit only detaches.
      const findFolderShellPathClosedByUser = Effect.fn("FolderShellTerminalUtils.findFolderShellPathClosedByUser")(
        function* (closedTerminal: Terminal) {
          const currentShownFolderShellPath = yield* SubscriptionRef.get(shownFolderShellPath);
          const isClosedByUser =
            closedTerminal.exitStatus !== undefined &&
            closedTerminal.exitStatus.reason === vsCodeApi.TerminalExitReason.User;
          if (
            closedTerminal.name !== FOLDER_SHELL_TERMINAL.NAME ||
            !isClosedByUser ||
            currentShownFolderShellPath === undefined
          )
            return yield* FolderShellTerminalUtilsErrors.FolderShellNotClosedByUserError.make();

          return currentShownFolderShellPath;
        }
      );

      const watchFolderShellPathsClosedByUser = Effect.fn("FolderShellTerminalUtils.watchFolderShellPathsClosedByUser")(
        function* () {
          const closedTerminals = yield* vscodeUtils.streamVsCodeEvent(vsCodeApi.window.onDidCloseTerminal);

          return Stream.filterMapEffect(closedTerminals, (closedTerminal) =>
            Effect.result(findFolderShellPathClosedByUser(closedTerminal))
          );
        }
      );

      return {
        assignShownFolderShellPath,
        findFolderShellTerminalProcessId: findFolderShellTerminalProcessId(),
        openFolderShellTerminal,
        prepareFolderShellTerminalOptions,
        watchFolderShellPathsClosedByUser: watchFolderShellPathsClosedByUser()
      };
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(
    Layer.provide([TerminalUtils.layer, AggregorFolderUtils.layer])
  );
}
