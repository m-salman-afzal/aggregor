import {SESSION_LISTS} from "@/modules/sessions/sessions.constant.ts";
import {
  answerPromptOnHost,
  applyAppearance,
  askHostToDraw,
  listenToHost,
  readWebviewState,
  saveWebviewState
} from "@/modules/sessions/sessions.service.ts";
import {applyHostMessage, foldKey} from "@/modules/sessions/stores/sessions/sessions.utils.ts";
import {useSyncExternalStore} from "react";

import type {PromptAnswer, SessionListId} from "@/modules/sessions/sessions.type.ts";
import type {SessionsData, SessionsState} from "@/modules/sessions/stores/sessions/sessions.type.ts";

interface UseSessionsStoreProps<Selected> {
  readonly selectFromState: (sessionsState: SessionsState) => Selected;
}

const stateListeners = new Set<() => void>();
const savedWebviewState = readWebviewState();
let sessionsData: SessionsData = {
  appearance: undefined,
  archiveProjectRows: [],
  collapsedListIds: new Set(savedWebviewState.collapsedListIds),
  collapsedProjectKeys: new Set(savedWebviewState.collapsedProjectKeys),
  isDrawn: false,
  projectRows: [],
  prompt: undefined,
  viewedSessionId: savedWebviewState.viewedSessionId,
  waitingCounts: {[SESSION_LISTS.ARCHIVE]: 0, [SESSION_LISTS.SESSIONS]: 0}
};

const setSessionsData = (nextSessionsData: SessionsData) => {
  const isKeptStateChanged =
    nextSessionsData.collapsedListIds !== sessionsData.collapsedListIds ||
    nextSessionsData.collapsedProjectKeys !== sessionsData.collapsedProjectKeys ||
    nextSessionsData.viewedSessionId !== sessionsData.viewedSessionId;
  const isAppearanceChanged = nextSessionsData.appearance !== sessionsData.appearance;
  sessionsData = nextSessionsData;
  if (isAppearanceChanged && nextSessionsData.appearance !== undefined)
    applyAppearance(nextSessionsData.appearance.fontSize, nextSessionsData.appearance.accentColor);
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

// The prompt closes as soon as it is answered; the host waits for no more.
const answerPrompt = (promptAnswer: PromptAnswer) => {
  answerPromptOnHost(promptAnswer);
  setSessionsData({...sessionsData, prompt: undefined});
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
    props.selectFromState({...sessionsData, answerPrompt, setListOpen, setProjectOpen})
  );
