import {AGENT_ERRORS, AGENTS_SETTING_ID} from "@pkg/constants/src/agent.constant.ts";
import {DATABASE_ERRORS} from "@pkg/constants/src/database.constant.ts";
import {Effect, Match} from "effect";

import type {importSessions} from "@services/sessionImport.service.ts";

type SessionImportCommandError = Effect.Error<ReturnType<typeof importSessions>>;

export const presentSessionImportCommandError = Effect.fn("SessionImportPresenter.presentSessionImportCommandError")(
  function* (sessionImportCommandError: SessionImportCommandError) {
    return Match.valueTags(sessionImportCommandError, {
      AgentNotFoundError: (error) => ({
        message: AGENT_ERRORS.NOT_FOUND(error.agentId),
        settingToOpen: AGENTS_SETTING_ID
      }),
      DatabaseReadError: () => ({message: DATABASE_ERRORS.READ_FAILED}),
      DatabaseWriteError: () => ({message: DATABASE_ERRORS.WRITE_FAILED})
    });
  }
);
