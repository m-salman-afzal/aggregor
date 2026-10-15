import {SessionsCorrupt, SessionsSaveFailed} from "@/errors/session.error.ts";
import {ErrorService} from "@/services/error.service.ts";
import {VscService} from "@/services/vsc.service.ts";
import {fromEvent} from "@/services/vsc.utils.ts";
import {STORAGE_KEYS} from "@pkg/constants/src/extension.constant.ts";
import {SESSION_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {Context, Effect, Layer, Schema, Stream, SubscriptionRef} from "effect";

import type {WindowState} from "vscode";

export const SessionSchema = Schema.Struct({
  cwd: Schema.String,
  id: Schema.String,
  name: Schema.String
});

export type Session = typeof SessionSchema.Type;

// Any change to this shape bumps `version`, so windows still running older code fail to decode it instead of
// writing back a copy with the new fields stripped.
const StoredSessions = Schema.Struct({
  sessions: Schema.Array(SessionSchema),
  version: Schema.Literal(1)
});

const EMPTY: typeof StoredSessions.Encoded = {sessions: [], version: 1};

// globalState is the source of truth, shared by every window; `sessions` is this window's copy for the view.
export class SessionStore extends Context.Service<
  SessionStore,
  {
    readonly load: () => Effect.Effect<readonly Session[], SessionsCorrupt>;
    readonly save: (sessions: readonly Session[]) => Effect.Effect<void, SessionsSaveFailed>;
    readonly sessions: SubscriptionRef.SubscriptionRef<readonly Session[]>;
  }
>()("aggregor/services/session/store.service/SessionStore") {
  public static readonly layer = Layer.effect(
    SessionStore,
    Effect.gen(function* () {
      const {globalState, window} = yield* VscService;

      const load = Effect.fn("loadSessions")(function* () {
        const stored = yield* Effect.sync(() => globalState.get<unknown>(STORAGE_KEYS.SESSIONS, EMPTY));
        const decoded = yield* Schema.decodeUnknownEffect(StoredSessions)(stored).pipe(
          Effect.catchTag("SchemaError", (cause) => Effect.fail(new SessionsCorrupt({cause})))
        );

        return decoded.sessions;
      });

      const save = Effect.fn("saveSessions")(function* (sessions: readonly Session[]) {
        const stored: typeof StoredSessions.Encoded = {sessions, version: 1};

        yield* Effect.tryPromise({
          catch: (cause) => new SessionsSaveFailed({cause}),
          try: async () => globalState.update(STORAGE_KEYS.SESSIONS, stored)
        });
      });

      const showUnreadable = Effect.fn("showUnreadable")(function* () {
        yield* Effect.forkDetach(ErrorService.use((service) => service.show(SESSION_MESSAGES.UNREADABLE)));
        const empty: readonly Session[] = [];

        return empty;
      });

      // Unreadable data starts the list empty; every write re-reads first, so it is never overwritten.
      const initial = yield* load().pipe(Effect.catchTag("SessionsCorrupt", () => showUnreadable()));
      const sessions = yield* SubscriptionRef.make<readonly Session[]>(initial);

      // Other windows write to the same globalState; pick up their changes when this window comes back into focus.
      const reloadOnFocus = Effect.fn("reloadOnFocus")(function* (state: WindowState) {
        if (!state.focused) return;

        yield* SubscriptionRef.updateEffect(sessions, () => load());
      });
      yield* Effect.forkScoped(
        Stream.runForEach(fromEvent(window.onDidChangeWindowState), (state) =>
          reloadOnFocus(state).pipe(Effect.catchTag("SessionsCorrupt", () => Effect.void))
        )
      );

      return SessionStore.of({load, save, sessions});
    })
  );
}
