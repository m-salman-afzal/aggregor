import {USER_INPUT_TAGS} from "@/modules/sessions/sessions.constant.ts";
import {SESSION_LISTS, SESSIONS_VIEW_MESSAGE_TAGS} from "@pkg/constants/src/sessionsView.constant.ts";

import type {SessionListId, UserInput} from "@/modules/sessions/sessions.type.ts";
import type {HostMessagesByTag, SessionsData} from "@/modules/sessions/stores/sessions/sessions.type.ts";
import type {SessionPullRequestsDto} from "@dtos/pullRequest.dto.ts";
import type {ImportableSessionsDto} from "@dtos/sessionImport.dto.ts";
import type {ProjectBranchesDto, ProjectLeftoversDto} from "@dtos/worktree.dto.ts";
import type {ProjectRowData, SessionRowData, SessionsViewMessage} from "@views/sessions/sessions.view.type.ts";

const replaceProjectRow = (projectRows: readonly ProjectRowData[], changedProjectRow: ProjectRowData) =>
  projectRows.map((projectRow) =>
    projectRow.projectListItem.path === changedProjectRow.projectListItem.path ? changedProjectRow : projectRow
  );

const fillLeftovers = (userInput: undefined | UserInput, leftovers: ProjectLeftoversDto) =>
  userInput?._tag === USER_INPUT_TAGS.CLEAN_UP && userInput.projectPath === leftovers.projectPath
    ? {...userInput, leftovers}
    : userInput;

const fillImportableSessions = (userInput: undefined | UserInput, importableSessions: ImportableSessionsDto) =>
  userInput?._tag === USER_INPUT_TAGS.IMPORT_SESSIONS && userInput.projectPath === importableSessions.projectPath
    ? {...userInput, importableSessions}
    : userInput;

const fillPullRequests = (userInput: undefined | UserInput, pullRequests: SessionPullRequestsDto) =>
  userInput?._tag === USER_INPUT_TAGS.PULL_REQUEST && userInput.linkedSession.sessionId === pullRequests.sessionId
    ? {...userInput, pullRequests}
    : userInput;

const fillBranches = (userInput: undefined | UserInput, branches: ProjectBranchesDto) =>
  userInput?._tag === USER_INPUT_TAGS.NEW_SESSION || userInput?._tag === USER_INPUT_TAGS.WORKING_TREE
    ? {...userInput, branches}
    : userInput;

const replaceSessionRow = (projectRows: readonly ProjectRowData[], changedSessionRow: SessionRowData) =>
  projectRows.map((projectRow) =>
    projectRow.sessionRows.some(
      (sessionRow) => sessionRow.sessionListItem.sessionId === changedSessionRow.sessionListItem.sessionId
    )
      ? {
          ...projectRow,
          sessionRows: projectRow.sessionRows.map((sessionRow) =>
            sessionRow.sessionListItem.sessionId === changedSessionRow.sessionListItem.sessionId
              ? changedSessionRow
              : sessionRow
          )
        }
      : projectRow
  );

const hostMessageReducers: {
  readonly [Tag in keyof HostMessagesByTag]: (
    sessionsData: SessionsData,
    hostMessage: HostMessagesByTag[Tag]
  ) => SessionsData;
} = {
  [SESSIONS_VIEW_MESSAGE_TAGS.AGENTS_DRAWN]: (sessionsData, agentsDrawn) => ({
    ...sessionsData,
    agentRows: agentsDrawn.agentRows,
    isWorkspaceTrustEnabled: agentsDrawn.isWorkspaceTrustEnabled,
    skipAgentPicker: agentsDrawn.skipAgentPicker
  }),
  [SESSIONS_VIEW_MESSAGE_TAGS.APPEARANCE_DRAWN]: (sessionsData, appearanceDrawn) => ({
    ...sessionsData,
    appearance: {accentColor: appearanceDrawn.accentColor, fontSize: appearanceDrawn.fontSize}
  }),
  [SESSIONS_VIEW_MESSAGE_TAGS.ARCHIVE_DRAWN]: (sessionsData, archiveDrawn) => ({
    ...sessionsData,
    archiveProjectRows: archiveDrawn.projectRows
  }),
  [SESSIONS_VIEW_MESSAGE_TAGS.BRANCHES_DRAWN]: (sessionsData, branchesDrawn) => ({
    ...sessionsData,
    userInput: fillBranches(sessionsData.userInput, branchesDrawn.branches)
  }),
  [SESSIONS_VIEW_MESSAGE_TAGS.IMPORTABLE_SESSIONS_DRAWN]: (sessionsData, importableSessionsDrawn) => ({
    ...sessionsData,
    userInput: fillImportableSessions(sessionsData.userInput, importableSessionsDrawn.importableSessions)
  }),
  [SESSIONS_VIEW_MESSAGE_TAGS.LEFTOVERS_DRAWN]: (sessionsData, leftoversDrawn) => ({
    ...sessionsData,
    userInput: fillLeftovers(sessionsData.userInput, leftoversDrawn.leftovers)
  }),
  [SESSIONS_VIEW_MESSAGE_TAGS.PROJECT_DRAWN]: (sessionsData, projectDrawn) => ({
    ...sessionsData,
    projectRows: replaceProjectRow(sessionsData.projectRows, projectDrawn.projectRow)
  }),
  [SESSIONS_VIEW_MESSAGE_TAGS.PROJECTS_DRAWN]: (sessionsData, projectsDrawn) => ({
    ...sessionsData,
    isDrawn: true,
    projectRows: projectsDrawn.projectRows
  }),
  [SESSIONS_VIEW_MESSAGE_TAGS.PULL_REQUESTS_DRAWN]: (sessionsData, pullRequestsDrawn) => ({
    ...sessionsData,
    userInput: fillPullRequests(sessionsData.userInput, pullRequestsDrawn.pullRequests)
  }),
  [SESSIONS_VIEW_MESSAGE_TAGS.SESSION_DRAWN]: (sessionsData, sessionDrawn) => ({
    ...sessionsData,
    archiveProjectRows: replaceSessionRow(sessionsData.archiveProjectRows, sessionDrawn.sessionRow),
    projectRows: replaceSessionRow(sessionsData.projectRows, sessionDrawn.sessionRow)
  }),
  [SESSIONS_VIEW_MESSAGE_TAGS.SESSION_PROCESSES_DRAWN]: (sessionsData, sessionProcessesDrawn) => ({
    ...sessionsData,
    sessionProcessesBySessionId: new Map([
      ...sessionsData.sessionProcessesBySessionId,
      [sessionProcessesDrawn.sessionProcesses.sessionId, sessionProcessesDrawn.sessionProcesses]
    ])
  }),
  [SESSIONS_VIEW_MESSAGE_TAGS.VIEWED_SESSION_CHANGED]: (sessionsData, viewedSessionChanged) => ({
    ...sessionsData,
    viewedSessionId: viewedSessionChanged.sessionId
  }),
  [SESSIONS_VIEW_MESSAGE_TAGS.WAITING_COUNTS_DRAWN]: (sessionsData, waitingCountsDrawn) => ({
    ...sessionsData,
    waitingCounts: {
      [SESSION_LISTS.ARCHIVE]: waitingCountsDrawn.archiveWaitingCount,
      [SESSION_LISTS.SESSIONS]: waitingCountsDrawn.sessionsWaitingCount
    }
  })
};

const reduceHostMessage = <Tag extends keyof HostMessagesByTag>(
  sessionsData: SessionsData,
  tag: Tag,
  hostMessage: HostMessagesByTag[Tag]
) => hostMessageReducers[tag](sessionsData, hostMessage);

export const applyHostMessage = (sessionsData: SessionsData, hostMessage: SessionsViewMessage) =>
  reduceHostMessage(sessionsData, hostMessage._tag, hostMessage);

export const addOrRemoveFoldedKey = <Key extends string>(foldedKeys: ReadonlySet<Key>, key: Key, isOpen: boolean) => {
  const otherFoldedKeys = [...foldedKeys].filter((foldedKey) => foldedKey !== key);

  return new Set(isOpen ? otherFoldedKeys : [...otherFoldedKeys, key]);
};

export const listWatchedSessionIds = (sessionsData: SessionsData) =>
  [...sessionsData.projectRows, ...sessionsData.archiveProjectRows]
    .flatMap((projectRow) => projectRow.sessionRows)
    .filter(
      (sessionRow) =>
        sessionRow.sessionListItem.isAgentRunning &&
        sessionsData.openDropdownSessionIds.has(sessionRow.sessionListItem.sessionId)
    )
    .map((sessionRow) => sessionRow.sessionListItem.sessionId)
    .toSorted();

export const makeProjectKey = (listId: SessionListId, projectPath: string) => `${listId}:${projectPath}`;
