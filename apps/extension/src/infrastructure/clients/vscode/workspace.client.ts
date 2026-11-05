import {WorkspaceClient} from "@/application/clients/workspace.client.ts";
import {Repo} from "@/domain/entities/repo/repo.entity.ts";
import {RepoPathSchema} from "@/domain/value-objects/repo-path.value-object.ts";
import {VsCodeService} from "@/infrastructure/vscode/vscode.service.ts";
import {Effect, Layer, UndefinedOr} from "effect";

import type {workspace as VsCodeWorkspace} from "vscode";

const listWorkspaceFolderRepos = Effect.fn("WorkspaceClient.listWorkspaceFolderRepos")(function* (
  workspace: typeof VsCodeWorkspace
) {
  return yield* Effect.sync(() =>
    UndefinedOr.match(workspace.workspaceFolders, {
      onDefined: (workspaceFolders) =>
        workspaceFolders.map(
          (workspaceFolder) =>
            new Repo({added: false, name: workspaceFolder.name, path: RepoPathSchema.make(workspaceFolder.uri.fsPath)})
        ),
      onUndefined: (): readonly Repo[] => []
    })
  );
});

const makeWorkspaceClientOnVsCode = Effect.fn("WorkspaceClient.make")(function* () {
  const {workspace} = yield* VsCodeService;

  return {listWorkspaceFolderRepos: () => listWorkspaceFolderRepos(workspace)};
});

export const WorkspaceClientOnVsCode = Layer.effect(WorkspaceClient, makeWorkspaceClientOnVsCode());
