import {SessionNotFound} from "@/errors/session.error.ts";
import {SessionStore} from "@/services/session/store.service.ts";
import {Effect, Result, SubscriptionRef} from "effect";

import type {Session} from "@/services/session/store.service.ts";
import type {WorkspaceFolder} from "vscode";

// Lowest free "<folder> #n", so removing #1 frees the name for the next session.
const nameFor = (folder: WorkspaceFolder, all: readonly Session[]) => {
  const taken = new Set(all.map((session) => session.name));
  let index = 1;
  while (taken.has(`${folder.name} #${index}`)) index += 1;

  return `${folder.name} #${index}`;
};

// Read-modify-write against globalState under the ref's permit, so a change never drops what another window saved.
const modifyStored = Effect.fn("modifyStored")(function* <B>(
  change: (stored: readonly Session[]) => readonly [B, readonly Session[]]
) {
  const {load, save, sessions} = yield* SessionStore;

  const writeChange = Effect.fn("writeChange")(function* () {
    const [result, next] = change(yield* load());
    yield* save(next);

    return [result, next] as const;
  });

  return yield* SubscriptionRef.modifyEffect(sessions, () => writeChange());
});

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
  const id = yield* Effect.sync(() => crypto.randomUUID());

  return yield* modifyStored((stored) => {
    const session: Session = {cwd: folder.uri.fsPath, id, name: nameFor(folder, stored)};

    return [session, [...stored, session]] as const;
  });
});

export const deleteSession = Effect.fn("deleteSession")(function* (id: string) {
  yield* modifyStored((stored) => [id, stored.filter((session) => session.id !== id)] as const);
});
