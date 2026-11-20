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
  // No session's tab is in front of the user; TerminalInfraService's trace says why.
  NoViewedSessionError: {},
  TerminalLaunchFailedError: {cause: Schema.Unknown},
  TerminalNotFoundError: {sessionId: EntityIdValueObjectSchema}
}) {}

// A tab is a tmux client attached to the session's agent, so closing it leaves the agent running.
export class ITerminalInfraService extends Context.Service<
  ITerminalInfraService,
  {
    readonly activatedSessionIds: Stream.Stream<EntityIdValueObject>;
    // tmux can attach the window's Aggregor terminal to another folder's shell, which VS Code can't see.
    readonly assignShownFolderShellPath: (folderPath: ProjectPathValueObject) => Effect.Effect<void>;
    // tmux can attach a tab to another session, so each tab counts as the session its tmux client shows.
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
    // The folder whose shell the Aggregor terminal showed when the user closed it; a reload or a quit yields none.
    readonly folderShellPathsClosedByUser: Stream.Stream<ProjectPathValueObject>;
    // VS Code can rename only the active terminal.
    readonly nameActiveSessionTab: (sessionId: EntityIdValueObject, tabName: string) => Effect.Effect<void>;
    // A window has one Aggregor terminal: it opens the first time and comes to the front after that.
    readonly openFolderShellTerminal: (
      folderShellTerminalRequest: FolderShellTerminalRequest
    ) => Effect.Effect<void, ITerminalInfraServiceErrors["TerminalLaunchFailedError"]>;
    readonly openSessionTerminal: (
      session: SessionEntity,
      sessionTabRequest: SessionTabRequest
    ) => Effect.Effect<void, ITerminalInfraServiceErrors["TerminalLaunchFailedError"]>;
    // A command the user watches and answers, such as sudo's password; its output stays until they press Enter.
    readonly openSetupTerminal: (commandLine: string) => Effect.Effect<void>;
    // What VS Code launches for the Aggregor terminal profile, the same as Aggregor launches itself.
    readonly prepareFolderShellTerminalOptions: (
      terminalCommand: TerminalCommand
    ) => Effect.Effect<FolderShellTerminalOptions>;
    readonly viewedSessionId: SubscriptionRef.SubscriptionRef<
      Result.Result<EntityIdValueObject, ITerminalInfraServiceErrors["NoViewedSessionError"]>
    >;
  }
>()("aggregor-app/application/interfaces/terminal.infraService.interface/ITerminalInfraService") {}
