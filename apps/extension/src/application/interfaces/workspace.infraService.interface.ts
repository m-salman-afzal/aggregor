import {Context} from "effect";

import type {ProjectEntity} from "@/domain/entities/project/project.entity.ts";
import type {Effect} from "effect";

// The folders open in this window's workspace.
export class IWorkspaceInfraService extends Context.Service<
  IWorkspaceInfraService,
  {readonly listWorkspaceFolderProjects: () => Effect.Effect<readonly ProjectEntity[]>}
>()("aggregor/application/interfaces/workspace.infraService.interface/IWorkspaceInfraService") {}
