import {SESSION_LISTS} from "@/modules/sessions/sessions.constant.ts";
import {SESSIONS_VIEW_MESSAGE_TAGS} from "@pkg/constants/src/sessionsView.constant.ts";

import type {SessionListId} from "@/modules/sessions/sessions.type.ts";
import type {HostMessagesByTag, SessionsData} from "@/modules/sessions/stores/sessions/sessions.type.ts";
import type {ProjectRowData, SessionRowData, SessionsViewMessage} from "@views/sessions/sessions.view.type.ts";

const replaceProjectSessionRows = (
  projectRows: readonly ProjectRowData[],
  projectSessions: HostMessagesByTag[typeof SESSIONS_VIEW_MESSAGE_TAGS.PROJECT_SESSIONS_DRAWN]
) =>
  projectRows.map((projectRow) =>
    projectRow.projectListItem.path === projectSessions.projectPath
      ? {...projectRow, sessionRows: projectSessions.sessionRows}
      : projectRow
  );

// Only the session's project gets a new object, so the other projects don't draw again.
const replaceSessionRow = (projectRows: readonly ProjectRowData[], changedSessionRow: SessionRowData) =>
  projectRows.map((projectRow) =>
    projectRow.sessionRows.some((sessionRow) => sessionRow.nodeId === changedSessionRow.nodeId)
      ? {
          ...projectRow,
          sessionRows: projectRow.sessionRows.map((sessionRow) =>
            sessionRow.nodeId === changedSessionRow.nodeId ? changedSessionRow : sessionRow
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
  [SESSIONS_VIEW_MESSAGE_TAGS.APPEARANCE_DRAWN]: (sessionsData, appearanceDrawn) => ({
    ...sessionsData,
    appearance: {accentColor: appearanceDrawn.accentColor, fontSize: appearanceDrawn.fontSize}
  }),
  [SESSIONS_VIEW_MESSAGE_TAGS.ARCHIVE_DRAWN]: (sessionsData, archiveDrawn) => ({
    ...sessionsData,
    archiveProjectRows: archiveDrawn.projectRows
  }),
  [SESSIONS_VIEW_MESSAGE_TAGS.PROJECT_SESSIONS_DRAWN]: (sessionsData, projectSessionsDrawn) => ({
    ...sessionsData,
    projectRows: replaceProjectSessionRows(sessionsData.projectRows, projectSessionsDrawn)
  }),
  [SESSIONS_VIEW_MESSAGE_TAGS.PROJECTS_DRAWN]: (sessionsData, projectsDrawn) => ({
    ...sessionsData,
    isDrawn: true,
    projectRows: projectsDrawn.projectRows
  }),
  [SESSIONS_VIEW_MESSAGE_TAGS.PROMPT_SHOWN]: (sessionsData, promptShown) => ({
    ...sessionsData,
    prompt: promptShown.prompt
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
export const makeProjectKey = (listId: SessionListId, projectNodeId: string) => `${listId}:${projectNodeId}`;
