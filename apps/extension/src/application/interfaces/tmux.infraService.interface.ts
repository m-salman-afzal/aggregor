import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {Context, Schema} from "effect";

import type {TerminalCommand} from "@interfaces/terminal.infraService.interface.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {LaunchPlanValueObject} from "@valueObjects/launchPlan.valueObject.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {Effect, Stream, SubscriptionRef} from "effect";

export interface FolderShellRequest {
  readonly folderPath: ProjectPathValueObject;
  // What the shell's status line shows, since one terminal shows every folder's shell.
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
  // The terminal's process is no tmux client, as while it starts.
  FolderShellNotShownError: {},
  // The terminal's process is no tmux client, or tmux could not start the folder's shell.
  FolderShellSwitchFailedError: {folderPath: ProjectPathValueObjectSchema},
  // This build has no aggregor-pty: a Windows VSIX, where sessions need WSL, or a local build without it.
  PtyBinaryNotFoundError: {isWindows: Schema.Boolean},
  // tmux doesn't run the session's agent, or the tab's process is no tmux client.
  SessionTabSwitchFailedError: {sessionId: EntityIdValueObjectSchema},
  // tmux runs no such session: its agent, or its folder's shell, has ended.
  TmuxSessionNotRunningError: {},
  // tmux is missing from PATH, or older than the version Aggregor's tmux.conf needs.
  TmuxUnavailableError: {foundVersion: Schema.optional(Schema.String)}
}) {}

// Each session's agent, and each folder's shell, runs in its own tmux session, which outlives its terminal and VS Code.
export class ITmuxInfraService extends Context.Service<
  ITmuxInfraService,
  {
    // tmux's version, when it is on PATH and new enough for Aggregor's tmux.conf.
    readonly checkTmuxVersion: Effect.Effect<string, ITmuxInfraServiceErrors["TmuxUnavailableError"]>;
    readonly endFolderShell: (folderPath: ProjectPathValueObject) => Effect.Effect<void>;
    // The command attaches to the folder's shell when it runs, and otherwise starts it.
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
    // A tab's process is a tmux client, and tmux knows which session each client is attached to.
    readonly readShownSessionIdsByTabProcessId: Effect.Effect<ReadonlyMap<number, EntityIdValueObject>>;
    readonly refreshRunningSessionIds: Effect.Effect<ReadonlySet<EntityIdValueObject>>;
    // As last read: at window start or focus, when a terminal closes, after a tab opens and after each stop.
    readonly runningSessionIds: SubscriptionRef.SubscriptionRef<ReadonlySet<EntityIdValueObject>>;
    // Attaches the terminal's tmux client to the folder's shell, started first when it isn't running.
    readonly showFolderShellInTerminal: (
      terminalProcessId: number,
      folderShellRequest: FolderShellRequest
    ) => Effect.Effect<void, ITmuxInfraServiceErrors["FolderShellSwitchFailedError"]>;
    // Attaches the tab's tmux client to another running session, so the tab itself stays as it is.
    readonly showSessionInTab: (
      tabProcessId: number,
      sessionId: EntityIdValueObject
    ) => Effect.Effect<void, ITmuxInfraServiceErrors["SessionTabSwitchFailedError"]>;
    readonly startedOrStoppedSessionIds: Stream.Stream<EntityIdValueObject>;
    readonly stopSessionAgent: (sessionId: EntityIdValueObject) => Effect.Effect<void>;
    readonly waitForSessionAgentStart: (sessionId: EntityIdValueObject) => Effect.Effect<void>;
  }
>()("aggregor-app/application/interfaces/tmux.infraService.interface/ITmuxInfraService") {}
