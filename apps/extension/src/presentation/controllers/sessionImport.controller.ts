import {ImportSessionsRequestDtoSchema, ListImportableSessionsRequestDtoSchema} from "@dtos/sessionImport.dto.ts";
import {SessionImportErrorMessage} from "@errorMessages/sessionImport.errorMessage.ts";
import {RegisterCommandMiddleware} from "@middlewares/registerCommand.middleware.ts";
import {SESSION_COMMANDS} from "@pkg/constants/src/session.constant.ts";
import {VscodeUtils} from "@pkg/vscode/src/vscode.utils.ts";
import {SessionImportService} from "@services/sessionImport.service.ts";
import {Context, Effect, Layer} from "effect";

export class SessionImportController extends Context.Service<SessionImportController>()(
  "aggregor-app/presentation/controllers/sessionImport.controller/SessionImportController",
  {
    make: Effect.fn("SessionImportController.make")(function* () {
      const registerCommandMiddleware = yield* RegisterCommandMiddleware;
      const sessionImportService = yield* SessionImportService;
      const sessionImportErrorMessage = yield* SessionImportErrorMessage;
      const vscodeUtils = yield* VscodeUtils;

      const importChosenSessions = Effect.fn("SessionImportController.importChosenSessions")(function* (
        chosenSessions: unknown
      ) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(ImportSessionsRequestDtoSchema, chosenSessions);
        yield* sessionImportService.importSessions(request);
      });

      const listImportableSessionsForSessionsView = Effect.fn(
        "SessionImportController.listImportableSessionsForSessionsView"
      )(function* (projectPath: string) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(ListImportableSessionsRequestDtoSchema, {projectPath});

        return yield* sessionImportService.listImportableSessions(request);
      });

      yield* registerCommandMiddleware.registerCommand(
        SESSION_COMMANDS.IMPORT,
        importChosenSessions,
        sessionImportErrorMessage.getSessionImportCommandErrorMessage
      );

      return {importChosenSessions, listImportableSessionsForSessionsView};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(
    Layer.provide([SessionImportErrorMessage.layer, RegisterCommandMiddleware.layer])
  );
}
