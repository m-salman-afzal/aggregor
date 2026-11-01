import {SessionsCorrupt, SessionsSaveFailed} from "@/errors/session.error.ts";
import {ErrorService} from "@/services/error.service.ts";
import {VsCodeService} from "@/services/vscode.service.ts";
import {fromEvent} from "@/services/vscode.utils.ts";
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

const NO_STORED_SESSIONS: typeof StoredSessions.Encoded = {sessions: [], version: 1};

// globalState is the source of truth, shared by every window; `sessions` is this window's copy for the view.
export class SessionStore extends Context.Service<
  SessionStore,
  {
    readonly loadSessions: Effect.Effect<readonly Session[], SessionsCorrupt>;
    readonly saveSessions: (sessions: readonly Session[]) => Effect.Effect<void, SessionsSaveFailed>;
    readonly sessions: SubscriptionRef.SubscriptionRef<readonly Session[]>;
  }
>()("aggregor/services/session/store.service/SessionStore") {
  public static readonly layer = Layer.effect(
    SessionStore,
    Effect.gen(function* () {
      const {globalState, window} = yield* VsCodeService;

      // Re-reads globalState on every run.
      const loadSessions = Effect.gen(function* () {
        const storedValue = yield* Effect.sync(() =>
          globalState.get<unknown>(STORAGE_KEYS.SESSIONS, NO_STORED_SESSIONS)
        );
        const storedSessions = yield* Schema.decodeUnknownEffect(StoredSessions)(storedValue).pipe(
          Effect.catchTag("SchemaError", (cause) => Effect.fail(new SessionsCorrupt({cause})))
        );

        return storedSessions.sessions;
      }).pipe(Effect.withSpan("SessionStore.loadSessions"));

      const saveSessions = Effect.fn("SessionStore.saveSessions")(function* (sessions: readonly Session[]) {
        const storedValue: typeof StoredSessions.Encoded = {sessions, version: 1};

        yield* Effect.tryPromise({
          catch: (cause) => new SessionsSaveFailed({cause}),
          try: async () => globalState.update(STORAGE_KEYS.SESSIONS, storedValue)
        });
      });

      const showUnreadableSessionsError = Effect.fn("SessionStore.showUnreadableSessionsError")(function* () {
        yield* Effect.forkDetach(
          ErrorService.use((errorService) => errorService.showErrorMessage(SESSION_MESSAGES.UNREADABLE))
        );
        const noSessions: readonly Session[] = [];

        return noSessions;
      });

      // Unreadable data starts the list empty; every write re-reads first, so it is never overwritten.
      const initialSessions = yield* loadSessions.pipe(
        Effect.catchTag("SessionsCorrupt", () => showUnreadableSessionsError())
      );
      const sessions = yield* SubscriptionRef.make<readonly Session[]>(initialSessions);

      // Other windows write to the same globalState; pick up their changes when this window comes back into focus.
      const reloadSessionsOnFocus = Effect.fn("SessionStore.reloadSessionsOnFocus")(function* (
        windowState: WindowState
      ) {
        if (!windowState.focused) return;

        yield* SubscriptionRef.updateEffect(sessions, () => loadSessions);
      });
      yield* Effect.forkScoped(
        Stream.runForEach(fromEvent(window.onDidChangeWindowState), (windowState) =>
          reloadSessionsOnFocus(windowState).pipe(
            Effect.catchTag("SessionsCorrupt", (sessionsCorrupt) =>
              Effect.logError(SESSION_MESSAGES.UNREADABLE, sessionsCorrupt.cause).pipe(
                Effect.andThen(showUnreadableSessionsError())
              )
            )
          )
        )
      );

      return SessionStore.of({loadSessions, saveSessions, sessions});
    })
  );
}
