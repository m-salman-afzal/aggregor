import {Context, Schema} from "effect";

import type {SessionTabCommand} from "@interfaces/terminal.infraService.interface.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {LaunchPlanValueObject} from "@valueObjects/launchPlan.valueObject.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {Effect, Stream, SubscriptionRef} from "effect";

export interface SessionTabCommandRequest {
  readonly launchPlan: LaunchPlanValueObject;
  readonly sessionId: EntityIdValueObject;
  readonly setupScript?: string | undefined;
  readonly workingFolderPath: ProjectPathValueObject;
}

// This build has no aggregor-pty: a Windows VSIX, where sessions need WSL, or a local build without it.
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
    readonly prepareSessionTabCommand: (
      sessionTabCommandRequest: SessionTabCommandRequest
    ) => Effect.Effect<SessionTabCommand, PtyBinaryNotFoundError | TmuxUnavailableError>;
    readonly refreshRunningSessionIds: Effect.Effect<ReadonlySet<EntityIdValueObject>>;
    // As last read: at window start or focus, when a terminal closes, after a tab opens and after each stop.
    readonly runningSessionIds: SubscriptionRef.SubscriptionRef<ReadonlySet<EntityIdValueObject>>;
    readonly startedOrStoppedSessionIds: Stream.Stream<EntityIdValueObject>;
    readonly stopSessionAgent: (sessionId: EntityIdValueObject) => Effect.Effect<void>;
    readonly waitForSessionAgentStart: (sessionId: EntityIdValueObject) => Effect.Effect<void>;
  }
>()("aggregor-app/application/interfaces/tmux.infraService.interface/ITmuxInfraService") {}
