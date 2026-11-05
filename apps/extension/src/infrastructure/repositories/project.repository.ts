import {showErrorInBackground} from "@appUtils/error.utils.ts";
import {
  IProjectRepository,
  ProjectsCorruptError,
  ProjectsSaveFailedError
} from "@entities/project/project.repository.interface.ts";
import {findWindowKey} from "@infraUtils/anchorFolder.utils.ts";
import {NO_ADDED_PROJECT_PATHS, StoredAddedProjectPathsModel} from "@models/storedAddedProjectPaths.model.ts";
import {STORAGE_KEYS} from "@pkg/constants/src/extension.constant.ts";
import {PROJECT_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {VsCodeApi} from "@vscodeApi/vscode.api.ts";
import {Effect, Layer, Schema, SubscriptionRef} from "effect";

import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {Memento} from "vscode";

type AddedProjectPathsByWindow = Readonly<Record<string, readonly ProjectPathValueObject[]>>;

type AddedProjectPathsReference = SubscriptionRef.SubscriptionRef<readonly ProjectPathValueObject[]>;

// Where this window's list lives: in globalState, under the window's key.
interface AddedProjectPathsStore {
  readonly globalState: Memento;
  readonly windowKey: string;
}

type ChangeAddedProjectPaths = (
  storedAddedProjectPaths: readonly ProjectPathValueObject[]
) => readonly ProjectPathValueObject[];

// Re-reads globalState on every call. Every window's lists come back, so a write keeps the others.
const loadAddedProjectPaths = Effect.fn("ProjectRepository.loadAddedProjectPaths")(
  function* ({globalState, windowKey}: AddedProjectPathsStore) {
    const storedValue = yield* Effect.sync(() =>
      globalState.get<unknown>(STORAGE_KEYS.ADDED_PROJECT_PATHS, NO_ADDED_PROJECT_PATHS)
    );
    const {addedProjectPathsByWindow} = yield* Schema.decodeUnknownEffect(StoredAddedProjectPathsModel)(storedValue);
    const storedWindowProjectPaths = addedProjectPathsByWindow[windowKey];
    const noProjectPaths: readonly ProjectPathValueObject[] = [];
    const windowProjectPaths = storedWindowProjectPaths === undefined ? noProjectPaths : storedWindowProjectPaths;

    return {addedProjectPathsByWindow, windowProjectPaths};
  },
  Effect.mapError((cause) => ProjectsCorruptError.make({cause}))
);

const saveAddedProjectPaths = Effect.fn("ProjectRepository.saveAddedProjectPaths")(function* (
  globalState: Memento,
  addedProjectPathsByWindow: AddedProjectPathsByWindow
) {
  const storedValue: typeof StoredAddedProjectPathsModel.Encoded = {addedProjectPathsByWindow, version: 1};

  yield* Effect.tryPromise({
    catch: (cause) => ProjectsSaveFailedError.make({cause}),
    try: () => globalState.update(STORAGE_KEYS.ADDED_PROJECT_PATHS, storedValue)
  });
});

const writeAddedProjectPathsChange = Effect.fn("ProjectRepository.writeAddedProjectPathsChange")(function* (
  addedProjectPathsStore: AddedProjectPathsStore,
  changeAddedProjectPaths: ChangeAddedProjectPaths
) {
  const {addedProjectPathsByWindow, windowProjectPaths} = yield* loadAddedProjectPaths(addedProjectPathsStore);
  const nextAddedProjectPaths = changeAddedProjectPaths(windowProjectPaths);
  yield* saveAddedProjectPaths(addedProjectPathsStore.globalState, {
    ...addedProjectPathsByWindow,
    [addedProjectPathsStore.windowKey]: nextAddedProjectPaths
  });

  return nextAddedProjectPaths;
});

// Read-modify-write under the ref's permit. Re-reading first makes unreadable data fail the write, not get overwritten.
const modifyAddedProjectPaths = Effect.fn("ProjectRepository.modifyAddedProjectPaths")(function* (
  addedProjectPathsStore: AddedProjectPathsStore,
  addedProjectPaths: AddedProjectPathsReference,
  changeAddedProjectPaths: ChangeAddedProjectPaths
) {
  yield* SubscriptionRef.updateEffect(addedProjectPaths, () =>
    writeAddedProjectPathsChange(addedProjectPathsStore, changeAddedProjectPaths)
  );
});

const showUnreadableProjectsError = Effect.fn("ProjectRepository.showUnreadableProjectsError")(function* () {
  yield* showErrorInBackground(PROJECT_MESSAGES.UNREADABLE);
  const noProjectPaths: readonly ProjectPathValueObject[] = [];

  return noProjectPaths;
});

// Unreadable data starts the list empty; every write re-reads first, so it is never overwritten.
const loadInitialAddedProjectPaths = Effect.fn("ProjectRepository.loadInitialAddedProjectPaths")(
  function* (addedProjectPathsStore: AddedProjectPathsStore) {
    const {windowProjectPaths} = yield* loadAddedProjectPaths(addedProjectPathsStore);

    return windowProjectPaths;
  },
  Effect.catchTag("ProjectsCorruptError", () => showUnreadableProjectsError())
);

const makeProjectRepository = Effect.fn("ProjectRepository.make")(function* () {
  const {globalState} = yield* VsCodeApi;
  const addedProjectPathsStore: AddedProjectPathsStore = {
    globalState,
    windowKey: yield* findWindowKey()
  };
  const initialAddedProjectPaths = yield* loadInitialAddedProjectPaths(addedProjectPathsStore);
  const addedProjectPaths: AddedProjectPathsReference = yield* SubscriptionRef.make(initialAddedProjectPaths);

  return {
    addedProjectPaths,
    modifyAddedProjectPaths: (changeAddedProjectPaths: ChangeAddedProjectPaths) =>
      modifyAddedProjectPaths(addedProjectPathsStore, addedProjectPaths, changeAddedProjectPaths)
  };
});

// In globalState under the window's key, which stays the same when its anchor folder takes folder 0. workspaceState
// would not: the multi-root workspace a single-folder window turns into starts with an empty one.
export const ProjectRepository = Layer.effect(IProjectRepository, makeProjectRepository());
