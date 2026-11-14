import {SESSION_LISTS, USER_INPUT_TAGS} from "@/modules/sessions/sessions.constant.ts";
import {SESSIONS_VIEW_MESSAGE_TAGS} from "@pkg/constants/src/sessionsView.constant.ts";

import type {SessionListId, UserInput} from "@/modules/sessions/sessions.type.ts";
import type {HostMessagesByTag, SessionsData} from "@/modules/sessions/stores/sessions/sessions.type.ts";
import type {ProjectLeftoversDto} from "@dtos/worktree.dto.ts";
import type {ProjectRowData, SessionRowData, SessionsViewMessage} from "@views/sessions/sessions.view.type.ts";

const replaceProjectRow = (projectRows: readonly ProjectRowData[], changedProjectRow: ProjectRowData) =>
  projectRows.map((projectRow) =>
    projectRow.projectListItem.path === changedProjectRow.projectListItem.path ? changedProjectRow : projectRow
  );

// Leftovers listed for a dialog already closed, or for another project, are dropped.
const fillLeftovers = (userInput: undefined | UserInput, leftovers: ProjectLeftoversDto) =>
  userInput?._tag === USER_INPUT_TAGS.CLEAN_UP && userInput.projectPath === leftovers.projectPath
    ? {...userInput, leftovers}
    : userInput;

// Only the session's project gets a new object, so the other projects don't draw again.
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
  [SESSIONS_VIEW_MESSAGE_TAGS.SESSION_DRAWN]: (sessionsData, sessionDrawn) => ({
    ...sessionsData,
    archiveProjectRows: replaceSessionRow(sessionsData.archiveProjectRows, sessionDrawn.sessionRow),
    projectRows: replaceSessionRow(sessionsData.projectRows, sessionDrawn.sessionRow)
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

export const foldKey = <Key extends string>(foldedKeys: ReadonlySet<Key>, key: Key, isOpen: boolean) => {
  const otherFoldedKeys = [...foldedKeys].filter((foldedKey) => foldedKey !== key);

  return new Set(isOpen ? otherFoldedKeys : [...otherFoldedKeys, key]);
};

// A project shows in both lists, and folds in each on its own.
export const makeProjectKey = (listId: SessionListId, projectPath: string) => `${listId}:${projectPath}`;
