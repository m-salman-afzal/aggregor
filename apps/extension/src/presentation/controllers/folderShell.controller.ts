import {OpenProjectTerminalRequestDtoSchema, OpenSessionFolderTerminalRequestDtoSchema} from "@dtos/folderShell.dto.ts";
import {decodeVsCodeArgument} from "@pkg/vscode/src/vsCodeArgument.utils.ts";
import {openProjectTerminal, openSessionFolderTerminal, prepareProfileTerminal} from "@services/folderShell.service.ts";
import {Effect} from "effect";

export const openChosenProjectTerminal = Effect.fn("FolderShellController.openChosenProjectTerminal")(function* (
  chosenProject: unknown
) {
  const request = yield* decodeVsCodeArgument(OpenProjectTerminalRequestDtoSchema, chosenProject);
  yield* openProjectTerminal(request);
});

export const openChosenSessionFolderTerminal = Effect.fn("FolderShellController.openChosenSessionFolderTerminal")(
  function* (chosenSession: unknown) {
    const request = yield* decodeVsCodeArgument(OpenSessionFolderTerminalRequestDtoSchema, chosenSession);
    yield* openSessionFolderTerminal(request);
  }
);

export const prepareProfileTerminalForFolderShellProfileView = Effect.fn(
  "FolderShellController.prepareProfileTerminalForFolderShellProfileView"
)(function* () {
  return yield* prepareProfileTerminal();
});
