import {DATABASE_ERRORS} from "@pkg/constants/src/database.constant.ts";
import {SESSION_ERRORS} from "@pkg/constants/src/session.constant.ts";
import {Effect, Match} from "effect";

import type {newSession, openSession, removeSession, renameSession} from "@services/session.service.ts";

// Every failure the session commands' use cases return.
type SessionCommandError = Effect.Error<
  ReturnType<typeof newSession | typeof openSession | typeof removeSession | typeof renameSession>
>;

// The message a failed session command shows the user.
export const presentSessionCommandError = Effect.fn("SessionPresenter.presentSessionCommandError")(function* (
  sessionCommandError: SessionCommandError
) {
  return Match.valueTags(sessionCommandError, {
    DatabaseReadError: () => DATABASE_ERRORS.READ_FAILED,
    DatabaseWriteError: () => DATABASE_ERRORS.WRITE_FAILED,
    NoProjectError: () => SESSION_ERRORS.PROJECT_REQUIRED,
    PtyBinaryNotFoundError: ({isWindows}) => SESSION_ERRORS.PTY_BINARY_NOT_FOUND(isWindows),
    SessionNotFoundError: () => SESSION_ERRORS.NOT_FOUND,
    TerminalLaunchFailedError: () => SESSION_ERRORS.LAUNCH_FAILED
  });
});
