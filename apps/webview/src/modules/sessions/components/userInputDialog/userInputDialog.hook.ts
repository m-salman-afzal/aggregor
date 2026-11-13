import {
  isDestructiveUserInput,
  pickUserInputIcon
} from "@/modules/sessions/components/userInputDialog/userInputDialog.utils.ts";
import {SESSIONS_LABELS, USER_INPUT_TAGS} from "@/modules/sessions/sessions.constant.ts";
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
      const enteredText = new FormData(formEvent.currentTarget).get(SESSIONS_LABELS.USER_INPUT_TEXT_FIELD);
      closeUserInput();
      if (userInput?._tag === USER_INPUT_TAGS.TEXT)
        userInput.onEnterText(typeof enteredText === "string" ? enteredText : "");
    },
    isDestructive: userInput !== undefined && isDestructiveUserInput(userInput),
    userInput,
    UserInputIcon: userInput === undefined ? undefined : pickUserInputIcon(userInput)
  };
};
