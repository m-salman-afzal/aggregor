import {TURN_RUNNING_STATUSES} from "@/modules/sessions/components/sessionList/components/rowActions/rowActions.constant.ts";
import {
  findDefaultWorkingTree,
  isAgentChoiceShown,
  makeNewSessionRequest
} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/newSessionInput.utils.ts";
import {USER_INPUT_TAGS} from "@/modules/sessions/sessions.constant.ts";
import {runCommandOnHost} from "@/modules/sessions/sessions.service.ts";
import {PROJECT_COMMANDS, PROJECT_SETTINGS_LABELS} from "@pkg/constants/src/project.constant.ts";
import {SESSION_COMMANDS, SESSION_LABELS, SESSION_NOTICES} from "@pkg/constants/src/session.constant.ts";

import type {
  AskingAction,
  AskingContext,
  MenuGroup
} from "@/modules/sessions/components/sessionList/components/rowActions/rowActions.type.ts";
import type {RowAction} from "@/modules/sessions/sessions.type.ts";
import type {CommandRequest, ProjectRowData, RowCommandArgument} from "@views/sessions/sessions.view.type.ts";

const findSharedRowLabel = (actionGroup: readonly RowAction[]) => {
  const [firstAction] = actionGroup;
  if (firstAction === undefined) return undefined;

  return actionGroup.every((rowAction) => rowAction.sharedRowLabel === firstAction.sharedRowLabel)
    ? firstAction.sharedRowLabel
    : undefined;
};

export const toMenuGroups = (actionGroups: readonly (readonly RowAction[])[]): readonly MenuGroup[] =>
  actionGroups.map((actionGroup) => ({
    groupKey: actionGroup.map((rowAction) => rowAction.commandId).join(" "),
    rowActions: actionGroup,
    sharedRowLabel: findSharedRowLabel(actionGroup)
  }));

const findSessionListItem = (askingContext: AskingContext, sessionId: string | undefined) =>
  [...askingContext.projectRows, ...askingContext.archiveProjectRows]
    .flatMap((projectRow) => projectRow.sessionRows)
    .map((sessionRow) => sessionRow.sessionListItem)
    .find((sessionListItem) => sessionListItem.sessionId === sessionId);

const listSessionListItems = (projectRows: readonly ProjectRowData[], projectPath?: string) =>
  projectRows
    .filter((projectRow) => projectPath === undefined || projectRow.projectListItem.path === projectPath)
    .flatMap((projectRow) => projectRow.sessionRows.map((sessionRow) => sessionRow.sessionListItem));

const listStoppedSessionListItems = (
  askingContext: AskingContext,
  commandId: RowAction["commandId"],
  commandArgument: RowCommandArgument
) => {
  if (commandId === SESSION_COMMANDS.STOP_AGENT) {
    const sessionListItem = findSessionListItem(askingContext, commandArgument.sessionId);

    return sessionListItem === undefined ? [] : [sessionListItem];
  }
  if (commandId === SESSION_COMMANDS.STOP_PROJECT_AGENTS)
    return listSessionListItems(askingContext.projectRows, commandArgument.projectPath);
  if (commandId === SESSION_COMMANDS.STOP_ARCHIVED_PROJECT_AGENTS)
    return listSessionListItems(askingContext.archiveProjectRows, commandArgument.projectPath);
  if (commandId === SESSION_COMMANDS.STOP_ONGOING_AGENTS) return listSessionListItems(askingContext.projectRows);

  return listSessionListItems(askingContext.archiveProjectRows);
};

const makeStopAgentsQuestion = (runningAgentNames: readonly string[], turnRunningCount: number) => {
  const [firstRunningAgentName] = runningAgentNames;
  if (runningAgentNames.length === 1 && firstRunningAgentName !== undefined)
    return {
      answer: {
        consequence: SESSION_NOTICES.STOP_AGENT_MID_TURN_CONSEQUENCE,
        label: SESSION_LABELS.STOP_AGENT
      },
      title: SESSION_NOTICES.CONFIRM_STOP_AGENT(firstRunningAgentName)
    };

  return {
    answer: {
      consequence: SESSION_NOTICES.STOP_AGENTS_MID_TURN_CONSEQUENCE(turnRunningCount),
      label: SESSION_LABELS.STOP_AGENTS
    },
    title: SESSION_NOTICES.CONFIRM_STOP_AGENTS(runningAgentNames.length)
  };
};

const askDestructiveQuestion = (
  askingContext: AskingContext,
  question: {readonly answer: {readonly consequence: string; readonly label: string}; readonly title: string},
  onConfirm: () => void
) => {
  askingContext.showUserInput({
    _tag: USER_INPUT_TAGS.QUESTION,
    answers: [{...question.answer, answerId: question.answer.label, isDestructive: true}],
    onConfirm,
    title: question.title
  });
};

// Stopping asks only when it would cut a turn short.
const stopAgentsAsking = (askingContext: AskingContext, rowAction: RowAction, commandArgument: RowCommandArgument) => {
  const runningSessionListItems = listStoppedSessionListItems(
    askingContext,
    rowAction.commandId,
    commandArgument
  ).filter((sessionListItem) => sessionListItem.isAgentRunning);
  const turnRunningCount = runningSessionListItems.filter((sessionListItem) =>
    TURN_RUNNING_STATUSES.includes(sessionListItem.status)
  ).length;
  const stopAgents = () => {
    runCommandOnHost(rowAction.commandId, commandArgument);
  };
  if (turnRunningCount === 0) {
    stopAgents();

    return;
  }
  const runningAgentNames = runningSessionListItems.map((sessionListItem) => sessionListItem.displayName);

  askDestructiveQuestion(askingContext, makeStopAgentsQuestion(runningAgentNames, turnRunningCount), stopAgents);
};

const removeSessionAsking = (askingContext: AskingContext, commandArgument: RowCommandArgument) => {
  const sessionListItem = findSessionListItem(askingContext, commandArgument.sessionId);
  const removeSession = () => {
    runCommandOnHost(SESSION_COMMANDS.REMOVE, commandArgument);
  };
  if (sessionListItem === undefined || !sessionListItem.isAgentRunning) {
    removeSession();

    return;
  }

  askDestructiveQuestion(
    askingContext,
    {
      answer: {consequence: SESSION_NOTICES.REMOVE_STOPPING_AGENT, label: SESSION_LABELS.CONFIRM_REMOVE},
      title: SESSION_NOTICES.CONFIRM_REMOVE_RUNNING(sessionListItem.displayName)
    },
    removeSession
  );
};

const renameSessionAsking = (askingContext: AskingContext, commandArgument: RowCommandArgument) => {
  const sessionListItem = findSessionListItem(askingContext, commandArgument.sessionId);
  if (sessionListItem === undefined) return;

  askingContext.showUserInput({
    _tag: USER_INPUT_TAGS.TEXT,
    onEnterText: (enteredText) => {
      runCommandOnHost(SESSION_COMMANDS.RENAME, {customName: enteredText, sessionId: sessionListItem.sessionId});
    },
    title: SESSION_LABELS.RENAME,
    value: sessionListItem.displayName
  });
};

const editProjectSettings = (askingContext: AskingContext, commandArgument: RowCommandArgument) => {
  const projectListItem = askingContext.projectRows
    .map((projectRow) => projectRow.projectListItem)
    .find((listedProject) => listedProject.path === commandArgument.projectPath);
  if (projectListItem === undefined) return;

  askingContext.showUserInput({
    _tag: USER_INPUT_TAGS.PROJECT_SETTINGS,
    onSave: (settings) => {
      runCommandOnHost(PROJECT_COMMANDS.SAVE_SETTINGS, {projectPath: projectListItem.path, settings});
    },
    settings: projectListItem.settings,
    title: PROJECT_SETTINGS_LABELS.TITLE(projectListItem.name)
  });
};

// No choice to make, as in a folder outside git with one agent, starts at once; with no project, Add Project comes first.
const startSessionAsking = (askingContext: AskingContext, commandArgument: RowCommandArgument) => {
  const [onlyProjectRow] = askingContext.projectRows;
  if (onlyProjectRow === undefined) {
    runCommandOnHost(PROJECT_COMMANDS.ADD);

    return;
  }
  const projectPath =
    commandArgument.projectPath ??
    (askingContext.projectRows.length === 1 ? onlyProjectRow.projectListItem.path : undefined);
  const projectRow = askingContext.projectRows.find((listedRow) => listedRow.projectListItem.path === projectPath);
  const isChoiceLeft =
    projectRow === undefined ||
    projectRow.worktrees !== undefined ||
    isAgentChoiceShown(askingContext.agentRows, askingContext.skipAgentPicker);
  const startSession = (newSessionRequest: CommandRequest) => {
    runCommandOnHost(SESSION_COMMANDS.NEW_IN_CHOSEN_PROJECT, newSessionRequest);
  };
  if (!isChoiceLeft) {
    startSession(makeNewSessionRequest(projectRow.projectListItem.path, undefined, findDefaultWorkingTree(projectRow)));

    return;
  }

  askingContext.showUserInput({
    _tag: USER_INPUT_TAGS.NEW_SESSION,
    chosenProjectPath: projectPath,
    onStart: startSession,
    title: SESSION_LABELS.NEW_SESSION
  });
};

const askingActions: Partial<Record<RowAction["commandId"], AskingAction>> = {
  [PROJECT_COMMANDS.SAVE_SETTINGS]: (askingContext, _rowAction, commandArgument) => {
    editProjectSettings(askingContext, commandArgument);
  },
  [SESSION_COMMANDS.NEW_IN_CHOSEN_PROJECT]: (askingContext, _rowAction, commandArgument) => {
    startSessionAsking(askingContext, commandArgument);
  },
  [SESSION_COMMANDS.REMOVE]: (askingContext, _rowAction, commandArgument) => {
    removeSessionAsking(askingContext, commandArgument);
  },
  [SESSION_COMMANDS.RENAME]: (askingContext, _rowAction, commandArgument) => {
    renameSessionAsking(askingContext, commandArgument);
  },
  [SESSION_COMMANDS.STOP_AGENT]: stopAgentsAsking,
  [SESSION_COMMANDS.STOP_ARCHIVED_AGENTS]: stopAgentsAsking,
  [SESSION_COMMANDS.STOP_ARCHIVED_PROJECT_AGENTS]: stopAgentsAsking,
  [SESSION_COMMANDS.STOP_ONGOING_AGENTS]: stopAgentsAsking,
  [SESSION_COMMANDS.STOP_PROJECT_AGENTS]: stopAgentsAsking
};

// What needs the user's answer asks it here, then sends the host a request it can run without asking.
export const runRowActionAsking = (
  askingContext: AskingContext,
  rowAction: RowAction,
  commandArgument: RowCommandArgument | undefined
) => {
  const askingAction = askingActions[rowAction.commandId];
  if (askingAction === undefined) {
    runCommandOnHost(rowAction.commandId, commandArgument);

    return;
  }

  askingAction(askingContext, rowAction, commandArgument ?? {});
};
