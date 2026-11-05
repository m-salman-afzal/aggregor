import {Context} from "effect";

import type {ProjectEntity} from "@entities/project/project.entity.ts";
import type {Effect} from "effect";

// The folders open in this window's workspace.
export class IWorkspaceInfraService extends Context.Service<
  IWorkspaceInfraService,
  {readonly listWorkspaceFolderProjects: Effect.Effect<readonly ProjectEntity[]>}
>()("aggregor-app/application/interfaces/workspace.infraService.interface/IWorkspaceInfraService") {}
