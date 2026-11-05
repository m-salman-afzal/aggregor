import {Context} from "effect";

import type {
  NoActiveTerminal,
  NotATerminalTab,
  TerminalLaunchFailed,
  TerminalNotFound,
  UntrackedTerminal,
  WindowUnfocused
} from "@/application/errors/terminal.error.ts";
import type {Session} from "@/domain/entities/session/session.entity.ts";
import type {LaunchPlan} from "@/domain/value-objects/launch-plan.value-object.ts";
import type {SessionId} from "@/domain/value-objects/session-id.value-object.ts";
import type {Effect, Result, Stream, SubscriptionRef} from "effect";

// Why no session is in front of the user.
export type NoViewedSession = NoActiveTerminal | NotATerminalTab | UntrackedTerminal | WindowUnfocused;

// The tab is named once, when it opens: VS Code's stable API cannot rename a terminal afterwards.
export interface TerminalLaunch {
  readonly iconPath: string;
  readonly launchPlan: LaunchPlan;
  readonly tabName: string;
}

// Each session's terminal tab in this window: the agent runs in it, and closing it ends the agent.
export class TerminalClient extends Context.Service<
  TerminalClient,
  {
    // The session whose tab just became the active terminal, each time one does.
    readonly activatedSessionIds: Stream.Stream<SessionId>;
    readonly closeSessionTerminal: (sessionId: SessionId) => Effect.Effect<void, TerminalNotFound>;
    readonly focusSessionTerminal: (sessionId: SessionId) => Effect.Effect<void, TerminalNotFound>;
    readonly isSessionTerminalOpen: (sessionId: SessionId) => Effect.Effect<boolean>;
    // The sessions with a tab in this window, now and after every change.
    readonly openSessionIds: Stream.Stream<ReadonlySet<SessionId>>;
    // Reuses the session's tab when this window already has one.
    readonly openSessionTerminal: (
      session: Session,
      terminalLaunch: TerminalLaunch
    ) => Effect.Effect<void, TerminalLaunchFailed>;
    readonly viewedSessionId: SubscriptionRef.SubscriptionRef<Result.Result<SessionId, NoViewedSession>>;
  }
>()("aggregor/application/clients/terminal.client/TerminalClient") {}
