import {
  describeUserInput,
  makeFormAnswers
} from "@/modules/sessions/components/userInputDialog/userInputDialog.utils.ts";
import {USER_INPUT_TAGS} from "@/modules/sessions/sessions.constant.ts";
import {useSessionsStore} from "@/modules/sessions/stores/sessions/sessions.store.ts";

import type {ChosenLeftovers} from "@/modules/sessions/sessions.type.ts";
import type {CommandRequest} from "@views/sessions/sessions.view.type.ts";

export const useUserInputDialog = () => {
  const userInput = useSessionsStore({selectFromState: (sessionsState) => sessionsState.userInput});
  const closeUserInput = useSessionsStore({selectFromState: (sessionsState) => sessionsState.closeUserInput});

  return {
    choose: () => {
      closeUserInput();
      if (userInput?._tag === USER_INPUT_TAGS.QUESTION) userInput.onConfirm();
    },
    cleanUp: (chosenLeftovers: ChosenLeftovers) => {
      closeUserInput();
      if (userInput?._tag === USER_INPUT_TAGS.CLEAN_UP) userInput.onDelete(chosenLeftovers);
    },
    closeOnDismiss: (isOpen: boolean) => {
      if (!isOpen) closeUserInput();
    },
    closeUserInput,
    ...makeFormAnswers(userInput, closeUserInput),
    startSession: (newSessionRequest: CommandRequest) => {
      closeUserInput();
      if (userInput?._tag === USER_INPUT_TAGS.NEW_SESSION) userInput.onStart(newSessionRequest);
    },
    userInput,
    ...describeUserInput(userInput)
  };
};
