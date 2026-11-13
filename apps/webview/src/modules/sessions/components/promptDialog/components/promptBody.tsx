import {ChoicePrompt} from "@/modules/sessions/components/promptDialog/components/choicePrompt.tsx";
import {QuestionPrompt} from "@/modules/sessions/components/promptDialog/components/questionPrompt.tsx";
import {TextPrompt} from "@/modules/sessions/components/promptDialog/components/textPrompt.tsx";
import {PROMPT_TAGS} from "@pkg/constants/src/sessionsView.constant.ts";

import type {WebviewPrompt} from "@views/sessions/sessions.view.type.ts";
import type {SubmitEvent} from "react";

interface PromptBodyProps {
  readonly onCancel: () => void;
  readonly onChoose: (choiceId: string, isSecondaryAction: boolean) => void;
  readonly onEnterText: (formEvent: SubmitEvent<HTMLFormElement>) => void;
  readonly prompt: WebviewPrompt;
}

export const PromptBody = (props: PromptBodyProps) => {
  if (props.prompt._tag === PROMPT_TAGS.CHOICE)
    return <ChoicePrompt choices={props.prompt.choices} onCancel={props.onCancel} onChoose={props.onChoose} />;
  if (props.prompt._tag === PROMPT_TAGS.QUESTION)
    return <QuestionPrompt answers={props.prompt.answers} onCancel={props.onCancel} onChoose={props.onChoose} />;

  return <TextPrompt onCancel={props.onCancel} onEnterText={props.onEnterText} value={props.prompt.value} />;
};
