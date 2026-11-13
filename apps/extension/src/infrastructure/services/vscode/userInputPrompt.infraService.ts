import {
  AgentPickCancelledError,
  FolderPickCancelledError,
  InputCancelledError,
  IUserInputPromptInfraService,
  ProjectPickCancelledError,
  QuestionCancelledError
} from "@interfaces/userInputPrompt.infraService.interface.ts";
import {AGENT_LABELS, AGENT_PICK_TAGS} from "@pkg/constants/src/agent.constant.ts";
import {APP_NAME} from "@pkg/constants/src/app.constant.ts";
import {PROJECT_LABELS} from "@pkg/constants/src/project.constant.ts";
import {
  PROMPT_ACTION_ICONS,
  PROMPT_ANSWER_TAGS,
  PROMPT_TAGS,
  SESSIONS_VIEW
} from "@pkg/constants/src/sessionsView.constant.ts";
import {ViewPromptAnswerSchema} from "@pkg/vscode/src/viewPrompt.schema.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {Array, Effect, Layer, Match, Result, Schema} from "effect";

import type {AgentListItemDto} from "@dtos/agent.dto.ts";
import type {ProjectListItemDto} from "@dtos/project.dto.ts";
import type {AgentPick, QuestionRequest} from "@interfaces/userInputPrompt.infraService.interface.ts";
import type {ViewPrompt, ViewPromptAnswer, ViewPromptChoice} from "@pkg/vscode/src/viewPrompt.type.ts";
import type {commands as VsCodeCommands, window as VsCodeWindow} from "vscode";

type Window = typeof VsCodeWindow;

type Commands = typeof VsCodeCommands;

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

const showPromptInSessionsView = Effect.fn("UserInputPromptInfraService.showPromptInSessionsView")(function* (
  commands: Commands,
  viewPrompt: ViewPrompt
) {
  const promptAnswer = yield* Effect.promise(() =>
    commands.executeCommand(SESSIONS_VIEW.SHOW_PROMPT_COMMAND, viewPrompt)
  );

  return yield* Effect.orElseSucceed(
    Schema.decodeUnknownEffect(ViewPromptAnswerSchema)(promptAnswer),
    (): ViewPromptAnswer => ({_tag: PROMPT_ANSWER_TAGS.CANCELLED})
  );
});

const findChosenChoice = Effect.fn("UserInputPromptInfraService.findChosenChoice")(function* <CancelError>(
  promptAnswer: ViewPromptAnswer,
  makeCancelError: () => CancelError
) {
  return yield* Match.valueTags(promptAnswer, {
    [PROMPT_ANSWER_TAGS.CANCELLED]: () => Effect.fail(makeCancelError()),
    [PROMPT_ANSWER_TAGS.CHOSEN]: (chosenChoice) => Effect.succeed(chosenChoice),
    [PROMPT_ANSWER_TAGS.TEXT_ENTERED]: () => Effect.fail(makeCancelError())
  });
});

const askQuestion = Effect.fn("UserInputPromptInfraService.askQuestion")(function* (
  commands: Commands,
  questionRequest: QuestionRequest
) {
  const promptAnswer = yield* showPromptInSessionsView(commands, {
    _tag: PROMPT_TAGS.QUESTION,
    answers: Array.map(questionRequest.answers, (answer) => ({
      answerId: answer.label,
      consequence: answer.consequence,
      isDestructive: answer.isDestructive,
      label: answer.label
    })),
    title: questionRequest.question
  });
  const chosenChoice = yield* findChosenChoice(promptAnswer, () => QuestionCancelledError.make());

  return chosenChoice.choiceId;
});

const askForText = Effect.fn("UserInputPromptInfraService.askForText")(function* (
  commands: Commands,
  question: string,
  value: string
) {
  const promptAnswer = yield* showPromptInSessionsView(commands, {_tag: PROMPT_TAGS.TEXT, title: question, value});

  return yield* Match.valueTags(promptAnswer, {
    [PROMPT_ANSWER_TAGS.CANCELLED]: () => Effect.fail(InputCancelledError.make()),
    [PROMPT_ANSWER_TAGS.CHOSEN]: () => Effect.fail(InputCancelledError.make()),
    [PROMPT_ANSWER_TAGS.TEXT_ENTERED]: (enteredText) => Effect.succeed(enteredText.text)
  });
});

const pickProject = Effect.fn("UserInputPromptInfraService.pickProject")(function* (
  commands: Commands,
  projects: readonly ProjectListItemDto[],
  placeHolder: string
) {
  const promptAnswer = yield* showPromptInSessionsView(commands, {
    _tag: PROMPT_TAGS.CHOICE,
    choices: Array.map(projects, (project) => ({
      choiceId: project.path,
      description: project.path,
      label: project.name
    })),
    title: placeHolder
  });
  const chosenChoice = yield* findChosenChoice(promptAnswer, () => ProjectPickCancelledError.make());

  return yield* Effect.fromResult(
    Result.fromOption(
      Array.findFirst(projects, (project) => project.path === chosenChoice.choiceId),
      () => ProjectPickCancelledError.make()
    )
  );
});

const toAgentChoice = Effect.fn("UserInputPromptInfraService.toAgentChoice")(function* (
  agentListItem: AgentListItemDto
) {
  const agentChoice: ViewPromptChoice = {
    choiceId: agentListItem.agentId,
    description: agentListItem.command,
    iconPath: agentListItem.icon,
    label: agentListItem.name,
    ...(agentListItem.isDefault
      ? {badge: AGENT_LABELS.DEFAULT}
      : {secondaryActionIcon: PROMPT_ACTION_ICONS.STAR, secondaryActionLabel: AGENT_LABELS.SET_AS_DEFAULT})
  };

  return agentChoice;
});

const pickAgent = Effect.fn("UserInputPromptInfraService.pickAgent")(function* (
  commands: Commands,
  agentListItems: readonly AgentListItemDto[],
  placeHolder: string
) {
  const promptAnswer = yield* showPromptInSessionsView(commands, {
    _tag: PROMPT_TAGS.CHOICE,
    choices: yield* Effect.forEach(agentListItems, (agentListItem) => toAgentChoice(agentListItem)),
    title: placeHolder
  });
  const chosenChoice = yield* findChosenChoice(promptAnswer, () => AgentPickCancelledError.make());
  const pickedAgent = yield* Effect.fromResult(
    Result.fromOption(
      Array.findFirst(agentListItems, (agentListItem) => agentListItem.agentId === chosenChoice.choiceId),
      () => AgentPickCancelledError.make()
    )
  );
  const agentPick: AgentPick = chosenChoice.isSecondaryAction
    ? {_tag: AGENT_PICK_TAGS.DEFAULT_AGENT_CHOSEN, agentId: pickedAgent.agentId}
    : {_tag: AGENT_PICK_TAGS.AGENT_PICKED, agentId: pickedAgent.agentId};

  return agentPick;
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
  const vsCodeApi = yield* VsCodeApi;

  return {
    askForText: (question: string, value: string) => askForText(vsCodeApi.commands, question, value),
    askQuestion: (questionRequest: QuestionRequest) => askQuestion(vsCodeApi.commands, questionRequest),
    pickAgent: (agentListItems: readonly AgentListItemDto[], placeHolder: string) =>
      pickAgent(vsCodeApi.commands, agentListItems, placeHolder),
    pickProject: (projects: readonly ProjectListItemDto[], placeHolder: string) =>
      pickProject(vsCodeApi.commands, projects, placeHolder),
    pickProjectFolderPaths: pickProjectFolderPaths(vsCodeApi.window),
    showErrorMessage: (message: string, ...actions: string[]) => showErrorMessage(vsCodeApi.window, message, actions),
    showInformationMessage: (message: string, ...actions: string[]) =>
      showInformationMessage(vsCodeApi.window, message, actions)
  };
});

export const UserInputPromptInfraService = Layer.effect(
  IUserInputPromptInfraService,
  makeUserInputPromptInfraService()
);
