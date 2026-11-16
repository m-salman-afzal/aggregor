import {
  askHostToDraw,
  listenToHost,
  readStyleNonce,
  readWebviewState,
  saveWebviewState
} from "@/modules/sessions/sessions.service.ts";
import {applyHostMessage, foldKey, makeProjectKey} from "@/modules/sessions/stores/sessions/sessions.utils.ts";
import {SESSION_LISTS} from "@pkg/constants/src/sessionsView.constant.ts";
import {useSyncExternalStore} from "react";

import type {SessionListId, UserInput} from "@/modules/sessions/sessions.type.ts";
import type {SessionsData, SessionsState} from "@/modules/sessions/stores/sessions/sessions.type.ts";

interface UseSessionsStoreProps<Selected> {
  readonly selectFromState: (sessionsState: SessionsState) => Selected;
}

const stateListeners = new Set<() => void>();
const savedWebviewState = readWebviewState();
let sessionsData: SessionsData = {
  agentRows: [],
  appearance: undefined,
  archiveProjectRows: [],
  collapsedListIds: new Set(savedWebviewState.collapsedListIds),
  collapsedProjectKeys: new Set(savedWebviewState.collapsedProjectKeys),
  isDrawn: false,
  isWorkspaceTrustEnabled: false,
  isWorktreeTrustHintHidden: savedWebviewState.isWorktreeTrustHintHidden,
  projectRows: [],
  skipAgentPicker: false,
  styleNonce: readStyleNonce(),
  userInput: undefined,
  viewedSessionId: savedWebviewState.viewedSessionId,
  waitingCounts: {[SESSION_LISTS.ARCHIVE]: 0, [SESSION_LISTS.SESSIONS]: 0}
};

const setSessionsData = (nextSessionsData: SessionsData) => {
  const isKeptStateChanged =
    nextSessionsData.collapsedListIds !== sessionsData.collapsedListIds ||
    nextSessionsData.collapsedProjectKeys !== sessionsData.collapsedProjectKeys ||
    nextSessionsData.isWorktreeTrustHintHidden !== sessionsData.isWorktreeTrustHintHidden ||
    nextSessionsData.viewedSessionId !== sessionsData.viewedSessionId;
  sessionsData = nextSessionsData;
  if (isKeptStateChanged)
    saveWebviewState({
      collapsedListIds: [...nextSessionsData.collapsedListIds],
      collapsedProjectKeys: [...nextSessionsData.collapsedProjectKeys],
      isWorktreeTrustHintHidden: nextSessionsData.isWorktreeTrustHintHidden,
      viewedSessionId: nextSessionsData.viewedSessionId
    });
  for (const stateListener of stateListeners) stateListener();
};

const setListOpen = (listId: SessionListId, isOpen: boolean) => {
  setSessionsData({...sessionsData, collapsedListIds: foldKey(sessionsData.collapsedListIds, listId, isOpen)});
};

const setProjectOpen = (projectKey: string, isOpen: boolean) => {
  setSessionsData({
    ...sessionsData,
    collapsedProjectKeys: foldKey(sessionsData.collapsedProjectKeys, projectKey, isOpen)
  });
};

const revealSessionsProject = (projectPath: string) => {
  setSessionsData({
    ...sessionsData,
    collapsedListIds: foldKey(sessionsData.collapsedListIds, SESSION_LISTS.SESSIONS, true),
    collapsedProjectKeys: foldKey(
      sessionsData.collapsedProjectKeys,
      makeProjectKey(SESSION_LISTS.SESSIONS, projectPath),
      true
    )
  });
};

const showUserInput = (userInput: UserInput) => {
  setSessionsData({...sessionsData, userInput});
};

const closeUserInput = () => {
  setSessionsData({...sessionsData, userInput: undefined});
};

const hideWorktreeTrustHint = () => {
  setSessionsData({...sessionsData, isWorktreeTrustHintHidden: true});
};

// Marked at once, so the row follows the click while the host is still busy switching the window.
const markViewedSession = (sessionId: string) => {
  setSessionsData({...sessionsData, viewedSessionId: sessionId});
};

const subscribeToSessionsData = (stateListener: () => void) => {
  stateListeners.add(stateListener);

  return () => {
    stateListeners.delete(stateListener);
  };
};

// The store listens from its first import, before the view mounts, so no message is missed and no effect has to wait.
listenToHost((sessionsViewMessage) => {
  setSessionsData(applyHostMessage(sessionsData, sessionsViewMessage));
});
askHostToDraw();

export const useSessionsStore = <Selected>(props: UseSessionsStoreProps<Selected>) =>
  useSyncExternalStore(subscribeToSessionsData, () =>
    props.selectFromState({
      ...sessionsData,
      closeUserInput,
      hideWorktreeTrustHint,
      markViewedSession,
      revealSessionsProject,
      setListOpen,
      setProjectOpen,
      showUserInput
    })
  );
