import {
  isDestructiveUserInput,
  pickUserInputIcon,
  readEnteredText,
  readProjectSettings
} from "@/modules/sessions/components/userInputDialog/userInputDialog.utils.ts";
import {USER_INPUT_TAGS} from "@/modules/sessions/sessions.constant.ts";
import {useSessionsStore} from "@/modules/sessions/stores/sessions/sessions.store.ts";

import type {SubmitEvent} from "react";

export const useUserInputDialog = () => {
  const userInput = useSessionsStore({selectFromState: (sessionsState) => sessionsState.userInput});
  const closeUserInput = useSessionsStore({selectFromState: (sessionsState) => sessionsState.closeUserInput});

  return {
    cancel: closeUserInput,
    choose: (choiceId: string, isSecondaryAction: boolean) => {
      closeUserInput();
      if (userInput?._tag === USER_INPUT_TAGS.CHOICE) userInput.onChoose(choiceId, isSecondaryAction);
      if (userInput?._tag === USER_INPUT_TAGS.QUESTION) userInput.onConfirm();
    },
    closeOnDismiss: (isOpen: boolean) => {
      if (!isOpen) closeUserInput();
    },
    enterText: (formEvent: SubmitEvent<HTMLFormElement>) => {
      formEvent.preventDefault();
      const enteredText = readEnteredText(formEvent.currentTarget);
      closeUserInput();
      if (userInput?._tag === USER_INPUT_TAGS.TEXT) userInput.onEnterText(enteredText);
    },
    isDestructive: userInput !== undefined && isDestructiveUserInput(userInput),
    saveSettings: (formEvent: SubmitEvent<HTMLFormElement>) => {
      formEvent.preventDefault();
      const settings = readProjectSettings(formEvent.currentTarget);
      closeUserInput();
      if (userInput?._tag === USER_INPUT_TAGS.PROJECT_SETTINGS) userInput.onSave(settings);
    },
    userInput,
    UserInputIcon: userInput === undefined ? undefined : pickUserInputIcon(userInput)
  };
};
