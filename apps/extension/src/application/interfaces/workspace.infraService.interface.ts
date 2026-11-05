import {Context} from "effect";

import type {ProjectEntity} from "@entities/project/project.entity.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {Effect} from "effect";

// The folders open in this window's workspace. Once the window shows one project, folder 0 is a hidden, empty anchor
// folder and the project is folder 1.
export class IWorkspaceInfraService extends Context.Service<
  IWorkspaceInfraService,
  {
    // The workspace folders that are projects: all but the anchor folder.
    readonly listWorkspaceFolderProjects: Effect.Effect<readonly ProjectEntity[]>;
    // Takes the project's folder out of the workspace. Best effort: a failure only logs a warning, and folder 0 stays.
    readonly removeProjectFolder: (projectPath: ProjectPathValueObject) => Effect.Effect<void>;
    // Makes the project the workspace's only project folder, after the anchor folder. The first time, the anchor folder
    // takes folder 0, which restarts every extension. Best effort: a failure only logs a warning.
    readonly showOnlyProjectFolder: (projectPath: ProjectPathValueObject) => Effect.Effect<void>;
  }
>()("aggregor-app/application/interfaces/workspace.infraService.interface/IWorkspaceInfraService") {}
