import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {Context, Schema} from "effect";

import type {ProjectListItemDto} from "@dtos/project.dto.ts";
import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {HarnessIconValueObject} from "@valueObjects/harnessIcon.valueObject.ts";
import type {Effect, Result, Stream, SubscriptionRef} from "effect";

// A program and its arguments, run as the tab's process with no shell around it.
export interface SessionTabCommand {
  readonly command: string;
  readonly commandArguments: readonly string[];
}

// The tab opens with its harness's icon and the session's name, the one its row shows, and keeps that name instead of
// the agent's own titles. It runs tabCommand, which attaches to the session's agent in tmux or starts it.
export interface SessionTabRequest {
  readonly icon: HarnessIconValueObject;
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

// Each session's terminal tab in this window: a tmux client attached to the session's agent, so closing it leaves the
// agent running. VS Code keeps the tabs over a reload and restores them when it starts again.
export class ITerminalInfraService extends Context.Service<
  ITerminalInfraService,
  {
    // The session whose tab just became the active terminal, each time one does.
    readonly activatedSessionIds: Stream.Stream<EntityIdValueObject>;
    readonly closeSessionTerminal: (sessionId: EntityIdValueObject) => Effect.Effect<void, TerminalNotFoundError>;
    readonly focusSessionTerminal: (sessionId: EntityIdValueObject) => Effect.Effect<void, TerminalNotFoundError>;
    // Gives the session's tab the name when it is the active terminal and named otherwise; VS Code can rename only the
    // active terminal.
    readonly nameActiveSessionTab: (sessionId: EntityIdValueObject, tabName: string) => Effect.Effect<void>;
    // A plain shell in the project's folder, in the Terminal panel.
    readonly openProjectTerminal: (project: ProjectListItemDto) => Effect.Effect<void, TerminalLaunchFailedError>;
    // Shows the session's tab when this window already has one; else opens one running the request's tab command.
    readonly openSessionTerminal: (
      session: SessionEntity,
      sessionTabRequest: SessionTabRequest
    ) => Effect.Effect<void, TerminalLaunchFailedError>;
    readonly viewedSessionId: SubscriptionRef.SubscriptionRef<Result.Result<EntityIdValueObject, NoViewedSessionError>>;
  }
>()("aggregor-app/application/interfaces/terminal.infraService.interface/ITerminalInfraService") {}
