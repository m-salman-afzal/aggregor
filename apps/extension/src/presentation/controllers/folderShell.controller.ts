import {Context, Effect, Layer} from "effect";

import {
  OpenProjectTerminalRequestDtoSchema,
  OpenSessionFolderTerminalRequestDtoSchema
} from "@/dtos/folderShell.dto.ts";
import {FolderShellErrorMessage} from "@/errorMessages/folderShell.errorMessage.ts";
import {RegisterCommandMiddleware} from "@/middlewares/registerCommand.middleware.ts";
import {FolderShellService} from "@/services/folderShell.service.ts";
import {TERMINAL_COMMANDS} from "@pkg/constants/src/terminal.constant.ts";
import {VscodeUtils} from "@pkg/vscode/src/vscode.utils.ts";

export class FolderShellController extends Context.Service<FolderShellController>()(
  "aggregor-app/presentation/controllers/folderShell.controller/FolderShellController",
  {
    make: Effect.fn("FolderShellController.make")(function* () {
      const registerCommandMiddleware = yield* RegisterCommandMiddleware;
      const folderShellService = yield* FolderShellService;
      const folderShellErrorMessage = yield* FolderShellErrorMessage;
      const vscodeUtils = yield* VscodeUtils;

      const openChosenProjectTerminal = Effect.fn("FolderShellController.openChosenProjectTerminal")(function* (
        chosenProject: unknown
      ) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(OpenProjectTerminalRequestDtoSchema, chosenProject);
        yield* folderShellService.openProjectTerminal(request);
      });

      const openChosenSessionFolderTerminal = Effect.fn("FolderShellController.openChosenSessionFolderTerminal")(
        function* (chosenSession: unknown) {
          const request = yield* vscodeUtils.decodeVsCodeArgument(
            OpenSessionFolderTerminalRequestDtoSchema,
            chosenSession
          );
          yield* folderShellService.openSessionFolderTerminal(request);
        }
      );

      const prepareProfileTerminalForFolderShellProfileView = Effect.fn(
        "FolderShellController.prepareProfileTerminalForFolderShellProfileView"
      )(function* () {
        return yield* folderShellService.prepareProfileTerminal;
      });

      yield* registerCommandMiddleware.registerCommand(
        TERMINAL_COMMANDS.OPEN_PROJECT_TERMINAL,
        openChosenProjectTerminal,
        folderShellErrorMessage.getFolderShellCommandErrorMessage
      );
      yield* registerCommandMiddleware.registerCommand(
        TERMINAL_COMMANDS.OPEN_SESSION_FOLDER_TERMINAL,
        openChosenSessionFolderTerminal,
        folderShellErrorMessage.getFolderShellCommandErrorMessage
      );

      return {
        openChosenProjectTerminal,
        openChosenSessionFolderTerminal,
        prepareProfileTerminalForFolderShellProfileView: prepareProfileTerminalForFolderShellProfileView()
      };
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(
    Layer.provide([FolderShellErrorMessage.layer, RegisterCommandMiddleware.layer])
  );
}
