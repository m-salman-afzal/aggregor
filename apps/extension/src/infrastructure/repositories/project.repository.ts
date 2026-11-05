import {showErrorInBackground} from "@appUtils/error.utils.ts";
import {
  IProjectRepository,
  ProjectsCorruptError,
  ProjectsSaveFailedError
} from "@entities/project/project.repository.interface.ts";
import {NO_ADDED_PROJECT_PATHS, StoredAddedProjectPathsModel} from "@models/storedAddedProjectPaths.model.ts";
import {STORAGE_KEYS} from "@pkg/constants/src/extension.constant.ts";
import {PROJECT_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {VsCodeApi} from "@vscodeApi/vscode.api.ts";
import {Effect, Layer, Schema, SubscriptionRef} from "effect";

import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {Memento} from "vscode";

type AddedProjectPathsReference = SubscriptionRef.SubscriptionRef<readonly ProjectPathValueObject[]>;

type ChangeAddedProjectPaths = (
  storedAddedProjectPaths: readonly ProjectPathValueObject[]
) => readonly ProjectPathValueObject[];

// Re-reads workspaceState on every call.
const loadAddedProjectPaths = Effect.fn("ProjectRepository.loadAddedProjectPaths")(
  function* (workspaceState: Memento) {
    const storedValue = yield* Effect.sync(() =>
      workspaceState.get<unknown>(STORAGE_KEYS.ADDED_PROJECT_PATHS, NO_ADDED_PROJECT_PATHS)
    );
    const storedAddedProjectPaths = yield* Schema.decodeUnknownEffect(StoredAddedProjectPathsModel)(storedValue);

    return storedAddedProjectPaths.addedProjectPaths;
  },
  Effect.mapError((cause) => new ProjectsCorruptError({cause}))
);

const saveAddedProjectPaths = Effect.fn("ProjectRepository.saveAddedProjectPaths")(function* (
  workspaceState: Memento,
  addedProjectPaths: readonly ProjectPathValueObject[]
) {
  const storedValue: typeof StoredAddedProjectPathsModel.Encoded = {addedProjectPaths, version: 1};

  yield* Effect.tryPromise({
    catch: (cause) => new ProjectsSaveFailedError({cause}),
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
  const noProjectPaths: readonly ProjectPathValueObject[] = [];

  return noProjectPaths;
});

// Unreadable data starts the list empty; every write re-reads first, so it is never overwritten.
const loadInitialAddedProjectPaths = Effect.fn("ProjectRepository.loadInitialAddedProjectPaths")(
  function* (workspaceState: Memento) {
    return yield* loadAddedProjectPaths(workspaceState);
  },
  Effect.catchTag("ProjectsCorruptError", () => showUnreadableProjectsError())
);

const makeProjectRepository = Effect.fn("ProjectRepository.make")(function* () {
  const {workspaceState} = yield* VsCodeApi;
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
export const ProjectRepository = Layer.effect(IProjectRepository, makeProjectRepository());
