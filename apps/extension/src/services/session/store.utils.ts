import {SessionNotFound} from "@/errors/session.error.ts";
import {SessionStore} from "@/services/session/store.service.ts";
import {Effect, Result, SubscriptionRef} from "effect";

import type {Session} from "@/services/session/store.service.ts";
import type {WorkspaceFolder} from "vscode";

// Lowest free "<folder> #n", so closing #1 frees the name for the next session.
const nameFor = (folder: WorkspaceFolder, all: readonly Session[]) => {
  const taken = new Set(all.map((session) => session.name));
  let index = 1;
  while (taken.has(`${folder.name} #${index}`)) index += 1;

  return `${folder.name} #${index}`;
};

export const listSessions = Effect.fn("listSessions")(function* () {
  const {sessions} = yield* SessionStore;

  return yield* SubscriptionRef.get(sessions);
});

export const findSession = Effect.fn("findSession")(function* (id: string) {
  const all = yield* listSessions();

  return yield* Effect.fromResult(
    Result.fromNullishOr(
      all.find((session) => session.id === id),
      () => new SessionNotFound({id})
    )
  );
});

export const addSession = Effect.fn("addSession")(function* (folder: WorkspaceFolder) {
  const {sessions} = yield* SessionStore;
  const id = yield* Effect.sync(() => crypto.randomUUID());

  return yield* SubscriptionRef.modify(sessions, (all) => {
    const session: Session = {cwd: folder.uri.fsPath, id, name: nameFor(folder, all)};

    return [session, [...all, session]] as const;
  });
});

export const removeSession = Effect.fn("removeSession")(function* (id: string) {
  const {sessions} = yield* SessionStore;

  yield* SubscriptionRef.update(sessions, (all) => all.filter((session) => session.id !== id));
});
