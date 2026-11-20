import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {Context, Schema} from "effect";

import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {AgentIconValueObject} from "@valueObjects/agentIcon.valueObject.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {Effect, Result, Stream, SubscriptionRef} from "effect";

// Run as the terminal's process, with no shell around it.
export interface TerminalCommand {
  readonly command: string;
  readonly commandArguments: readonly string[];
}

export interface FolderShellTerminalRequest {
  readonly folderPath: ProjectPathValueObject;
  readonly terminalCommand: TerminalCommand;
}

export interface FolderShellTerminalOptions {
  readonly cwd: string;
  readonly name: string;
  readonly shellArgs: readonly string[];
  readonly shellPath: string;
}

export interface SessionTabRequest {
  readonly icon: AgentIconValueObject;
  readonly isPinned: boolean;
  // A shared tab shows sessions of any agent, and a tab's icon can't change, so it takes Aggregor's.
  readonly isShared: boolean;
  readonly tabCommand: TerminalCommand;
  readonly tabName: string;
}

export class ITerminalInfraServiceErrors extends TaggedErrors({
  NoFolderShellTerminalOpenError: {},
  NoSessionTabOpenError: {},
  NoViewedSessionError: {},
  TerminalLaunchFailedError: {cause: Schema.Unknown},
  TerminalNotFoundError: {sessionId: EntityIdValueObjectSchema}
}) {}

export class ITerminalInfraService extends Context.Service<
  ITerminalInfraService,
  {
    readonly activatedSessionIds: Stream.Stream<EntityIdValueObject>;
    readonly assignShownFolderShellPath: (folderPath: ProjectPathValueObject) => Effect.Effect<void>;
    readonly assignShownSessions: (
      shownSessionIdsByTabProcessId: ReadonlyMap<number, EntityIdValueObject>
    ) => Effect.Effect<void>;
    readonly closedSetupTerminals: Stream.Stream<void>;
    readonly closeOtherSessionTerminals: (shownSessionId: EntityIdValueObject) => Effect.Effect<void>;
    readonly closeSessionTerminal: (
      sessionId: EntityIdValueObject
    ) => Effect.Effect<void, ITerminalInfraServiceErrors["TerminalNotFoundError"]>;
    readonly findFolderShellTerminalProcessId: Effect.Effect<
      number,
      ITerminalInfraServiceErrors["NoFolderShellTerminalOpenError"]
    >;
    readonly findOpenSessionTerminalProcessId: Effect.Effect<
      number,
      ITerminalInfraServiceErrors["NoSessionTabOpenError"]
    >;
    readonly focusSessionTerminal: (
      sessionId: EntityIdValueObject
    ) => Effect.Effect<void, ITerminalInfraServiceErrors["TerminalNotFoundError"]>;
    readonly folderShellPathsClosedByUser: Stream.Stream<ProjectPathValueObject>;
    readonly nameActiveSessionTab: (sessionId: EntityIdValueObject, tabName: string) => Effect.Effect<void>;
    readonly openFolderShellTerminal: (
      folderShellTerminalRequest: FolderShellTerminalRequest
    ) => Effect.Effect<void, ITerminalInfraServiceErrors["TerminalLaunchFailedError"]>;
    readonly openSessionTerminal: (
      session: SessionEntity,
      sessionTabRequest: SessionTabRequest
    ) => Effect.Effect<void, ITerminalInfraServiceErrors["TerminalLaunchFailedError"]>;
    readonly openSetupTerminal: (commandLine: string) => Effect.Effect<void>;
    readonly prepareFolderShellTerminalOptions: (
      terminalCommand: TerminalCommand
    ) => Effect.Effect<FolderShellTerminalOptions>;
    readonly viewedSessionId: SubscriptionRef.SubscriptionRef<
      Result.Result<EntityIdValueObject, ITerminalInfraServiceErrors["NoViewedSessionError"]>
    >;
  }
>()("aggregor-app/application/interfaces/terminal.infraService.interface/ITerminalInfraService") {}
