import {SESSION_LISTS} from "@/modules/sessions/sessions.constant.ts";
import {
  askHostToDraw,
  listenToHost,
  readStyleNonce,
  readWebviewState,
  saveWebviewState
} from "@/modules/sessions/sessions.service.ts";
import {applyHostMessage, foldKey} from "@/modules/sessions/stores/sessions/sessions.utils.ts";
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
    nextSessionsData.viewedSessionId !== sessionsData.viewedSessionId;
  sessionsData = nextSessionsData;
  if (isKeptStateChanged)
    saveWebviewState({
      collapsedListIds: [...nextSessionsData.collapsedListIds],
      collapsedProjectKeys: [...nextSessionsData.collapsedProjectKeys],
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

const showUserInput = (userInput: UserInput) => {
  setSessionsData({...sessionsData, userInput});
};

const closeUserInput = () => {
  setSessionsData({...sessionsData, userInput: undefined});
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
    props.selectFromState({...sessionsData, closeUserInput, setListOpen, setProjectOpen, showUserInput})
  );
