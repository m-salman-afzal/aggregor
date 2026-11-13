import {SESSIONS_VIEW_MESSAGE_TAGS} from "@pkg/constants/src/sessionsView.constant.ts";

import type {HostMessagesByTag, SessionsData} from "@/modules/sessions/stores/sessions/sessions.type.ts";
import type {ProjectRowData, SessionRowData, SessionsViewMessage} from "@views/sessions/sessions.view.type.ts";

const replaceProjectSessionRows = (
  sessionsData: SessionsData,
  projectSessions: HostMessagesByTag[typeof SESSIONS_VIEW_MESSAGE_TAGS.PROJECT_SESSIONS_DRAWN]
) =>
  sessionsData.projectRows.map((projectRow) =>
    projectRow.projectListItem.path === projectSessions.projectPath
      ? {...projectRow, sessionRows: projectSessions.sessionRows}
      : projectRow
  );

// Only the session's project gets a new object, so the other projects don't draw again.
const replaceSessionRow = (projectRows: readonly ProjectRowData[], changedSessionRow: SessionRowData) =>
  projectRows.map((projectRow) =>
    projectRow.projectListItem.path === changedSessionRow.sessionListItem.projectPath
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
  [SESSIONS_VIEW_MESSAGE_TAGS.PROJECT_SESSIONS_DRAWN]: (sessionsData, projectSessionsDrawn) => ({
    ...sessionsData,
    projectRows: replaceProjectSessionRows(sessionsData, projectSessionsDrawn)
  }),
  [SESSIONS_VIEW_MESSAGE_TAGS.PROJECTS_DRAWN]: (sessionsData, projectsDrawn) => ({
    ...sessionsData,
    isDrawn: true,
    projectRows: projectsDrawn.projectRows
  }),
  [SESSIONS_VIEW_MESSAGE_TAGS.SESSION_DRAWN]: (sessionsData, sessionDrawn) => ({
    ...sessionsData,
    projectRows: replaceSessionRow(sessionsData.projectRows, sessionDrawn.sessionRow)
  }),
  [SESSIONS_VIEW_MESSAGE_TAGS.VIEWED_SESSION_CHANGED]: (sessionsData, viewedSessionChanged) => ({
    ...sessionsData,
    viewedSessionId: viewedSessionChanged.sessionId
  })
};

const reduceHostMessage = <Tag extends keyof HostMessagesByTag>(
  sessionsData: SessionsData,
  tag: Tag,
  hostMessage: HostMessagesByTag[Tag]
) => hostMessageReducers[tag](sessionsData, hostMessage);

export const applyHostMessage = (sessionsData: SessionsData, hostMessage: SessionsViewMessage) =>
  reduceHostMessage(sessionsData, hostMessage._tag, hostMessage);

export const foldProject = (collapsedProjectNodeIds: ReadonlySet<string>, projectNodeId: string, isOpen: boolean) => {
  const otherCollapsedNodeIds = [...collapsedProjectNodeIds].filter(
    (collapsedNodeId) => collapsedNodeId !== projectNodeId
  );

  return new Set(isOpen ? otherCollapsedNodeIds : [...otherCollapsedNodeIds, projectNodeId]);
};
