import {SessionEntity} from "@entities/session/session.entity.ts";
import {decodeCommandArgument} from "@presentationUtils/commandArguments.utils.ts";
import {newSession, openSession, removeSession, renameSession} from "@services/session.service.ts";
import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {ListedProjectValueObject} from "@valueObjects/listedProject.valueObject.ts";
import {Effect} from "effect";

// The project row's button passes its Project.
export const newSessionInChosenProject = Effect.fn("SessionController.newSessionInChosenProject")(function* (
  projectRow: unknown
) {
  const chosenProject = yield* decodeCommandArgument(ListedProjectValueObject, projectRow);
  yield* newSession(chosenProject);
});

// VS Code passes title-bar buttons the focused row, which can be any row, so its arguments are dropped and the user
// picks the project.
export const newSessionAskingForProject = Effect.fn("SessionController.newSessionAskingForProject")(function* () {
  yield* newSession(undefined);
});

// The session row's own command passes its session id.
export const openChosenSession = Effect.fn("SessionController.openChosenSession")(function* (chosenSessionId: unknown) {
  const sessionId = yield* decodeCommandArgument(EntityIdValueObjectSchema, chosenSessionId);
  yield* openSession(sessionId);
});

// The session row's … menu passes the Session itself.
export const removeChosenSession = Effect.fn("SessionController.removeChosenSession")(function* (sessionRow: unknown) {
  const chosenSession = yield* decodeCommandArgument(SessionEntity, sessionRow);
  yield* removeSession(chosenSession);
});

// The session row's … menu passes the Session itself.
export const renameChosenSession = Effect.fn("SessionController.renameChosenSession")(function* (sessionRow: unknown) {
  const chosenSession = yield* decodeCommandArgument(SessionEntity, sessionRow);
  yield* renameSession(chosenSession);
});
