import {askHostToDraw, listenToHost, readWebviewState, saveWebviewState} from "@/modules/sessions/sessions.service.ts";
import {applyHostMessage, foldProject} from "@/modules/sessions/stores/sessions/sessions.utils.ts";
import {useSyncExternalStore} from "react";

import type {SessionsData, SessionsState} from "@/modules/sessions/stores/sessions/sessions.type.ts";

interface UseSessionsStoreProps<Selected> {
  readonly selectFromState: (sessionsState: SessionsState) => Selected;
}

const stateListeners = new Set<() => void>();
const savedWebviewState = readWebviewState();
let sessionsData: SessionsData = {
  collapsedProjectNodeIds: new Set(savedWebviewState.collapsedProjectNodeIds),
  isDrawn: false,
  projectRows: [],
  viewedSessionId: savedWebviewState.viewedSessionId
};

const setSessionsData = (nextSessionsData: SessionsData) => {
  const isKeptStateChanged =
    nextSessionsData.collapsedProjectNodeIds !== sessionsData.collapsedProjectNodeIds ||
    nextSessionsData.viewedSessionId !== sessionsData.viewedSessionId;
  sessionsData = nextSessionsData;
  if (isKeptStateChanged)
    saveWebviewState({
      collapsedProjectNodeIds: [...nextSessionsData.collapsedProjectNodeIds],
      viewedSessionId: nextSessionsData.viewedSessionId
    });
  for (const stateListener of stateListeners) stateListener();
};

const setProjectOpen = (projectNodeId: string, isOpen: boolean) => {
  setSessionsData({
    ...sessionsData,
    collapsedProjectNodeIds: foldProject(sessionsData.collapsedProjectNodeIds, projectNodeId, isOpen)
  });
};

const subscribeToSessionsData = (stateListener: () => void) => {
  stateListeners.add(stateListener);

  return () => {
    stateListeners.delete(stateListener);
  };
};

// The store listens from its first import, before the view mounts, and only then asks the host to draw, so no message
// is missed and no effect has to wait for the view to mount.
listenToHost((sessionsViewMessage) => {
  setSessionsData(applyHostMessage(sessionsData, sessionsViewMessage));
});
askHostToDraw();

// A component draws again only when what it selects changes.
export const useSessionsStore = <Selected>(props: UseSessionsStoreProps<Selected>) =>
  useSyncExternalStore(subscribeToSessionsData, () => props.selectFromState({...sessionsData, setProjectOpen}));
