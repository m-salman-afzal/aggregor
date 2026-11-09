import {
  FolderPickCancelledError,
  HarnessPickCancelledError,
  InputCancelledError,
  IUserInputPromptInfraService,
  ProjectPickCancelledError
} from "@interfaces/userInputPrompt.infraService.interface.ts";
import {APP_NAME} from "@pkg/constants/src/app.constant.ts";
import {HARNESS_LABELS} from "@pkg/constants/src/harness.constant.ts";
import {PROJECT_LABELS} from "@pkg/constants/src/project.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {Array, Effect, Layer, Match, Result} from "effect";

import type {HarnessListItemDto} from "@dtos/harness.dto.ts";
import type {ProjectListItemDto} from "@dtos/project.dto.ts";
import type {HarnessPick} from "@interfaces/userInputPrompt.infraService.interface.ts";
import type {HarnessIdValueObject} from "@valueObjects/harnessId.valueObject.ts";
import type {QuickInputButton, QuickPickItem, window as VsCodeWindow} from "vscode";

// What the harness picker draws with.
type HarnessPickerDependencies = Pick<VsCodeApi["Service"], "ThemeIcon" | "Uri" | "window">;

// A harness's row in the picker, with the harness it stands for.
interface HarnessQuickPickItem extends QuickPickItem {
  readonly harnessId: HarnessIdValueObject;
}

type Window = typeof VsCodeWindow;

const showErrorMessage = Effect.fn("UserInputPromptInfraService.showErrorMessage")(function* (
  window: Window,
  message: string,
  actions: readonly string[]
) {
  return yield* Effect.promise(() => window.showErrorMessage(`${APP_NAME}: ${message}`, ...actions));
});

const showInformationMessage = Effect.fn("UserInputPromptInfraService.showInformationMessage")(function* (
  window: Window,
  message: string,
  actions: readonly string[]
) {
  return yield* Effect.promise(() => window.showInformationMessage(`${APP_NAME}: ${message}`, ...actions));
});

const confirm = Effect.fn("UserInputPromptInfraService.confirm")(function* (
  window: Window,
  message: string,
  confirmAction: string
) {
  const pickedAction = yield* Effect.promise(() => window.showWarningMessage(message, {modal: true}, confirmAction));

  return pickedAction === confirmAction;
});

const askForText = Effect.fn("UserInputPromptInfraService.askForText")(function* (
  window: Window,
  question: string,
  value: string
) {
  const enteredText = yield* Effect.promise(() => window.showInputBox({prompt: question, value}));

  return yield* Effect.fromResult(Result.fromNullishOr(enteredText, () => InputCancelledError.make()));
});

const pickProject = Effect.fn("UserInputPromptInfraService.pickProject")(function* (
  window: Window,
  projects: readonly ProjectListItemDto[],
  placeHolder: string
) {
  const pickedItem = yield* Effect.promise(() =>
    window.showQuickPick(
      Array.map(projects, (project) => ({description: project.path, label: project.name, project})),
      {placeHolder}
    )
  );
  const {project: pickedProject} = yield* Effect.fromResult(
    Result.fromNullishOr(pickedItem, () => ProjectPickCancelledError.make())
  );

  return pickedProject;
});

// The default's row says so and has no button; every other row offers to become the default.
const toHarnessQuickPickItem = Effect.fn("UserInputPromptInfraService.toHarnessQuickPickItem")(function* (
  {ThemeIcon, Uri}: HarnessPickerDependencies,
  setAsDefaultButton: QuickInputButton,
  harnessListItem: HarnessListItemDto
) {
  const harnessQuickPickItem: HarnessQuickPickItem = {
    buttons: harnessListItem.isDefault ? [] : [setAsDefaultButton],
    description: harnessListItem.isDefault
      ? `${harnessListItem.command} · ${HARNESS_LABELS.DEFAULT}`
      : harnessListItem.command,
    harnessId: harnessListItem.harnessId,
    iconPath: Match.valueTags(harnessListItem.icon, {
      CodiconIcon: ({codiconId}) => new ThemeIcon(codiconId),
      FileIcon: ({filePath}) => Uri.file(filePath)
    }),
    label: harnessListItem.name
  };

  return harnessQuickPickItem;
});

// Accepting a row picks its harness; its button asks for it to become the default; closing the picker cancels.
const showHarnessQuickPick = Effect.fn("UserInputPromptInfraService.showHarnessQuickPick")(function* (
  window: Window,
  harnessQuickPickItems: readonly HarnessQuickPickItem[],
  placeHolder: string
) {
  return yield* Effect.callback<HarnessPick, HarnessPickCancelledError>((resume) => {
    const harnessQuickPick = window.createQuickPick<HarnessQuickPickItem>();
    harnessQuickPick.items = harnessQuickPickItems;
    harnessQuickPick.activeItems = harnessQuickPickItems.slice(0, 1);
    harnessQuickPick.placeholder = placeHolder;
    const listeners = [
      harnessQuickPick.onDidAccept(() => {
        const [pickedItem] = harnessQuickPick.selectedItems;
        if (pickedItem !== undefined) resume(Effect.succeed({_tag: "HarnessPicked", harnessId: pickedItem.harnessId}));
      }),
      harnessQuickPick.onDidTriggerItemButton(({item}) => {
        resume(Effect.succeed({_tag: "DefaultHarnessChosen", harnessId: item.harnessId}));
      }),
      harnessQuickPick.onDidHide(() => {
        resume(Effect.fail(HarnessPickCancelledError.make()));
      })
    ];
    harnessQuickPick.show();

    return Effect.sync(() => {
      for (const listener of listeners) listener.dispose();
      harnessQuickPick.dispose();
    });
  });
});

const pickHarness = Effect.fn("UserInputPromptInfraService.pickHarness")(function* (
  harnessPickerDependencies: HarnessPickerDependencies,
  harnessListItems: readonly HarnessListItemDto[],
  placeHolder: string
) {
  const {ThemeIcon, window} = harnessPickerDependencies;
  const setAsDefaultButton: QuickInputButton = {
    iconPath: new ThemeIcon("star-empty"),
    tooltip: HARNESS_LABELS.SET_AS_DEFAULT
  };
  const harnessQuickPickItems = yield* Effect.forEach(harnessListItems, (harnessListItem) =>
    toHarnessQuickPickItem(harnessPickerDependencies, setAsDefaultButton, harnessListItem)
  );

  return yield* showHarnessQuickPick(window, harnessQuickPickItems, placeHolder);
});

const pickProjectFolderPaths = Effect.fn("UserInputPromptInfraService.pickProjectFolderPaths")(function* (
  window: Window
) {
  const pickedFolderUris = yield* Effect.promise(() =>
    window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: true,
      openLabel: PROJECT_LABELS.ADD_FOLDERS
    })
  );
  const confirmedFolderUris = yield* Effect.fromResult(
    Result.fromNullishOr(pickedFolderUris, () => FolderPickCancelledError.make())
  );

  return Array.map(confirmedFolderUris, (folderUri) => ProjectPathValueObjectSchema.make(folderUri.fsPath));
});

const makeUserInputPromptInfraService = Effect.fn("UserInputPromptInfraService.make")(function* () {
  const {ThemeIcon, Uri, window} = yield* VsCodeApi;

  return {
    askForText: (question: string, value: string) => askForText(window, question, value),
    confirm: (message: string, confirmAction: string) => confirm(window, message, confirmAction),
    pickHarness: (harnessListItems: readonly HarnessListItemDto[], placeHolder: string) =>
      pickHarness({ThemeIcon, Uri, window}, harnessListItems, placeHolder),
    pickProject: (projects: readonly ProjectListItemDto[], placeHolder: string) =>
      pickProject(window, projects, placeHolder),
    pickProjectFolderPaths: pickProjectFolderPaths(window),
    showErrorMessage: (message: string, ...actions: string[]) => showErrorMessage(window, message, actions),
    showInformationMessage: (message: string, ...actions: string[]) => showInformationMessage(window, message, actions)
  };
});

export const UserInputPromptInfraService = Layer.effect(
  IUserInputPromptInfraService,
  makeUserInputPromptInfraService()
);
