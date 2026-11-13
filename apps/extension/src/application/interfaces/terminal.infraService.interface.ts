import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {Context, Schema} from "effect";

import type {ProjectListItemDto} from "@dtos/project.dto.ts";
import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {AgentIconValueObject} from "@valueObjects/agentIcon.valueObject.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {Effect, Result, Stream, SubscriptionRef} from "effect";

// Run as the tab's process, with no shell around it.
export interface SessionTabCommand {
  readonly command: string;
  readonly commandArguments: readonly string[];
}

export interface SessionTabRequest {
  readonly icon: AgentIconValueObject;
  readonly tabCommand: SessionTabCommand;
  readonly tabName: string;
}

// No session's tab is in front of the user; TerminalInfraService's trace says why.
export class NoViewedSessionError extends Schema.TaggedError<NoViewedSessionError, {readonly brand: unique symbol}>()(
  "NoViewedSessionError",
  {}
) {}

export class TerminalLaunchFailedError extends Schema.TaggedError<
  TerminalLaunchFailedError,
  {readonly brand: unique symbol}
>()("TerminalLaunchFailedError", {cause: Schema.Unknown}) {}
export class TerminalNotFoundError extends Schema.TaggedError<TerminalNotFoundError, {readonly brand: unique symbol}>()(
  "TerminalNotFoundError",
  {sessionId: EntityIdValueObjectSchema}
) {}

// A tab is a tmux client attached to the session's agent, so closing it leaves the agent running.
export class ITerminalInfraService extends Context.Service<
  ITerminalInfraService,
  {
    readonly activatedSessionIds: Stream.Stream<EntityIdValueObject>;
    readonly closeSessionTerminal: (sessionId: EntityIdValueObject) => Effect.Effect<void, TerminalNotFoundError>;
    readonly focusSessionTerminal: (sessionId: EntityIdValueObject) => Effect.Effect<void, TerminalNotFoundError>;
    // VS Code can rename only the active terminal.
    readonly nameActiveSessionTab: (sessionId: EntityIdValueObject, tabName: string) => Effect.Effect<void>;
    readonly openProjectTerminal: (project: ProjectListItemDto) => Effect.Effect<void, TerminalLaunchFailedError>;
    readonly openSessionTerminal: (
      session: SessionEntity,
      sessionTabRequest: SessionTabRequest
    ) => Effect.Effect<void, TerminalLaunchFailedError>;
    readonly viewedSessionId: SubscriptionRef.SubscriptionRef<Result.Result<EntityIdValueObject, NoViewedSessionError>>;
  }
>()("aggregor-app/application/interfaces/terminal.infraService.interface/ITerminalInfraService") {}
