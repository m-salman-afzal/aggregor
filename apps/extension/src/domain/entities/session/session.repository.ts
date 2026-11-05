import {Context} from "effect";

import type {Session} from "@/domain/entities/session/session.entity.ts";
import type {SessionsCorrupt, SessionsSaveFailed} from "@/domain/errors/session.error.ts";
import type {Effect, SubscriptionRef} from "effect";

// The saved sessions, shared by every window. `sessions` is this window's copy, which the view renders from.
export class SessionRepository extends Context.Service<
  SessionRepository,
  {
    // Re-reads the saved sessions, applies the change and saves the result: a change never drops what another window
    // saved, and unreadable data fails the change instead of being overwritten.
    readonly modifySessions: <ChangeResult>(
      changeSessions: (savedSessions: readonly Session[]) => readonly [ChangeResult, readonly Session[]]
    ) => Effect.Effect<ChangeResult, SessionsCorrupt | SessionsSaveFailed>;
    readonly sessions: SubscriptionRef.SubscriptionRef<readonly Session[]>;
  }
>()("aggregor/domain/entities/session/session.repository/SessionRepository") {}
