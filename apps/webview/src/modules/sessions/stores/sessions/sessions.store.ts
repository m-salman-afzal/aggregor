import {USER_INPUT_TAGS} from "@/modules/sessions/sessions.constant.ts";
import {
  askHostToDraw,
  askHostToWatchSessionProcesses,
  listenToHost,
  readStyleNonce,
  readWebviewState,
  saveWebviewState
} from "@/modules/sessions/sessions.service.ts";
import {
  addOrRemoveFoldedKey,
  applyHostMessage,
  listWatchedSessionIds,
  makeProjectKey
} from "@/modules/sessions/stores/sessions/sessions.utils.ts";
import {SESSION_LISTS} from "@pkg/constants/src/sessionsView.constant.ts";
import {useSyncExternalStore} from "react";

import type {ChosenLeftovers, SessionListId, UserInput} from "@/modules/sessions/sessions.type.ts";
import type {SessionsData, SessionsState} from "@/modules/sessions/stores/sessions/sessions.type.ts";
import type {ProjectSettingsDto} from "@dtos/project.dto.ts";
import type {ImportedSessionDto} from "@dtos/sessionImport.dto.ts";
import type {CommandRequest} from "@views/sessions/sessions.view.type.ts";

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
  openDropdownSessionIds: new Set(savedWebviewState.openDropdownSessionIds),
  projectRows: [],
  sessionProcessesBySessionId: new Map(),
  skipAgentPicker: false,
  styleNonce: readStyleNonce(),
  userInput: undefined,
  viewedSessionId: savedWebviewState.viewedSessionId,
  waitingCounts: {[SESSION_LISTS.ARCHIVE]: 0, [SESSION_LISTS.SESSIONS]: 0}
};

let watchedSessionIds: readonly string[] = [];

const watchOpenDropdowns = (nextSessionsData: SessionsData) => {
  const nextWatchedSessionIds = listWatchedSessionIds(nextSessionsData);
  if (nextWatchedSessionIds.join() === watchedSessionIds.join()) return;
  watchedSessionIds = nextWatchedSessionIds;
  askHostToWatchSessionProcesses(nextWatchedSessionIds);
};

const setSessionsData = (nextSessionsData: SessionsData) => {
  const isKeptStateChanged =
    nextSessionsData.collapsedListIds !== sessionsData.collapsedListIds ||
    nextSessionsData.collapsedProjectKeys !== sessionsData.collapsedProjectKeys ||
    nextSessionsData.isWorktreeTrustHintHidden !== sessionsData.isWorktreeTrustHintHidden ||
    nextSessionsData.openDropdownSessionIds !== sessionsData.openDropdownSessionIds ||
    nextSessionsData.viewedSessionId !== sessionsData.viewedSessionId;
  sessionsData = nextSessionsData;
  if (isKeptStateChanged)
    saveWebviewState({
      collapsedListIds: [...nextSessionsData.collapsedListIds],
      collapsedProjectKeys: [...nextSessionsData.collapsedProjectKeys],
      isWorktreeTrustHintHidden: nextSessionsData.isWorktreeTrustHintHidden,
      openDropdownSessionIds: [...nextSessionsData.openDropdownSessionIds],
      viewedSessionId: nextSessionsData.viewedSessionId
    });
  watchOpenDropdowns(nextSessionsData);
  for (const stateListener of stateListeners) stateListener();
};

const setListOpen = (listId: SessionListId, isOpen: boolean) => {
  setSessionsData({
    ...sessionsData,
    collapsedListIds: addOrRemoveFoldedKey(sessionsData.collapsedListIds, listId, isOpen)
  });
};

const setProjectOpen = (projectKey: string, isOpen: boolean) => {
  setSessionsData({
    ...sessionsData,
    collapsedProjectKeys: addOrRemoveFoldedKey(sessionsData.collapsedProjectKeys, projectKey, isOpen)
  });
};

const setSessionDropdownOpen = (sessionId: string, isOpen: boolean) => {
  setSessionsData({
    ...sessionsData,
    openDropdownSessionIds: addOrRemoveFoldedKey(sessionsData.openDropdownSessionIds, sessionId, !isOpen),
    sessionProcessesBySessionId: new Map(
      [...sessionsData.sessionProcessesBySessionId].filter(([readSessionId]) => isOpen || readSessionId !== sessionId)
    )
  });
};

const revealSessionsProject = (projectPath: string) => {
  setSessionsData({
    ...sessionsData,
    collapsedListIds: addOrRemoveFoldedKey(sessionsData.collapsedListIds, SESSION_LISTS.SESSIONS, true),
    collapsedProjectKeys: addOrRemoveFoldedKey(
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

// The dialog closes before the answer runs, so an answer may open the next one.
const takeUserInput = () => {
  const userInput = sessionsData.userInput;
  closeUserInput();

  return userInput;
};

const confirmQuestion = () => {
  const userInput = takeUserInput();
  if (userInput?._tag === USER_INPUT_TAGS.QUESTION) userInput.onConfirm();
};

const deleteChosenLeftovers = (chosenLeftovers: ChosenLeftovers) => {
  const userInput = takeUserInput();
  if (userInput?._tag === USER_INPUT_TAGS.CLEAN_UP) userInput.onDelete(chosenLeftovers);
};

const importChosenSessions = (importedSessions: readonly ImportedSessionDto[]) => {
  const userInput = takeUserInput();
  if (userInput?._tag === USER_INPUT_TAGS.IMPORT_SESSIONS) userInput.onImport(importedSessions);
};

const answerWithText = (enteredText: string) => {
  const userInput = takeUserInput();
  if (userInput?._tag === USER_INPUT_TAGS.TEXT) userInput.onEnterText(enteredText);
};

const saveProjectSettings = (projectSettings: ProjectSettingsDto) => {
  const userInput = takeUserInput();
  if (userInput?._tag === USER_INPUT_TAGS.PROJECT_SETTINGS) userInput.onSave(projectSettings);
};

const startNewSession = (newSessionRequest: CommandRequest) => {
  const userInput = takeUserInput();
  if (userInput?._tag === USER_INPUT_TAGS.NEW_SESSION) userInput.onStart(newSessionRequest);
};

const linkChosenPullRequest = (pullRequestNumber: number) => {
  const userInput = takeUserInput();
  if (userInput?._tag === USER_INPUT_TAGS.PULL_REQUEST) userInput.onLink(pullRequestNumber);
};

const moveSessionToWorkingTree = (changeWorkingTreeRequest: CommandRequest) => {
  const userInput = takeUserInput();
  if (userInput?._tag === USER_INPUT_TAGS.WORKING_TREE) userInput.onMove(changeWorkingTreeRequest);
};

const hideWorktreeTrustHint = () => {
  setSessionsData({...sessionsData, isWorktreeTrustHintHidden: true});
};

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
      answerWithText,
      closeUserInput,
      confirmQuestion,
      deleteChosenLeftovers,
      hideWorktreeTrustHint,
      importChosenSessions,
      linkChosenPullRequest,
      markViewedSession,
      moveSessionToWorkingTree,
      revealSessionsProject,
      saveProjectSettings,
      setListOpen,
      setProjectOpen,
      setSessionDropdownOpen,
      showUserInput,
      startNewSession
    })
  );
