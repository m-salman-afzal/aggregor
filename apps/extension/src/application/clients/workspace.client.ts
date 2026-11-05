import {Context} from "effect";

import type {Repo} from "@/domain/entities/repo/repo.entity.ts";
import type {Effect} from "effect";

// The folders open in this window's workspace.
export class WorkspaceClient extends Context.Service<
  WorkspaceClient,
  {readonly listWorkspaceFolderRepos: () => Effect.Effect<readonly Repo[]>}
>()("aggregor/application/clients/workspace.client/WorkspaceClient") {}
