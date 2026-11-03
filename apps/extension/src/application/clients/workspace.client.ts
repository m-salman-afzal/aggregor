import {Context} from "effect";

import type {Project} from "@/domain/entities/project/project.entity.ts";
import type {Effect} from "effect";

// The folders open in this window's workspace.
export class WorkspaceClient extends Context.Service<
  WorkspaceClient,
  {readonly listWorkspaceFolderProjects: () => Effect.Effect<readonly Project[]>}
>()("aggregor/application/clients/workspace.client/WorkspaceClient") {}
