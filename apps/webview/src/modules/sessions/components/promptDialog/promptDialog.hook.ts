import {isDestructivePrompt, pickPromptIcon} from "@/modules/sessions/components/promptDialog/promptDialog.utils.ts";
import {SESSIONS_LABELS} from "@/modules/sessions/sessions.constant.ts";
import {useSessionsStore} from "@/modules/sessions/stores/sessions/sessions.store.ts";
import {PROMPT_ANSWER_TAGS} from "@pkg/constants/src/sessionsView.constant.ts";

import type {SubmitEvent} from "react";

export const usePromptDialog = () => {
  const prompt = useSessionsStore({selectFromState: (sessionsState) => sessionsState.prompt});
  const answerPrompt = useSessionsStore({selectFromState: (sessionsState) => sessionsState.answerPrompt});
  const cancel = () => {
    answerPrompt({_tag: PROMPT_ANSWER_TAGS.CANCELLED});
  };

  return {
    cancel,
    choose: (choiceId: string, isSecondaryAction: boolean) => {
      answerPrompt({_tag: PROMPT_ANSWER_TAGS.CHOSEN, choiceId, isSecondaryAction});
    },
    closeOnDismiss: (isOpen: boolean) => {
      if (!isOpen) cancel();
    },
    enterText: (formEvent: SubmitEvent<HTMLFormElement>) => {
      formEvent.preventDefault();
      const enteredText = new FormData(formEvent.currentTarget).get(SESSIONS_LABELS.PROMPT_TEXT_FIELD);
      answerPrompt({_tag: PROMPT_ANSWER_TAGS.TEXT_ENTERED, text: typeof enteredText === "string" ? enteredText : ""});
    },
    isDestructive: prompt !== undefined && isDestructivePrompt(prompt),
    prompt,
    PromptIcon: prompt === undefined ? undefined : pickPromptIcon(prompt)
  };
};
