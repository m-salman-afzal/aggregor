import {WorkspaceClient} from "@/application/clients/workspace.client.ts";
import {Project} from "@/domain/entities/project/project.entity.ts";
import {ProjectPathSchema} from "@/domain/value-objects/project-path.value-object.ts";
import {VsCodeService} from "@/infrastructure/vscode/vscode.service.ts";
import {Effect, Layer, UndefinedOr} from "effect";

import type {workspace as VsCodeWorkspace} from "vscode";

const listWorkspaceFolderProjects = Effect.fn("WorkspaceClient.listWorkspaceFolderProjects")(function* (
  workspace: typeof VsCodeWorkspace
) {
  return yield* Effect.sync(() =>
    UndefinedOr.match(workspace.workspaceFolders, {
      onDefined: (workspaceFolders) =>
        workspaceFolders.map(
          (workspaceFolder) =>
            new Project({
              added: false,
              name: workspaceFolder.name,
              path: ProjectPathSchema.make(workspaceFolder.uri.fsPath)
            })
        ),
      onUndefined: (): readonly Project[] => []
    })
  );
});

const makeWorkspaceClientOnVsCode = Effect.fn("WorkspaceClient.make")(function* () {
  const {workspace} = yield* VsCodeService;

  return {listWorkspaceFolderProjects: () => listWorkspaceFolderProjects(workspace)};
});

export const WorkspaceClientOnVsCode = Layer.effect(WorkspaceClient, makeWorkspaceClientOnVsCode());
