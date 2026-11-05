import {Context, Data} from "effect";

import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {LaunchPlanValueObject} from "@valueObjects/launchPlan.valueObject.ts";
import type {SessionIdValueObject} from "@valueObjects/sessionId.valueObject.ts";
import type {Effect, Result, Stream, SubscriptionRef} from "effect";

// The tab is named once, when it opens: VS Code's stable API cannot rename a terminal afterwards.
export interface TerminalLaunchRequest {
  readonly iconPath: string;
  readonly launchPlan: LaunchPlanValueObject;
  readonly tabName: string;
}

// No session's tab is in front of the user; TerminalInfraService's trace says why.
export class NoViewedSessionError extends Data.TaggedError("NoViewedSessionError") {}
export class TerminalLaunchFailedError extends Data.TaggedError("TerminalLaunchFailedError")<{
  readonly cause: unknown;
}> {}
export class TerminalNotFoundError extends Data.TaggedError("TerminalNotFoundError")<{
  readonly sessionId: SessionIdValueObject;
}> {}

// Each session's terminal tab in this window: the agent runs in it, and closing it ends the agent.
export class ITerminalInfraService extends Context.Service<
  ITerminalInfraService,
  {
    // The session whose tab just became the active terminal, each time one does.
    readonly activatedSessionIds: Stream.Stream<SessionIdValueObject>;
    readonly closeSessionTerminal: (sessionId: SessionIdValueObject) => Effect.Effect<void, TerminalNotFoundError>;
    readonly focusSessionTerminal: (sessionId: SessionIdValueObject) => Effect.Effect<void, TerminalNotFoundError>;
    readonly isSessionTerminalOpen: (sessionId: SessionIdValueObject) => Effect.Effect<boolean>;
    // The sessions with a tab in this window, now and after every change.
    readonly openSessionIds: Stream.Stream<ReadonlySet<SessionIdValueObject>>;
    // Reuses the session's tab when this window already has one.
    readonly openSessionTerminal: (
      session: SessionEntity,
      terminalLaunchRequest: TerminalLaunchRequest
    ) => Effect.Effect<void, TerminalLaunchFailedError>;
    readonly viewedSessionId: SubscriptionRef.SubscriptionRef<
      Result.Result<SessionIdValueObject, NoViewedSessionError>
    >;
  }
>()("aggregor/application/interfaces/terminal.infraService.interface/ITerminalInfraService") {}
