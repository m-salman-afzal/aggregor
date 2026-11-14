import {NEW_SESSION_FIELDS} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/newSessionInput.constant.ts";
import {SESSION_WORKING_TREES} from "@/modules/sessions/components/userInputDialog/userInputDialog.constant.ts";
import {runCommandOnHost} from "@/modules/sessions/sessions.service.ts";
import {AGENT_COMMANDS, AGENT_LABELS} from "@pkg/constants/src/agent.constant.ts";
import {NEW_SESSION_WORKING_TREE_TAGS, SESSION_LABELS} from "@pkg/constants/src/session.constant.ts";
import {StarIcon} from "lucide-react";

import type {
  NewSessionChoices,
  NewSessionOptionGroup,
  NewSessionOptionSources
} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/newSessionInput.type.ts";
import type {UserInputOption} from "@/modules/sessions/sessions.type.ts";
import type {AgentRowData, CommandRequest, ProjectRowData} from "@views/sessions/sessions.view.type.ts";

// The host starts the default agent when the request names none, so a hidden agent choice sends none.
export const isAgentChoiceShown = (agentRows: readonly AgentRowData[], skipAgentPicker: boolean) =>
  agentRows.length > 1 && !(skipAgentPicker && agentRows.some((agentRow) => agentRow.agentListItem.isDefault));

export const findProjectRow = (projectRows: readonly ProjectRowData[], projectPath: string) =>
  projectRows.find((projectRow) => projectRow.projectListItem.path === projectPath);

const findDefaultAgentId = (agentRows: readonly AgentRowData[]) => {
  const defaultAgentRow = agentRows.find((agentRow) => agentRow.agentListItem.isDefault) ?? agentRows[0];

  return defaultAgentRow?.agentListItem.agentId ?? "";
};

export const findDefaultWorkingTree = (projectRow: ProjectRowData | undefined) =>
  projectRow?.worktrees !== undefined &&
  projectRow.projectListItem.settings.newSessionWorkingTree === SESSION_WORKING_TREES.WORKTREE
    ? NEW_SESSION_WORKING_TREE_TAGS.NEW_WORKTREE
    : NEW_SESSION_WORKING_TREE_TAGS.PROJECT_ROOT;

// Only a new worktree goes in the worktrees folder; an existing one stays where it was made.
export const findNewWorktreesRootPath = (projectRows: readonly ProjectRowData[], choices: NewSessionChoices) =>
  choices.workingTree === NEW_SESSION_WORKING_TREE_TAGS.NEW_WORKTREE
    ? findProjectRow(projectRows, choices.projectPath)?.worktreesRootPath
    : undefined;

export const makeNewSessionRequest = (projectPath: string, agentId: string | undefined, workingTree: string) => {
  const isNamedWorkingTree =
    workingTree === NEW_SESSION_WORKING_TREE_TAGS.PROJECT_ROOT ||
    workingTree === NEW_SESSION_WORKING_TREE_TAGS.NEW_WORKTREE;
  const newSessionRequest: CommandRequest = {
    ...(agentId === undefined ? {} : {agentId}),
    projectPath,
    workingTree: isNamedWorkingTree
      ? {_tag: workingTree}
      : {_tag: NEW_SESSION_WORKING_TREE_TAGS.EXISTING_WORKTREE, worktreePath: workingTree}
  };

  return newSessionRequest;
};

const toProjectOptions = (projectRows: readonly ProjectRowData[]): readonly UserInputOption[] =>
  projectRows.map((projectRow) => ({
    description: projectRow.projectListItem.path,
    label: projectRow.projectListItem.name,
    optionId: projectRow.projectListItem.path
  }));

const toAgentOptions = (agentRows: readonly AgentRowData[]): readonly UserInputOption[] =>
  agentRows.map((agentRow) => ({
    description: agentRow.agentListItem.command,
    iconUri: agentRow.iconUri,
    label: agentRow.agentListItem.name,
    optionId: agentRow.agentListItem.agentId,
    ...(agentRow.agentListItem.isDefault
      ? {badge: AGENT_LABELS.DEFAULT}
      : {SecondaryActionIcon: StarIcon, secondaryActionLabel: AGENT_LABELS.SET_AS_DEFAULT})
  }));

// A worktree another session works in, in either list, isn't offered again.
const toWorkingTreeOptions = (
  projectRow: ProjectRowData | undefined,
  allProjectRows: readonly ProjectRowData[]
): readonly UserInputOption[] => {
  const usedWorktreePaths = new Set(
    allProjectRows.flatMap((listedProjectRow) =>
      listedProjectRow.sessionRows.map((sessionRow) => sessionRow.sessionListItem.worktreePath)
    )
  );
  const freeWorktrees = (projectRow?.worktrees ?? []).filter(
    (worktree) => !usedWorktreePaths.has(worktree.worktreePath)
  );

  return [
    {
      ...(projectRow === undefined ? {} : {description: projectRow.projectListItem.path}),
      label: SESSION_LABELS.PROJECT_ROOT,
      optionId: NEW_SESSION_WORKING_TREE_TAGS.PROJECT_ROOT
    },
    {
      description: SESSION_LABELS.NEW_WORKTREE_DESCRIPTION,
      label: SESSION_LABELS.NEW_WORKTREE,
      optionId: NEW_SESSION_WORKING_TREE_TAGS.NEW_WORKTREE
    },
    ...freeWorktrees.map((worktree) => ({
      description: worktree.worktreePath,
      label: worktree.branchName === "" ? worktree.worktreePath : worktree.branchName,
      optionId: worktree.worktreePath
    }))
  ];
};

export const findDefaultChoices = (
  chosenProjectPath: string | undefined,
  projectRows: readonly ProjectRowData[],
  agentRows: readonly AgentRowData[]
): NewSessionChoices => {
  const projectPath = chosenProjectPath ?? projectRows[0]?.projectListItem.path ?? "";

  return {
    agentId: findDefaultAgentId(agentRows),
    projectPath,
    workingTree: findDefaultWorkingTree(findProjectRow(projectRows, projectPath))
  };
};

// A star saves the default on the host and picks that agent here, before the host sends the agents again.
const setDefaultAgent = (optionSources: NewSessionOptionSources, agentId: string) => {
  runCommandOnHost(AGENT_COMMANDS.SET_DEFAULT, {agentId});
  optionSources.choose({agentId});
};

const toProjectGroup = (optionSources: NewSessionOptionSources): NewSessionOptionGroup => ({
  chosenOptionId: optionSources.choices.projectPath,
  legend: SESSION_LABELS.PROJECT_SECTION,
  name: NEW_SESSION_FIELDS.PROJECT,
  onChoose: (projectPath) => {
    optionSources.choose({
      projectPath,
      workingTree: findDefaultWorkingTree(findProjectRow(optionSources.projectRows, projectPath))
    });
  },
  options: toProjectOptions(optionSources.projectRows)
});

const toAgentGroup = (optionSources: NewSessionOptionSources): NewSessionOptionGroup => ({
  chosenOptionId: optionSources.choices.agentId,
  legend: SESSION_LABELS.AGENT_SECTION,
  name: NEW_SESSION_FIELDS.AGENT,
  onChoose: (agentId) => {
    optionSources.choose({agentId});
  },
  onSecondaryAction: (agentId) => {
    setDefaultAgent(optionSources, agentId);
  },
  options: toAgentOptions(optionSources.agentRows)
});

const toWorkingTreeGroup = (
  optionSources: NewSessionOptionSources,
  projectRow: ProjectRowData | undefined
): NewSessionOptionGroup => ({
  chosenOptionId: optionSources.choices.workingTree,
  legend: SESSION_LABELS.WORKING_TREE_SECTION,
  name: NEW_SESSION_FIELDS.WORKING_TREE,
  onChoose: (workingTree) => {
    optionSources.choose({workingTree});
  },
  options: toWorkingTreeOptions(projectRow, optionSources.allProjectRows)
});

export const makeOptionGroups = (optionSources: NewSessionOptionSources): readonly NewSessionOptionGroup[] => {
  const projectRow = findProjectRow(optionSources.projectRows, optionSources.choices.projectPath);
  const optionGroups: readonly (false | NewSessionOptionGroup)[] = [
    optionSources.isProjectShown && toProjectGroup(optionSources),
    optionSources.isAgentShown && toAgentGroup(optionSources),
    projectRow?.worktrees !== undefined && toWorkingTreeGroup(optionSources, projectRow)
  ];

  return optionGroups.filter((optionGroup): optionGroup is NewSessionOptionGroup => optionGroup !== false);
};
