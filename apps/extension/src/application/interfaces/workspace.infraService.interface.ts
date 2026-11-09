import {Context, Schema} from "effect";

import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {Effect, Stream} from "effect";

// A workspace folder that is a project: every folder but the anchor folder, named as VS Code names it.
export interface WorkspaceFolderProject {
  readonly name: string;
  readonly path: ProjectPathValueObject;
}

// The window didn't reload to open Aggregor's workspace with a session to reopen, or did so too long ago.
export class NoSessionToReopenError extends Schema.TaggedError<
  NoSessionToReopenError,
  {readonly brand: unique symbol}
>()("NoSessionToReopenError", {}) {}

// The folders open in this window's workspace. Once the window shows one project, folder 0 is a hidden, empty anchor
// folder and the project is folder 1.
export class IWorkspaceInfraService extends Context.Service<
  IWorkspaceInfraService,
  {
    // The workspace folders that are projects: all but the anchor folder.
    readonly listWorkspaceFolderProjects: Effect.Effect<readonly WorkspaceFolderProject[]>;
    // Takes the project's folder out of the workspace. Best effort: a failure only logs a warning, and folder 0 stays.
    readonly removeProjectFolder: (projectPath: ProjectPathValueObject) => Effect.Effect<void>;
    // Makes the project the workspace's only project folder, after the anchor folder. A window that isn't yet a saved
    // workspace with the anchor folder at folder 0 opens Aggregor's own workspace file with the project instead, which
    // reloads it, and the session, when there is one, is kept for it to reopen. Best effort: a failure only logs a
    // warning.
    readonly showOnlyProjectFolder: (
      projectPath: ProjectPathValueObject,
      sessionToReopen: EntityIdValueObject | undefined
    ) => Effect.Effect<void>;
    // The session the window was showing when it reloaded to open Aggregor's workspace, once, right after.
    readonly takeSessionToReopen: Effect.Effect<EntityIdValueObject, NoSessionToReopenError>;
    // Each time a folder joins or leaves the workspace.
    readonly workspaceFolderChanges: Stream.Stream<void>;
  }
>()("aggregor-app/application/interfaces/workspace.infraService.interface/IWorkspaceInfraService") {}
