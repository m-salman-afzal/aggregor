import {
  describeUserInput,
  takeEnteredText,
  takeProjectSettings
} from "@/modules/sessions/components/userInputDialog/userInputDialog.utils.ts";
import {USER_INPUT_TAGS} from "@/modules/sessions/sessions.constant.ts";
import {useSessionsStore} from "@/modules/sessions/stores/sessions/sessions.store.ts";

import type {CommandRequest} from "@views/sessions/sessions.view.type.ts";
import type {SubmitEvent} from "react";

export const useUserInputDialog = () => {
  const userInput = useSessionsStore({selectFromState: (sessionsState) => sessionsState.userInput});
  const closeUserInput = useSessionsStore({selectFromState: (sessionsState) => sessionsState.closeUserInput});

  return {
    choose: () => {
      closeUserInput();
      if (userInput?._tag === USER_INPUT_TAGS.QUESTION) userInput.onConfirm();
    },
    closeOnDismiss: (isOpen: boolean) => {
      if (!isOpen) closeUserInput();
    },
    closeUserInput,
    enterText: (formEvent: SubmitEvent<HTMLFormElement>) => {
      const enteredText = takeEnteredText(formEvent);
      closeUserInput();
      if (userInput?._tag === USER_INPUT_TAGS.TEXT) userInput.onEnterText(enteredText);
    },
    saveSettings: (formEvent: SubmitEvent<HTMLFormElement>) => {
      const settings = takeProjectSettings(formEvent);
      closeUserInput();
      if (userInput?._tag === USER_INPUT_TAGS.PROJECT_SETTINGS) userInput.onSave(settings);
    },
    startSession: (newSessionRequest: CommandRequest) => {
      closeUserInput();
      if (userInput?._tag === USER_INPUT_TAGS.NEW_SESSION) userInput.onStart(newSessionRequest);
    },
    userInput,
    ...describeUserInput(userInput)
  };
};
