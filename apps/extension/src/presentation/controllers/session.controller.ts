import * as SessionService from "@/application/session/session.service.ts";
import {Repo} from "@/domain/entities/repo/repo.entity.ts";
import {Session} from "@/domain/entities/session/session.entity.ts";
import {SessionIdSchema} from "@/domain/value-objects/session-id.value-object.ts";
import {decodeCommandArgument} from "@/presentation/utils/command-arguments.utils.ts";
import {Effect} from "effect";

// The repo row's button passes its Repo.
export const newSessionInClickedRepo = Effect.fn("SessionController.newSessionInClickedRepo")(function* (
  clickedRow: unknown
) {
  yield* SessionService.newSession(yield* decodeCommandArgument(Repo, clickedRow));
});

// VS Code passes title-bar buttons the focused row, which can be any row, so its arguments are dropped and the user
// picks the repo.
export const newSessionAskingForRepo = Effect.fn("SessionController.newSessionAskingForRepo")(function* () {
  yield* SessionService.newSession(undefined);
});

// The session row's own command passes its session id.
export const openSession = Effect.fn("SessionController.openSession")(function* (clickedSessionId: unknown) {
  yield* SessionService.openSession(yield* decodeCommandArgument(SessionIdSchema, clickedSessionId));
});

// The session row's … menu passes the Session itself.
export const removeSession = Effect.fn("SessionController.removeSession")(function* (clickedRow: unknown) {
  yield* SessionService.removeSession(yield* decodeCommandArgument(Session, clickedRow));
});
