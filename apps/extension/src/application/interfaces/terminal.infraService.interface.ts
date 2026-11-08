import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {Context, Schema} from "effect";

import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {LaunchPlanValueObject} from "@valueObjects/launchPlan.valueObject.ts";
import type {ListedProjectValueObject} from "@valueObjects/listedProject.valueObject.ts";
import type {Effect, Result, Stream, SubscriptionRef} from "effect";

// A tab with a name keeps it; one without shows the title the agent gives its terminal, as it changes.
export interface TerminalLaunchRequest {
  readonly iconPath: string;
  readonly launchPlan: LaunchPlanValueObject;
  readonly tabName: string | undefined;
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

// Each session's terminal tab in this window: the agent runs in it, and closing it ends the agent.
export class ITerminalInfraService extends Context.Service<
  ITerminalInfraService,
  {
    // The session whose tab just became the active terminal, each time one does.
    readonly activatedSessionIds: Stream.Stream<EntityIdValueObject>;
    readonly closeSessionTerminal: (sessionId: EntityIdValueObject) => Effect.Effect<void, TerminalNotFoundError>;
    readonly focusSessionTerminal: (sessionId: EntityIdValueObject) => Effect.Effect<void, TerminalNotFoundError>;
    readonly isSessionTerminalOpen: (sessionId: EntityIdValueObject) => Effect.Effect<boolean>;
    // A plain shell in the project's folder, in the Terminal panel.
    readonly openProjectTerminal: (project: ListedProjectValueObject) => Effect.Effect<void, TerminalLaunchFailedError>;
    // The sessions with a tab in this window, now and after every change.
    readonly openSessionIds: Stream.Stream<ReadonlySet<EntityIdValueObject>>;
    readonly openSessionTerminal: (
      session: SessionEntity,
      terminalLaunchRequest: TerminalLaunchRequest
    ) => Effect.Effect<void, TerminalLaunchFailedError>;
    // Reuses the session's tab when this window already has one.
    // Renames the session's tab when it is open; the tab then keeps the name instead of the agent's title.
    readonly renameSessionTerminal: (sessionId: EntityIdValueObject, tabName: string) => Effect.Effect<void>;
    // A session tab's title whenever it changes, as the agent in it sets it; every subscriber sees every change.
    readonly sessionTerminalTitles: Stream.Stream<readonly [EntityIdValueObject, string]>;
    readonly viewedSessionId: SubscriptionRef.SubscriptionRef<Result.Result<EntityIdValueObject, NoViewedSessionError>>;
  }
>()("aggregor-app/application/interfaces/terminal.infraService.interface/ITerminalInfraService") {}
