import {FolderShellController} from "@controllers/folderShell.controller.ts";
import {FOLDER_SHELL_TERMINAL} from "@pkg/constants/src/terminal.constant.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {VscodeUtils} from "@pkg/vscode/src/vscode.utils.ts";
import {Context, Effect, Layer} from "effect";

import type {TerminalOptions} from "vscode";

export class FolderShellProfileView extends Context.Service<FolderShellProfileView>()(
  "aggregor-app/presentation/views/folderShellProfile/folderShellProfile.view/FolderShellProfileView",
  {
    make: Effect.fn("make")(function* () {
      const folderShellController = yield* FolderShellController;
      const vsCodeApi = yield* VsCodeApi;
      const vscodeUtils = yield* VscodeUtils;

      const prepareProfileTerminalOptions = Effect.fn("prepareProfileTerminalOptions")(
        function* () {
          const profileTerminal = yield* folderShellController.prepareProfileTerminalForFolderShellProfileView;
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
          Effect.as(
            Effect.logWarning("Could not open the Aggregor terminal; opening VS Code's shell", profileError),
            {}
          )
        )
      );

      const provideTerminalProfile = Effect.fn("provideTerminalProfile")(function* () {
        const terminalOptions = yield* prepareProfileTerminalOptions();

        return new vsCodeApi.TerminalProfile(terminalOptions);
      });

      const viewContext = yield* Effect.context();
      const runPromise = Effect.runPromiseWith(viewContext);

      yield* vscodeUtils.acquireScopedDisposable(() =>
        vsCodeApi.window.registerTerminalProfileProvider(FOLDER_SHELL_TERMINAL.PROFILE_ID, {
          provideTerminalProfile: () => runPromise(provideTerminalProfile())
        })
      );

      return {};
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("FolderShellProfileView", this.make())).pipe(
    Layer.provide(FolderShellController.layer)
  );
}
