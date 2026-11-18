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

// The terminal's process is no tmux client, as while it starts.
export class FolderShellNotShownError extends Schema.TaggedError<
  FolderShellNotShownError,
  {readonly brand: unique symbol}
>()("FolderShellNotShownError", {}) {}
// The terminal's process is no tmux client, or tmux could not start the folder's shell.
export class FolderShellSwitchFailedError extends Schema.TaggedError<
  FolderShellSwitchFailedError,
  {readonly brand: unique symbol}
>()("FolderShellSwitchFailedError", {folderPath: ProjectPathValueObjectSchema}) {}
// This build has no aggregor-pty: a Windows VSIX, where sessions need WSL, or a local build without it.
export class PtyBinaryNotFoundError extends Schema.TaggedError<
  PtyBinaryNotFoundError,
  {readonly brand: unique symbol}
>()("PtyBinaryNotFoundError", {isWindows: Schema.Boolean}) {}
// tmux doesn't run the session's agent, or the tab's process is no tmux client.
export class SessionTabSwitchFailedError extends Schema.TaggedError<
  SessionTabSwitchFailedError,
  {readonly brand: unique symbol}
>()("SessionTabSwitchFailedError", {sessionId: EntityIdValueObjectSchema}) {}
// tmux is missing from PATH, or older than the version Aggregor's tmux.conf needs.
export class TmuxUnavailableError extends Schema.TaggedError<TmuxUnavailableError, {readonly brand: unique symbol}>()(
  "TmuxUnavailableError",
  {foundVersion: Schema.optional(Schema.String)}
) {}

// Each session's agent, and each folder's shell, runs in its own tmux session, which outlives its terminal and VS Code.
export class ITmuxInfraService extends Context.Service<
  ITmuxInfraService,
  {
    // tmux's version, when it is on PATH and new enough for Aggregor's tmux.conf.
    readonly checkTmuxVersion: Effect.Effect<string, TmuxUnavailableError>;
    readonly endFolderShell: (folderPath: ProjectPathValueObject) => Effect.Effect<void>;
    // The command attaches to the folder's shell when it runs, and otherwise starts it.
    readonly prepareFolderShellTerminalCommand: (
      folderShellRequest: FolderShellRequest
    ) => Effect.Effect<TerminalCommand, TmuxUnavailableError>;
    readonly prepareSessionTabCommand: (
      sessionTabCommandRequest: SessionTabCommandRequest
    ) => Effect.Effect<TerminalCommand, PtyBinaryNotFoundError | TmuxUnavailableError>;
    readonly readFolderShellPathShownInTerminal: (
      terminalProcessId: number
    ) => Effect.Effect<ProjectPathValueObject, FolderShellNotShownError>;
    // A tab's process is a tmux client, and tmux knows which session each client is attached to.
    readonly readShownSessionIdsByTabProcessId: Effect.Effect<ReadonlyMap<number, EntityIdValueObject>>;
    readonly refreshRunningSessionIds: Effect.Effect<ReadonlySet<EntityIdValueObject>>;
    // As last read: at window start or focus, when a terminal closes, after a tab opens and after each stop.
    readonly runningSessionIds: SubscriptionRef.SubscriptionRef<ReadonlySet<EntityIdValueObject>>;
    // Attaches the terminal's tmux client to the folder's shell, started first when it isn't running.
    readonly showFolderShellInTerminal: (
      terminalProcessId: number,
      folderShellRequest: FolderShellRequest
    ) => Effect.Effect<void, FolderShellSwitchFailedError>;
    // Attaches the tab's tmux client to another running session, so the tab itself stays as it is.
    readonly showSessionInTab: (
      tabProcessId: number,
      sessionId: EntityIdValueObject
    ) => Effect.Effect<void, SessionTabSwitchFailedError>;
    readonly startedOrStoppedSessionIds: Stream.Stream<EntityIdValueObject>;
    readonly stopSessionAgent: (sessionId: EntityIdValueObject) => Effect.Effect<void>;
    readonly waitForSessionAgentStart: (sessionId: EntityIdValueObject) => Effect.Effect<void>;
  }
>()("aggregor-app/application/interfaces/tmux.infraService.interface/ITmuxInfraService") {}
