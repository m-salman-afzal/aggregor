import {Context, Schema} from "effect";

import {EntityIdValueObjectSchema} from "@/valueObjects/entityId.valueObject.ts";
import {ProjectPathValueObjectSchema} from "@/valueObjects/projectPath.valueObject.ts";
import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";

import type {Effect, Stream, SubscriptionRef} from "effect";

import type {TerminalCommand} from "@/interfaces/terminal.infraService.interface.ts";
import type {EntityIdValueObject} from "@/valueObjects/entityId.valueObject.ts";
import type {LaunchPlanValueObject} from "@/valueObjects/launchPlan.valueObject.ts";
import type {ProjectPathValueObject} from "@/valueObjects/projectPath.valueObject.ts";

export interface FolderShellRequest {
  readonly folderPath: ProjectPathValueObject;
  readonly statusLabel: string;
}

export interface SessionTabCommandRequest {
  readonly launchPlan: LaunchPlanValueObject;
  readonly sessionId: EntityIdValueObject;
  readonly sessionMemoryLimit: string | undefined;
  readonly setupScript?: string | undefined;
  readonly workingFolderPath: ProjectPathValueObject;
}

// What a tmux session's panes run, and the tmux server, in whose cgroup a pane without a scope of its own runs.
export interface TmuxSessionPanes {
  readonly paneProcessIds: readonly number[];
  readonly tmuxServerProcessId: number;
}

export class ITmuxInfraServiceErrors extends TaggedErrors({
  FolderShellNotShownError: {},
  FolderShellSwitchFailedError: {folderPath: ProjectPathValueObjectSchema},
  PtyBinaryNotFoundError: {isWindows: Schema.Boolean},
  SessionTabSwitchFailedError: {sessionId: EntityIdValueObjectSchema},
  TmuxSessionNotRunningError: {},
  TmuxUnavailableError: {foundVersion: Schema.optional(Schema.String)}
}) {}

export class ITmuxInfraService extends Context.Service<
  ITmuxInfraService,
  {
    readonly checkTmuxVersion: Effect.Effect<string, ITmuxInfraServiceErrors["TmuxUnavailableError"]>;
    readonly endFolderShell: (folderPath: ProjectPathValueObject) => Effect.Effect<void>;
    readonly pasteTextIntoSessionAgent: (
      sessionId: EntityIdValueObject,
      text: string
    ) => Effect.Effect<void, ITmuxInfraServiceErrors["TmuxSessionNotRunningError"]>;
    readonly prepareFolderShellTerminalCommand: (
      folderShellRequest: FolderShellRequest
    ) => Effect.Effect<TerminalCommand, ITmuxInfraServiceErrors["TmuxUnavailableError"]>;
    readonly prepareSessionTabCommand: (
      sessionTabCommandRequest: SessionTabCommandRequest
    ) => Effect.Effect<TerminalCommand, ITmuxInfraServiceErrors["PtyBinaryNotFoundError" | "TmuxUnavailableError"]>;
    readonly readFolderShellPanes: (
      folderPath: ProjectPathValueObject
    ) => Effect.Effect<TmuxSessionPanes, ITmuxInfraServiceErrors["TmuxSessionNotRunningError"]>;
    readonly readFolderShellPathShownInTerminal: (
      terminalProcessId: number
    ) => Effect.Effect<ProjectPathValueObject, ITmuxInfraServiceErrors["FolderShellNotShownError"]>;
    readonly readSessionAgentPanes: (
      sessionId: EntityIdValueObject
    ) => Effect.Effect<TmuxSessionPanes, ITmuxInfraServiceErrors["TmuxSessionNotRunningError"]>;
    readonly readShownSessionIdsByTabProcessId: Effect.Effect<ReadonlyMap<number, EntityIdValueObject>>;
    readonly refreshRunningSessionIds: Effect.Effect<ReadonlySet<EntityIdValueObject>>;
    // As last read: at window start or focus, when a terminal closes, after a tab opens and after each stop.
    readonly runningSessionIds: SubscriptionRef.SubscriptionRef<ReadonlySet<EntityIdValueObject>>;
    readonly showFolderShellInTerminal: (
      terminalProcessId: number,
      folderShellRequest: FolderShellRequest
    ) => Effect.Effect<void, ITmuxInfraServiceErrors["FolderShellSwitchFailedError"]>;
    readonly showSessionInTab: (
      tabProcessId: number,
      sessionId: EntityIdValueObject
    ) => Effect.Effect<void, ITmuxInfraServiceErrors["SessionTabSwitchFailedError"]>;
    readonly startedOrStoppedSessionIds: Stream.Stream<EntityIdValueObject>;
    readonly stopSessionAgent: (sessionId: EntityIdValueObject) => Effect.Effect<void>;
    readonly waitForSessionAgentStart: (sessionId: EntityIdValueObject) => Effect.Effect<void>;
  }
>()("aggregor-app/application/interfaces/tmux.infraService.interface/ITmuxInfraService") {}
