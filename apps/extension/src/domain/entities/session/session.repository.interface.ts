import {Context} from "effect";

import type {SessionEntity} from "@/domain/entities/session/session.entity.ts";
import type {
  SessionsCorruptError,
  SessionsSaveFailedError
} from "@/domain/entities/session/session.repository.error.ts";
import type {Effect, SubscriptionRef} from "effect";

// The saved sessions, shared by every window. `sessions` is this window's copy, which the view renders from.
export class ISessionRepository extends Context.Service<
  ISessionRepository,
  {
    // Re-reads the saved sessions, applies the change and saves the result: a change never drops what another window
    // saved, and unreadable data fails the change instead of being overwritten.
    readonly modifySessions: <ChangeResult>(
      changeSessions: (savedSessions: readonly SessionEntity[]) => readonly [ChangeResult, readonly SessionEntity[]]
    ) => Effect.Effect<ChangeResult, SessionsCorruptError | SessionsSaveFailedError>;
    readonly sessions: SubscriptionRef.SubscriptionRef<readonly SessionEntity[]>;
  }
>()("aggregor/domain/entities/session/session.repository.interface/ISessionRepository") {}
