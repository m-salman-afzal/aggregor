import {StarIcon} from "lucide-react";

import {
  CURRENT_COMMIT_OPTION_ID,
  NEW_SESSION_FIELDS
} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/newSessionInput.constant.ts";
import {SESSION_WORKING_TREES} from "@/modules/sessions/components/userInputDialog/userInputDialog.constant.ts";
import {askHostForBranches, runCommandOnHost} from "@/modules/sessions/sessions.service.ts";
import {AGENT_COMMANDS, AGENT_LABELS} from "@pkg/constants/src/agent.constant.ts";
import {SESSION_LABELS, WORKING_TREE_CHOICE_TAGS} from "@pkg/constants/src/session.constant.ts";

import type {SessionListItemDto} from "@/dtos/session.dto.ts";
import type {ProjectBranchesDto} from "@/dtos/worktree.dto.ts";
import type {
  NewSessionChoices,
  NewSessionOptionGroup,
  NewSessionOptionSources,
  NewSessionOptionTab,
  NewSessionRequestChoices
} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/newSessionInput.type.ts";
import type {UserInputOption} from "@/modules/sessions/sessions.type.ts";
import type {AgentRowData, CommandRequest, ProjectRowData} from "@/views/sessions/sessions.view.type.ts";

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
    ? WORKING_TREE_CHOICE_TAGS.NEW_WORKTREE
    : WORKING_TREE_CHOICE_TAGS.PROJECT_ROOT;

export const findNewWorktreesRootPath = (projectRows: readonly ProjectRowData[], choices: NewSessionChoices) =>
  choices.workingTree === WORKING_TREE_CHOICE_TAGS.NEW_WORKTREE
    ? findProjectRow(projectRows, choices.projectPath)?.worktreesRootPath
    : undefined;

const makeWorkingTreeRequest = (workingTree: string, baseBranchName: string) => {
  if (workingTree === WORKING_TREE_CHOICE_TAGS.PROJECT_ROOT) return {_tag: workingTree};
  if (workingTree === WORKING_TREE_CHOICE_TAGS.NEW_WORKTREE)
    return baseBranchName === CURRENT_COMMIT_OPTION_ID ? {_tag: workingTree} : {_tag: workingTree, baseBranchName};

  return {_tag: WORKING_TREE_CHOICE_TAGS.EXISTING_WORKTREE, worktreePath: workingTree};
};

export const makeNewSessionRequest = (newSessionChoices: NewSessionRequestChoices, agentId: string | undefined) => {
  const newSessionRequest: CommandRequest = {
    ...(agentId === undefined ? {} : {agentId}),
    projectPath: newSessionChoices.projectPath,
    workingTree: makeWorkingTreeRequest(newSessionChoices.workingTree, newSessionChoices.baseBranchName)
  };

  return newSessionRequest;
};

export const askForBranchesWhenNeeded = (
  previousChoices: NewSessionChoices | undefined,
  nextChoices: NewSessionChoices
) => {
  if (nextChoices.workingTree !== WORKING_TREE_CHOICE_TAGS.NEW_WORKTREE) return;
  if (
    previousChoices !== undefined &&
    previousChoices.workingTree === nextChoices.workingTree &&
    previousChoices.projectPath === nextChoices.projectPath
  )
    return;
  askHostForBranches(nextChoices.projectPath);
};

export const chooseNewSessionParts = (
  choices: NewSessionChoices,
  chosenParts: Partial<NewSessionChoices>,
  setChoices: (nextChoices: NewSessionChoices) => void
) => {
  const nextChoices = {...choices, ...chosenParts};
  askForBranchesWhenNeeded(choices, nextChoices);
  setChoices(nextChoices);
};

const makeProjectOptions = (projectRows: readonly ProjectRowData[]): readonly UserInputOption[] =>
  projectRows.map((projectRow) => ({
    description: projectRow.projectListItem.path,
    label: projectRow.projectListItem.name,
    optionId: projectRow.projectListItem.path
  }));

const makeAgentOptions = (agentRows: readonly AgentRowData[]): readonly UserInputOption[] =>
  agentRows.map((agentRow) => ({
    description: agentRow.agentListItem.command,
    iconUri: agentRow.iconUri,
    label: agentRow.agentListItem.name,
    optionId: agentRow.agentListItem.agentId,
    ...(agentRow.agentListItem.isDefault
      ? {badge: AGENT_LABELS.DEFAULT}
      : {SecondaryActionIcon: StarIcon, secondaryActionLabel: AGENT_LABELS.SET_AS_DEFAULT})
  }));

const findCurrentWorkingTree = (movedSession: SessionListItemDto | undefined) =>
  movedSession === undefined ? undefined : (movedSession.worktreePath ?? WORKING_TREE_CHOICE_TAGS.PROJECT_ROOT);

const markCurrentWorkingTree = (workingTreeOption: UserInputOption, currentWorkingTree: string | undefined) =>
  workingTreeOption.optionId === currentWorkingTree
    ? {...workingTreeOption, badge: SESSION_LABELS.CURRENT}
    : workingTreeOption;

const findFreeWorktrees = (
  projectRow: ProjectRowData | undefined,
  allProjectRows: readonly ProjectRowData[],
  currentWorkingTree: string | undefined
) => {
  const usedWorktreePaths = new Set(
    allProjectRows.flatMap((listedProjectRow) =>
      listedProjectRow.sessionRows
        .map((sessionRow) => sessionRow.sessionListItem.worktreePath)
        .filter((worktreePath) => worktreePath !== currentWorkingTree)
    )
  );

  return (projectRow?.worktrees ?? []).filter((worktree) => !usedWorktreePaths.has(worktree.worktreePath));
};

const makeWorkingTreeOptions = (
  projectRow: ProjectRowData | undefined,
  allProjectRows: readonly ProjectRowData[],
  movedSession: SessionListItemDto | undefined
): readonly UserInputOption[] => {
  const currentWorkingTree = findCurrentWorkingTree(movedSession);
  const freeWorktrees = findFreeWorktrees(projectRow, allProjectRows, currentWorkingTree);
  const workingTreeOptions: readonly UserInputOption[] = [
    {
      ...(projectRow === undefined ? {} : {description: projectRow.projectListItem.path}),
      label: SESSION_LABELS.PROJECT_ROOT,
      optionId: WORKING_TREE_CHOICE_TAGS.PROJECT_ROOT
    },
    {
      description: SESSION_LABELS.NEW_WORKTREE_DESCRIPTION,
      label: SESSION_LABELS.NEW_WORKTREE,
      optionId: WORKING_TREE_CHOICE_TAGS.NEW_WORKTREE
    },
    ...freeWorktrees.map((worktree) => ({
      description: worktree.worktreePath,
      label: worktree.branchName === "" ? worktree.worktreePath : worktree.branchName,
      optionId: worktree.worktreePath
    }))
  ];

  return workingTreeOptions.map((workingTreeOption) => markCurrentWorkingTree(workingTreeOption, currentWorkingTree));
};

export const findMovedSessionChoices = (movedSession: SessionListItemDto): NewSessionChoices => ({
  agentId: "",
  baseBranchName: CURRENT_COMMIT_OPTION_ID,
  projectPath: movedSession.projectPath,
  workingTree: findCurrentWorkingTree(movedSession) ?? WORKING_TREE_CHOICE_TAGS.PROJECT_ROOT
});

export const makeChangeWorkingTreeRequest = (movedSession: SessionListItemDto, choices: NewSessionChoices) => {
  const changeWorkingTreeRequest: CommandRequest = {
    sessionId: movedSession.sessionId,
    workingTree: makeWorkingTreeRequest(choices.workingTree, choices.baseBranchName)
  };

  return changeWorkingTreeRequest;
};

export const findDefaultChoices = (
  chosenProjectPath: string | undefined,
  projectRows: readonly ProjectRowData[],
  agentRows: readonly AgentRowData[]
): NewSessionChoices => {
  const projectPath = chosenProjectPath ?? projectRows[0]?.projectListItem.path ?? "";

  return {
    agentId: findDefaultAgentId(agentRows),
    baseBranchName: CURRENT_COMMIT_OPTION_ID,
    projectPath,
    workingTree: findDefaultWorkingTree(findProjectRow(projectRows, projectPath))
  };
};

const setDefaultAgent = (optionSources: NewSessionOptionSources, agentId: string) => {
  runCommandOnHost(AGENT_COMMANDS.SET_DEFAULT, {agentId});
  optionSources.choose({agentId});
};

const makeProjectOptionGroup = (optionSources: NewSessionOptionSources): NewSessionOptionGroup => ({
  chosenOptionId: optionSources.choices.projectPath,
  isDropdown: true,
  legend: SESSION_LABELS.PROJECT_SECTION,
  name: NEW_SESSION_FIELDS.PROJECT,
  onChoose: (projectPath) => {
    optionSources.choose({
      baseBranchName: CURRENT_COMMIT_OPTION_ID,
      projectPath,
      workingTree: findDefaultWorkingTree(findProjectRow(optionSources.projectRows, projectPath))
    });
  },
  options: makeProjectOptions(optionSources.projectRows)
});

const makeAgentOptionGroup = (optionSources: NewSessionOptionSources): NewSessionOptionGroup => ({
  chosenOptionId: optionSources.choices.agentId,
  isDropdown: true,
  legend: SESSION_LABELS.AGENT_SECTION,
  name: NEW_SESSION_FIELDS.AGENT,
  onChoose: (agentId) => {
    optionSources.choose({agentId});
  },
  onSecondaryAction: (agentId) => {
    setDefaultAgent(optionSources, agentId);
  },
  options: makeAgentOptions(optionSources.agentRows)
});

const makeWorkingTreeOptionGroup = (
  optionSources: NewSessionOptionSources,
  projectRow: ProjectRowData | undefined
): NewSessionOptionGroup => ({
  chosenOptionId: optionSources.choices.workingTree,
  isDropdown: false,
  legend: SESSION_LABELS.WORKING_TREE_SECTION,
  name: NEW_SESSION_FIELDS.WORKING_TREE,
  onChoose: (workingTree) => {
    optionSources.choose({workingTree});
  },
  options: makeWorkingTreeOptions(projectRow, optionSources.allProjectRows, optionSources.movedSession)
});

const makeBranchOptions = (branchNames: readonly string[] | undefined): readonly UserInputOption[] =>
  (branchNames ?? []).map((branchName) => ({label: branchName, optionId: branchName}));

const makeBaseBranchOptionTabs = (
  branches: ProjectBranchesDto | undefined,
  projectPath: string
): readonly NewSessionOptionTab[] => {
  const projectBranches = branches?.projectPath === projectPath ? branches : undefined;
  const currentCommitOption: UserInputOption = {
    ...(projectBranches?.currentBranchName === undefined ? {} : {description: projectBranches.currentBranchName}),
    label: SESSION_LABELS.CURRENT_COMMIT,
    optionId: CURRENT_COMMIT_OPTION_ID
  };

  return [
    {
      isLoading: false,
      label: SESSION_LABELS.LOCAL_BRANCHES_TAB,
      options: [currentCommitOption, ...makeBranchOptions(projectBranches?.localBranchNames)]
    },
    {
      isLoading: projectBranches === undefined || projectBranches.isFetchingRemote,
      label: SESSION_LABELS.REMOTE_BRANCHES_TAB,
      options: makeBranchOptions(projectBranches?.remoteBranchNames)
    }
  ];
};

const makeBaseBranchOptionGroup = (optionSources: NewSessionOptionSources): NewSessionOptionGroup => {
  const baseBranchTabs = makeBaseBranchOptionTabs(optionSources.branches, optionSources.choices.projectPath);

  return {
    chosenOptionId: optionSources.choices.baseBranchName,
    isDropdown: true,
    legend: SESSION_LABELS.BASE_BRANCH_SECTION,
    name: NEW_SESSION_FIELDS.BASE_BRANCH,
    onChoose: (baseBranchName) => {
      optionSources.choose({baseBranchName});
    },
    options: baseBranchTabs.flatMap((baseBranchTab) => baseBranchTab.options),
    optionTabs: baseBranchTabs
  };
};

export const makeOptionGroups = (optionSources: NewSessionOptionSources): readonly NewSessionOptionGroup[] => {
  const projectRow = findProjectRow(optionSources.projectRows, optionSources.choices.projectPath);
  const isGitProject = projectRow?.worktrees !== undefined;
  const optionGroups: readonly (false | NewSessionOptionGroup)[] = [
    optionSources.isProjectShown && makeProjectOptionGroup(optionSources),
    optionSources.isAgentShown && makeAgentOptionGroup(optionSources),
    isGitProject && makeWorkingTreeOptionGroup(optionSources, projectRow),
    isGitProject &&
      optionSources.choices.workingTree === WORKING_TREE_CHOICE_TAGS.NEW_WORKTREE &&
      makeBaseBranchOptionGroup(optionSources)
  ];

  return optionGroups.filter((optionGroup): optionGroup is NewSessionOptionGroup => optionGroup !== false);
};
