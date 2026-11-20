import {AGENT_ERRORS, AGENTS_SETTING_ID} from "@pkg/constants/src/agent.constant.ts";
import {DATABASE_ERRORS} from "@pkg/constants/src/database.constant.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {Context, Effect, Layer, Match} from "effect";

import type {SessionImportService} from "@services/sessionImport.service.ts";

type SessionImportCommandError = Effect.Error<ReturnType<SessionImportService["Service"]["importSessions"]>>;

export class SessionImportErrorMessage extends Context.Service<SessionImportErrorMessage>()(
  "aggregor-app/presentation/errorMessages/sessionImport.errorMessage/SessionImportErrorMessage",
  {
    make: Effect.fn("make")(function* () {
      const getSessionImportCommandErrorMessage = Effect.fn("getSessionImportCommandErrorMessage")(function* (
        sessionImportCommandError: SessionImportCommandError
      ) {
        return Match.valueTags(sessionImportCommandError, {
          AgentNotFoundError: (error) => ({
            message: AGENT_ERRORS.NOT_FOUND(error.agentId),
            settingToOpen: AGENTS_SETTING_ID
          }),
          DatabaseReadError: () => ({message: DATABASE_ERRORS.READ_FAILED}),
          DatabaseWriteError: () => ({message: DATABASE_ERRORS.WRITE_FAILED})
        });
      });

      return {getSessionImportCommandErrorMessage};
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("SessionImportErrorMessage", this.make()));
}
