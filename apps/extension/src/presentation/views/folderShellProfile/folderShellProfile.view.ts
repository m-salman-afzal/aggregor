import {prepareProfileTerminalForFolderShellProfileView} from "@controllers/folderShell.controller.ts";
import {FOLDER_SHELL_TERMINAL} from "@pkg/constants/src/terminal.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {acquireScopedDisposable} from "@pkg/vscode/src/vscode.utils.ts";
import {Effect, Layer} from "effect";

import type {TerminalOptions} from "vscode";

// No options launch VS Code's own shell, so a failure still opens a terminal.
const prepareProfileTerminalOptions = Effect.fn("FolderShellProfileView.prepareProfileTerminalOptions")(
  function* () {
    const profileTerminal = yield* prepareProfileTerminalForFolderShellProfileView();
    const folderShellTerminal = profileTerminal.folderShellTerminal;
    const terminalOptions: TerminalOptions =
      folderShellTerminal === undefined
        ? {}
        : {
            cwd: folderShellTerminal.cwd,
            name: folderShellTerminal.name,
            shellArgs: [...folderShellTerminal.shellArgs],
            shellPath: folderShellTerminal.shellPath
          };

    return terminalOptions;
  },
  Effect.catch((profileError) =>
    Effect.as(Effect.logWarning("Could not open the Aggregor terminal; opening VS Code's shell", profileError), {})
  )
);

const provideTerminalProfile = Effect.fn("FolderShellProfileView.provideTerminalProfile")(function* () {
  const vsCodeApi = yield* VsCodeApi;
  const terminalOptions = yield* prepareProfileTerminalOptions();

  return new vsCodeApi.TerminalProfile(terminalOptions);
});

const makeFolderShellProfileView = Effect.fn("FolderShellProfileView.make")(function* () {
  const vsCodeApi = yield* VsCodeApi;
  const viewContext = yield* Effect.context<Effect.Services<ReturnType<typeof provideTerminalProfile>>>();
  const runPromise = Effect.runPromiseWith(viewContext);

  yield* acquireScopedDisposable(() =>
    vsCodeApi.window.registerTerminalProfileProvider(FOLDER_SHELL_TERMINAL.PROFILE_ID, {
      provideTerminalProfile: () => runPromise(provideTerminalProfile())
    })
  );
});

export const FolderShellProfileView = Layer.effectDiscard(makeFolderShellProfileView());
