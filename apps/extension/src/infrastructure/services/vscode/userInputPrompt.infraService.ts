import {
  AgentPickCancelledError,
  FolderPickCancelledError,
  InputCancelledError,
  IUserInputPromptInfraService,
  ProjectPickCancelledError
} from "@interfaces/userInputPrompt.infraService.interface.ts";
import {AGENT_LABELS} from "@pkg/constants/src/agent.constant.ts";
import {APP_NAME} from "@pkg/constants/src/app.constant.ts";
import {PROJECT_LABELS} from "@pkg/constants/src/project.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {Array, Effect, Layer, Result} from "effect";

import type {AgentListItemDto} from "@dtos/agent.dto.ts";
import type {ProjectListItemDto} from "@dtos/project.dto.ts";
import type {AgentPick} from "@interfaces/userInputPrompt.infraService.interface.ts";
import type {AgentIdValueObject} from "@valueObjects/agentId.valueObject.ts";
import type {QuickInputButton, QuickPickItem, window as VsCodeWindow} from "vscode";

// What the agent picker draws with.
type AgentPickerDependencies = Pick<VsCodeApi["Service"], "ThemeIcon" | "Uri" | "window">;

// An agent's row in the picker, with the agent it stands for.
interface AgentQuickPickItem extends QuickPickItem {
  readonly agentId: AgentIdValueObject;
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
const toAgentQuickPickItem = Effect.fn("UserInputPromptInfraService.toAgentQuickPickItem")(function* (
  {Uri}: AgentPickerDependencies,
  setAsDefaultButton: QuickInputButton,
  agentListItem: AgentListItemDto
) {
  const agentQuickPickItem: AgentQuickPickItem = {
    agentId: agentListItem.agentId,
    buttons: agentListItem.isDefault ? [] : [setAsDefaultButton],
    description: agentListItem.isDefault ? `${agentListItem.command} · ${AGENT_LABELS.DEFAULT}` : agentListItem.command,
    iconPath: Uri.file(agentListItem.icon),
    label: agentListItem.name
  };

  return agentQuickPickItem;
});

// Accepting a row picks its agent; its button asks for it to become the default; closing the picker cancels.
const showAgentQuickPick = Effect.fn("UserInputPromptInfraService.showAgentQuickPick")(function* (
  window: Window,
  agentQuickPickItems: readonly AgentQuickPickItem[],
  placeHolder: string
) {
  return yield* Effect.callback<AgentPick, AgentPickCancelledError>((resume) => {
    const agentQuickPick = window.createQuickPick<AgentQuickPickItem>();
    agentQuickPick.items = agentQuickPickItems;
    agentQuickPick.activeItems = agentQuickPickItems.slice(0, 1);
    agentQuickPick.placeholder = placeHolder;
    const listeners = [
      agentQuickPick.onDidAccept(() => {
        const [pickedItem] = agentQuickPick.selectedItems;
        if (pickedItem !== undefined) resume(Effect.succeed({_tag: "AgentPicked", agentId: pickedItem.agentId}));
      }),
      agentQuickPick.onDidTriggerItemButton(({item}) => {
        resume(Effect.succeed({_tag: "DefaultAgentChosen", agentId: item.agentId}));
      }),
      agentQuickPick.onDidHide(() => {
        resume(Effect.fail(AgentPickCancelledError.make()));
      })
    ];
    agentQuickPick.show();

    return Effect.sync(() => {
      for (const listener of listeners) listener.dispose();
      agentQuickPick.dispose();
    });
  });
});

const pickAgent = Effect.fn("UserInputPromptInfraService.pickAgent")(function* (
  agentPickerDependencies: AgentPickerDependencies,
  agentListItems: readonly AgentListItemDto[],
  placeHolder: string
) {
  const {ThemeIcon, window} = agentPickerDependencies;
  const setAsDefaultButton: QuickInputButton = {
    iconPath: new ThemeIcon("star-empty"),
    tooltip: AGENT_LABELS.SET_AS_DEFAULT
  };
  const agentQuickPickItems = yield* Effect.forEach(agentListItems, (agentListItem) =>
    toAgentQuickPickItem(agentPickerDependencies, setAsDefaultButton, agentListItem)
  );

  return yield* showAgentQuickPick(window, agentQuickPickItems, placeHolder);
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
    pickAgent: (agentListItems: readonly AgentListItemDto[], placeHolder: string) =>
      pickAgent({ThemeIcon, Uri, window}, agentListItems, placeHolder),
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
