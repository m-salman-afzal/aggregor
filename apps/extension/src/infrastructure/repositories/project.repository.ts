import {showErrorInBackground} from "@/application/utils/error.utils.ts";
import {ProjectRepository} from "@/domain/entities/project/project.repository.ts";
import {ProjectsCorrupt, ProjectsSaveFailed} from "@/domain/errors/project.error.ts";
import {
  NO_ADDED_PROJECT_PATHS,
  StoredAddedProjectPaths
} from "@/infrastructure/database/models/stored-added-project-paths.model.ts";
import {VsCodeService} from "@/infrastructure/vscode/vscode.service.ts";
import {STORAGE_KEYS} from "@pkg/constants/src/extension.constant.ts";
import {PROJECT_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {Effect, Layer, Schema, SubscriptionRef} from "effect";

import type {ProjectPath} from "@/domain/value-objects/project-path.value-object.ts";
import type {Memento} from "vscode";

type AddedProjectPathsReference = SubscriptionRef.SubscriptionRef<readonly ProjectPath[]>;

type ChangeAddedProjectPaths = (storedAddedProjectPaths: readonly ProjectPath[]) => readonly ProjectPath[];

// Re-reads workspaceState on every call.
const loadAddedProjectPaths = Effect.fn("ProjectRepository.loadAddedProjectPaths")(
  function* (workspaceState: Memento) {
    const storedValue = yield* Effect.sync(() =>
      workspaceState.get<unknown>(STORAGE_KEYS.ADDED_PROJECT_PATHS, NO_ADDED_PROJECT_PATHS)
    );
    const storedAddedProjectPaths = yield* Schema.decodeUnknownEffect(StoredAddedProjectPaths)(storedValue);

    return storedAddedProjectPaths.addedProjectPaths;
  },
  Effect.mapError((cause) => new ProjectsCorrupt({cause}))
);

const saveAddedProjectPaths = Effect.fn("ProjectRepository.saveAddedProjectPaths")(function* (
  workspaceState: Memento,
  addedProjectPaths: readonly ProjectPath[]
) {
  const storedValue: typeof StoredAddedProjectPaths.Encoded = {addedProjectPaths, version: 1};

  yield* Effect.tryPromise({
    catch: (cause) => new ProjectsSaveFailed({cause}),
    try: async () => workspaceState.update(STORAGE_KEYS.ADDED_PROJECT_PATHS, storedValue)
  });
});

const writeAddedProjectPathsChange = Effect.fn("ProjectRepository.writeAddedProjectPathsChange")(function* (
  workspaceState: Memento,
  changeAddedProjectPaths: ChangeAddedProjectPaths
) {
  const nextAddedProjectPaths = changeAddedProjectPaths(yield* loadAddedProjectPaths(workspaceState));
  yield* saveAddedProjectPaths(workspaceState, nextAddedProjectPaths);

  return nextAddedProjectPaths;
});

// Read-modify-write under the ref's permit. Re-reading first makes unreadable data fail the write, not get overwritten.
const modifyAddedProjectPaths = Effect.fn("ProjectRepository.modifyAddedProjectPaths")(function* (
  workspaceState: Memento,
  addedProjectPaths: AddedProjectPathsReference,
  changeAddedProjectPaths: ChangeAddedProjectPaths
) {
  yield* SubscriptionRef.updateEffect(addedProjectPaths, () =>
    writeAddedProjectPathsChange(workspaceState, changeAddedProjectPaths)
  );
});

const showUnreadableProjectsError = Effect.fn("ProjectRepository.showUnreadableProjectsError")(function* () {
  yield* showErrorInBackground(PROJECT_MESSAGES.UNREADABLE);
  const noProjectPaths: readonly ProjectPath[] = [];

  return noProjectPaths;
});

// Unreadable data starts the list empty; every write re-reads first, so it is never overwritten.
const loadInitialAddedProjectPaths = Effect.fn("ProjectRepository.loadInitialAddedProjectPaths")(
  function* (workspaceState: Memento) {
    return yield* loadAddedProjectPaths(workspaceState);
  },
  Effect.catchTag("ProjectsCorrupt", () => showUnreadableProjectsError())
);

const makeProjectRepositoryOnWorkspaceState = Effect.fn("ProjectRepository.make")(function* () {
  const {workspaceState} = yield* VsCodeService;
  const addedProjectPaths: AddedProjectPathsReference = yield* SubscriptionRef.make(
    yield* loadInitialAddedProjectPaths(workspaceState)
  );

  return {
    addedProjectPaths,
    modifyAddedProjectPaths: (changeAddedProjectPaths: ChangeAddedProjectPaths) =>
      modifyAddedProjectPaths(workspaceState, addedProjectPaths, changeAddedProjectPaths)
  };
});

// workspaceState belongs to this workspace, so other windows never see these paths.
export const ProjectRepositoryOnWorkspaceState = Layer.effect(
  ProjectRepository,
  makeProjectRepositoryOnWorkspaceState()
);
