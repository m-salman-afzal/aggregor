import {DATABASE_ERRORS} from "@pkg/constants/src/database.constant.ts";
import {TERMINAL_ERRORS} from "@pkg/constants/src/terminal.constant.ts";
import {Effect, Match} from "effect";

import type {
  addProject,
  moveProjectDown,
  moveProjectUp,
  newProjectTerminal,
  removeProject
} from "@services/project.service.ts";

// Every failure the project commands' use cases return.
type ProjectCommandError = Effect.Error<
  ReturnType<
    typeof addProject | typeof moveProjectDown | typeof moveProjectUp | typeof newProjectTerminal | typeof removeProject
  >
>;

// The message a failed project command shows the user.
export const presentProjectCommandError = Effect.fn("ProjectPresenter.presentProjectCommandError")(function* (
  projectCommandError: ProjectCommandError
) {
  return Match.valueTags(projectCommandError, {
    DatabaseReadError: () => ({message: DATABASE_ERRORS.READ_FAILED}),
    DatabaseWriteError: () => ({message: DATABASE_ERRORS.WRITE_FAILED}),
    NoProjectError: () => ({message: TERMINAL_ERRORS.PROJECT_REQUIRED}),
    TerminalLaunchFailedError: () => ({message: TERMINAL_ERRORS.LAUNCH_FAILED})
  });
});
