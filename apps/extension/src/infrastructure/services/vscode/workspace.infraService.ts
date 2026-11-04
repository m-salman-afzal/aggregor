import {IWorkspaceInfraService} from "@/application/interfaces/workspace/workspace.infraService.interface.ts";
import {ProjectEntity} from "@/domain/entities/project/project.entity.ts";
import {ProjectPathValueObjectSchema} from "@/domain/valueObjects/projectPath.valueObject.ts";
import {VsCodeApi} from "@/infrastructure/vscode/vscode.api.ts";
import {Effect, Layer, UndefinedOr} from "effect";

import type {workspace as VsCodeWorkspace} from "vscode";

const listWorkspaceFolderProjects = Effect.fn("WorkspaceInfraService.listWorkspaceFolderProjects")(function* (
  workspace: typeof VsCodeWorkspace
) {
  return yield* Effect.sync(() =>
    UndefinedOr.match(workspace.workspaceFolders, {
      onDefined: (workspaceFolders) =>
        workspaceFolders.map(
          (workspaceFolder) =>
            new ProjectEntity({
              added: false,
              name: workspaceFolder.name,
              path: ProjectPathValueObjectSchema.make(workspaceFolder.uri.fsPath)
            })
        ),
      onUndefined: (): readonly ProjectEntity[] => []
    })
  );
});

const makeWorkspaceInfraService = Effect.fn("WorkspaceInfraService.make")(function* () {
  const {workspace} = yield* VsCodeApi;

  return {listWorkspaceFolderProjects: () => listWorkspaceFolderProjects(workspace)};
});

export const WorkspaceInfraService = Layer.effect(IWorkspaceInfraService, makeWorkspaceInfraService());
