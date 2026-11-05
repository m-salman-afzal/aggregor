import {ProjectEntity} from "@entities/project/project.entity.ts";
import {SessionEntity} from "@entities/session/session.entity.ts";
import {decodeCommandArgument} from "@presentationUtils/commandArguments.utils.ts";
import {newSession, openSession, removeSession} from "@services/session.service.ts";
import {SessionIdValueObjectSchema} from "@valueObjects/sessionId.valueObject.ts";
import {Effect} from "effect";

// The project row's button passes its Project.
export const newSessionInClickedProject = Effect.fn("SessionController.newSessionInClickedProject")(function* (
  clickedRow: unknown
) {
  const clickedProject = yield* decodeCommandArgument(ProjectEntity, clickedRow);
  yield* newSession(clickedProject);
});

// VS Code passes title-bar buttons the focused row, which can be any row, so its arguments are dropped and the user
// picks the project.
export const newSessionAskingForProject = Effect.fn("SessionController.newSessionAskingForProject")(function* () {
  yield* newSession(undefined);
});

// The session row's own command passes its session id.
export const openClickedSession = Effect.fn("SessionController.openClickedSession")(function* (
  clickedSessionId: unknown
) {
  const sessionId = yield* decodeCommandArgument(SessionIdValueObjectSchema, clickedSessionId);
  yield* openSession(sessionId);
});

// The session row's … menu passes the Session itself.
export const removeClickedSession = Effect.fn("SessionController.removeClickedSession")(function* (
  clickedRow: unknown
) {
  const clickedSession = yield* decodeCommandArgument(SessionEntity, clickedRow);
  yield* removeSession(clickedSession);
});
