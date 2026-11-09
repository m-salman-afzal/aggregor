import {Context, Schema} from "effect";

import type {SessionTabCommand} from "@interfaces/terminal.infraService.interface.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {LaunchPlanValueObject} from "@valueObjects/launchPlan.valueObject.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {Effect, Stream, SubscriptionRef} from "effect";

// What a session's tab command is built from: the session its agent records its status for, its project, and how the
// agent starts.
export interface SessionTabCommandRequest {
  readonly launchPlan: LaunchPlanValueObject;
  readonly projectPath: ProjectPathValueObject;
  readonly sessionId: EntityIdValueObject;
}

// This build has no aggregor-pty for the platform, which runs every session's agent: the universal VSIX on Windows, where
// sessions need WSL, or on a platform no VSIX is built for.
export class PtyBinaryNotFoundError extends Schema.TaggedError<
  PtyBinaryNotFoundError,
  {readonly brand: unique symbol}
>()("PtyBinaryNotFoundError", {isWindows: Schema.Boolean}) {}
// tmux is missing from PATH, or older than the version Aggregor's tmux.conf needs.
export class TmuxUnavailableError extends Schema.TaggedError<TmuxUnavailableError, {readonly brand: unique symbol}>()(
  "TmuxUnavailableError",
  {foundVersion: Schema.optional(Schema.String)}
) {}

// Each session's agent runs in its own tmux session, which outlives its tab, a window reload and VS Code itself.
export class ITmuxInfraService extends Context.Service<
  ITmuxInfraService,
  {
    // The command a session's tab runs: tmux attaches to the session's tmux session, or starts one with the agent under
    // aggregor-pty.
    readonly prepareSessionTabCommand: (
      sessionTabCommandRequest: SessionTabCommandRequest
    ) => Effect.Effect<SessionTabCommand, PtyBinaryNotFoundError | TmuxUnavailableError>;
    // Reads which sessions' agents tmux runs now, and updates runningSessionIds with it.
    readonly refreshRunningSessionIds: Effect.Effect<ReadonlySet<EntityIdValueObject>>;
    // The sessions whose agent tmux runs, as last read: when the window starts or regains focus, when a terminal
    // closes, after a session's tab opens, and after each stop.
    readonly runningSessionIds: SubscriptionRef.SubscriptionRef<ReadonlySet<EntityIdValueObject>>;
    // The session whose agent started or stopped, each time runningSessionIds changes.
    readonly startedOrStoppedSessionIds: Stream.Stream<EntityIdValueObject>;
    // Ends the session's tmux session and its agent; one already gone has nothing to stop.
    readonly stopSessionAgent: (sessionId: EntityIdValueObject) => Effect.Effect<void>;
    // Reads tmux's list until it has the session, whose tab has just opened; one that never shows up has its tab say why.
    readonly waitForSessionAgentStart: (sessionId: EntityIdValueObject) => Effect.Effect<void>;
  }
>()("aggregor-app/application/interfaces/tmux.infraService.interface/ITmuxInfraService") {}
