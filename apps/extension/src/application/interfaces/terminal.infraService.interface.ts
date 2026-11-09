import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {Context, Schema} from "effect";

import type {ProjectListItemDto} from "@dtos/project.dto.ts";
import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {LaunchPlan} from "@interfaces/harness.infraService.interface.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {Effect, Result, Stream, SubscriptionRef} from "effect";

// A tab with a name keeps it; one without shows the title the agent gives its terminal, as it changes.
export interface TerminalLaunchRequest {
  readonly iconPath: string;
  readonly launchPlan: LaunchPlan;
  readonly tabName: string | undefined;
}

// No session's tab is in front of the user; TerminalInfraService's trace says why.
export class NoViewedSessionError extends Schema.TaggedError<NoViewedSessionError, {readonly brand: unique symbol}>()(
  "NoViewedSessionError",
  {}
) {}

// This build has no aggregor-pty for the platform, which runs every session's agent: the universal VSIX on Windows, where
// sessions need WSL, or on a platform no VSIX is built for.
export class PtyBinaryNotFoundError extends Schema.TaggedError<
  PtyBinaryNotFoundError,
  {readonly brand: unique symbol}
>()("PtyBinaryNotFoundError", {isWindows: Schema.Boolean}) {}
export class TerminalLaunchFailedError extends Schema.TaggedError<
  TerminalLaunchFailedError,
  {readonly brand: unique symbol}
>()("TerminalLaunchFailedError", {cause: Schema.Unknown}) {}
export class TerminalNotFoundError extends Schema.TaggedError<TerminalNotFoundError, {readonly brand: unique symbol}>()(
  "TerminalNotFoundError",
  {sessionId: EntityIdValueObjectSchema}
) {}

// Each session's terminal tab in this window: the agent runs in it, and closing it ends the agent.
export class ITerminalInfraService extends Context.Service<
  ITerminalInfraService,
  {
    // The session whose tab just became the active terminal, each time one does.
    readonly activatedSessionIds: Stream.Stream<EntityIdValueObject>;
    readonly closeSessionTerminal: (sessionId: EntityIdValueObject) => Effect.Effect<void, TerminalNotFoundError>;
    readonly focusSessionTerminal: (sessionId: EntityIdValueObject) => Effect.Effect<void, TerminalNotFoundError>;
    readonly isSessionTerminalOpen: (sessionId: EntityIdValueObject) => Effect.Effect<boolean>;
    // The session whose tab opened or closed in this window, each time one does.
    readonly openedOrClosedSessionIds: Stream.Stream<EntityIdValueObject>;
    // A plain shell in the project's folder, in the Terminal panel.
    readonly openProjectTerminal: (project: ProjectListItemDto) => Effect.Effect<void, TerminalLaunchFailedError>;
    // Reuses the session's tab when this window already has one; else runs the launch plan under aggregor-pty, which
    // records the agent's status on the session's row.
    readonly openSessionTerminal: (
      session: SessionEntity,
      terminalLaunchRequest: TerminalLaunchRequest
    ) => Effect.Effect<void, PtyBinaryNotFoundError | TerminalLaunchFailedError>;
    // Renames the session's tab when it is open; the tab then keeps the name instead of the agent's title.
    readonly renameSessionTerminal: (sessionId: EntityIdValueObject, tabName: string) => Effect.Effect<void>;
    readonly viewedSessionId: SubscriptionRef.SubscriptionRef<Result.Result<EntityIdValueObject, NoViewedSessionError>>;
  }
>()("aggregor-app/application/interfaces/terminal.infraService.interface/ITerminalInfraService") {}
