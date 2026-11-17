import {ImportSessionsRequestDtoSchema, ListImportableSessionsRequestDtoSchema} from "@dtos/sessionImport.dto.ts";
import {decodeVsCodeArgument} from "@pkg/vscode/src/vsCodeArgument.utils.ts";
import {importSessions, listImportableSessions} from "@services/sessionImport.service.ts";
import {Effect} from "effect";

export const importChosenSessions = Effect.fn("SessionImportController.importChosenSessions")(function* (
  chosenSessions: unknown
) {
  const request = yield* decodeVsCodeArgument(ImportSessionsRequestDtoSchema, chosenSessions);
  yield* importSessions(request);
});

export const listImportableSessionsForSessionsView = Effect.fn(
  "SessionImportController.listImportableSessionsForSessionsView"
)(function* (projectPath: string) {
  const request = yield* decodeVsCodeArgument(ListImportableSessionsRequestDtoSchema, {projectPath});

  return yield* listImportableSessions(request);
});
