import {Context, Schema} from "effect";

import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {Effect, Stream} from "effect";

export interface WorkspaceFolderProject {
  readonly name: string;
  readonly path: ProjectPathValueObject;
}

export class NoSessionToReopenError extends Schema.TaggedError<
  NoSessionToReopenError,
  {readonly brand: unique symbol}
>()("NoSessionToReopenError", {}) {}

// Once the window shows one project, folder 0 is a hidden, empty anchor folder and the project is folder 1.
export class IWorkspaceInfraService extends Context.Service<
  IWorkspaceInfraService,
  {
    readonly listWorkspaceFolderProjects: Effect.Effect<readonly WorkspaceFolderProject[]>;
    // Best effort: a failure only logs a warning, and folder 0 stays.
    readonly removeProjectFolder: (projectPath: ProjectPathValueObject) => Effect.Effect<void>;
    // A window that isn't Aggregor's saved workspace opens it with the project instead, which reloads the window.
    readonly showOnlyProjectFolder: (
      projectPath: ProjectPathValueObject,
      sessionToReopen: EntityIdValueObject | undefined
    ) => Effect.Effect<void>;
    readonly takeSessionToReopen: Effect.Effect<EntityIdValueObject, NoSessionToReopenError>;
    readonly workspaceFolderChanges: Stream.Stream<void>;
  }
>()("aggregor-app/application/interfaces/workspace.infraService.interface/IWorkspaceInfraService") {}
