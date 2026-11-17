import {
  describeUserInput,
  shouldReturnFocus,
  takeEnteredText,
  takeProjectSettings
} from "@/modules/sessions/components/userInputDialog/userInputDialog.utils.ts";
import {useSessionsStore} from "@/modules/sessions/stores/sessions/sessions.store.ts";

import type {SubmitEvent} from "react";

export const useUserInputDialog = () => {
  const userInput = useSessionsStore({selectFromState: (sessionsState) => sessionsState.userInput});
  const closeUserInput = useSessionsStore({selectFromState: (sessionsState) => sessionsState.closeUserInput});
  const choose = useSessionsStore({selectFromState: (sessionsState) => sessionsState.confirmQuestion});
  const cleanUp = useSessionsStore({selectFromState: (sessionsState) => sessionsState.deleteChosenLeftovers});
  const startSession = useSessionsStore({selectFromState: (sessionsState) => sessionsState.startNewSession});
  const answerWithText = useSessionsStore({selectFromState: (sessionsState) => sessionsState.answerWithText});
  const saveProjectSettings = useSessionsStore({selectFromState: (sessionsState) => sessionsState.saveProjectSettings});
  const closeOnDismiss = (isOpen: boolean) => {
    if (!isOpen) closeUserInput();
  };
  const enterText = (formEvent: SubmitEvent<HTMLFormElement>) => {
    answerWithText(takeEnteredText(formEvent));
  };
  const saveSettings = (formEvent: SubmitEvent<HTMLFormElement>) => {
    saveProjectSettings(takeProjectSettings(formEvent));
  };

  return {
    choose,
    cleanUp,
    closeOnDismiss,
    closeUserInput,
    enterText,
    saveSettings,
    shouldReturnFocus,
    startSession,
    userInput,
    ...describeUserInput(userInput)
  };
};
