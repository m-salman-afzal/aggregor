import {ProjectEntity} from "@entities/project/project.entity.ts";
import {SessionEntity} from "@entities/session/session.entity.ts";
import {decodeCommandArgument} from "@presentationUtils/commandArguments.utils.ts";
import * as SessionService from "@services/session.service.ts";
import {SessionIdValueObjectSchema} from "@valueObjects/sessionId.valueObject.ts";
import {Effect} from "effect";

// The project row's button passes its Project.
export const newSessionInClickedProject = Effect.fn("SessionController.newSessionInClickedProject")(function* (
  clickedRow: unknown
) {
  yield* SessionService.newSession(yield* decodeCommandArgument(ProjectEntity, clickedRow));
});

// VS Code passes title-bar buttons the focused row, which can be any row, so its arguments are dropped and the user
// picks the project.
export const newSessionAskingForProject = Effect.fn("SessionController.newSessionAskingForProject")(function* () {
  yield* SessionService.newSession(undefined);
});

// The session row's own command passes its session id.
export const openSession = Effect.fn("SessionController.openSession")(function* (clickedSessionId: unknown) {
  yield* SessionService.openSession(yield* decodeCommandArgument(SessionIdValueObjectSchema, clickedSessionId));
});

// The session row's … menu passes the Session itself.
export const removeSession = Effect.fn("SessionController.removeSession")(function* (clickedRow: unknown) {
  yield* SessionService.removeSession(yield* decodeCommandArgument(SessionEntity, clickedRow));
});
