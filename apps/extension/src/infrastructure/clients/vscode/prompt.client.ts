import {PromptClient} from "@/application/clients/prompt.client.ts";
import {FolderPickCancelled, RepoPickCancelled} from "@/application/errors/repo.error.ts";
import {RepoPathSchema} from "@/domain/value-objects/repo-path.value-object.ts";
import {VsCodeService} from "@/infrastructure/vscode/vscode.service.ts";
import {APP_NAME} from "@pkg/constants/src/extension.constant.ts";
import {ACTIONS, REPO_LABELS} from "@pkg/constants/src/message.constant.ts";
import {Effect, Layer, Result} from "effect";

import type {Repo} from "@/domain/entities/repo/repo.entity.ts";
import type {window as VsCodeWindow} from "vscode";

type Window = typeof VsCodeWindow;

const showErrorMessage = Effect.fn("PromptClient.showErrorMessage")(function* (
  window: Window,
  message: string,
  actions: readonly string[]
) {
  return yield* Effect.promise(async () => window.showErrorMessage(`${APP_NAME}: ${message}`, ...actions));
});

const confirm = Effect.fn("PromptClient.confirm")(function* (window: Window, message: string, confirmAction: string) {
  const pickedAction = yield* Effect.promise(async () =>
    window.showWarningMessage(message, {modal: true}, confirmAction)
  );

  return pickedAction === confirmAction;
});

const pickRepo = Effect.fn("PromptClient.pickRepo")(function* (window: Window, repos: readonly Repo[]) {
  const pickedItem = yield* Effect.promise(async () =>
    window.showQuickPick(
      repos.map((repo) => ({description: repo.path, label: repo.name, repo})),
      {placeHolder: REPO_LABELS.PICK}
    )
  );
  const {repo: pickedRepo} = yield* Effect.fromResult(Result.fromNullishOr(pickedItem, () => new RepoPickCancelled()));

  return pickedRepo;
});

const pickRepoFolderPaths = Effect.fn("PromptClient.pickRepoFolderPaths")(function* (window: Window) {
  const pickedFolderUris = yield* Effect.promise(async () =>
    window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: true,
      openLabel: ACTIONS.ADD_REPO
    })
  );
  const confirmedFolderUris = yield* Effect.fromResult(
    Result.fromNullishOr(pickedFolderUris, () => new FolderPickCancelled())
  );

  return confirmedFolderUris.map((folderUri) => RepoPathSchema.make(folderUri.fsPath));
});

const makePromptClientOnVsCode = Effect.fn("PromptClient.make")(function* () {
  const {window} = yield* VsCodeService;

  return {
    confirm: (message: string, confirmAction: string) => confirm(window, message, confirmAction),
    pickRepo: (repos: readonly Repo[]) => pickRepo(window, repos),
    pickRepoFolderPaths: () => pickRepoFolderPaths(window),
    showErrorMessage: (message: string, ...actions: string[]) => showErrorMessage(window, message, actions)
  };
});

export const PromptClientOnVsCode = Layer.effect(PromptClient, makePromptClientOnVsCode());
