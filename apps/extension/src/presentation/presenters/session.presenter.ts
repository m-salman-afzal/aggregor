import {SETTINGS_SECTION} from "@pkg/constants/src/app.constant.ts";
import {DATABASE_ERRORS} from "@pkg/constants/src/database.constant.ts";
import {HARNESS_ERRORS, HARNESS_SETTINGS} from "@pkg/constants/src/harness.constant.ts";
import {SESSION_ERRORS} from "@pkg/constants/src/session.constant.ts";
import {Effect, Match} from "effect";

import type {newSession, openSession, removeSession, renameSession} from "@services/session.service.ts";

// Every failure the session commands' use cases return.
type SessionCommandError = Effect.Error<
  ReturnType<typeof newSession | typeof openSession | typeof removeSession | typeof renameSession>
>;

const HARNESSES_SETTING = `${SETTINGS_SECTION}.${HARNESS_SETTINGS.HARNESSES}`;

// The message a failed session command shows the user, and the setting that fixes it, when one does.
export const presentSessionCommandError = Effect.fn("SessionPresenter.presentSessionCommandError")(function* (
  sessionCommandError: SessionCommandError
) {
  return Match.valueTags(sessionCommandError, {
    DatabaseReadError: () => ({message: DATABASE_ERRORS.READ_FAILED}),
    DatabaseWriteError: () => ({message: DATABASE_ERRORS.WRITE_FAILED}),
    HarnessNotFoundError: ({harnessId}) => ({
      message: HARNESS_ERRORS.NOT_FOUND(harnessId),
      settingToOpen: HARNESSES_SETTING
    }),
    InvalidSettingsError: ({reason}) => ({message: SESSION_ERRORS.INVALID_SETTINGS(reason)}),
    NoHarnessInstalledError: ({searchedCommands}) => ({
      message: HARNESS_ERRORS.NONE_INSTALLED(searchedCommands),
      settingToOpen: HARNESSES_SETTING
    }),
    NoProjectError: () => ({message: SESSION_ERRORS.PROJECT_REQUIRED}),
    PtyBinaryNotFoundError: ({isWindows}) => ({message: SESSION_ERRORS.PTY_BINARY_NOT_FOUND(isWindows)}),
    SessionNotFoundError: () => ({message: SESSION_ERRORS.NOT_FOUND}),
    TerminalLaunchFailedError: () => ({message: SESSION_ERRORS.LAUNCH_FAILED})
  });
});
