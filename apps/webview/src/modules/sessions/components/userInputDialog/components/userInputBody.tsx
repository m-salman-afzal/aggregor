import {ChoiceInput} from "@/modules/sessions/components/userInputDialog/components/choiceInput.tsx";
import {QuestionInput} from "@/modules/sessions/components/userInputDialog/components/questionInput.tsx";
import {TextInput} from "@/modules/sessions/components/userInputDialog/components/textInput.tsx";
import {USER_INPUT_TAGS} from "@/modules/sessions/sessions.constant.ts";

import type {UserInput} from "@/modules/sessions/sessions.type.ts";
import type {SubmitEvent} from "react";

interface UserInputBodyProps {
  readonly onCancel: () => void;
  readonly onChoose: (choiceId: string, isSecondaryAction: boolean) => void;
  readonly onEnterText: (formEvent: SubmitEvent<HTMLFormElement>) => void;
  readonly userInput: UserInput;
}

export const UserInputBody = (props: UserInputBodyProps) => {
  if (props.userInput._tag === USER_INPUT_TAGS.CHOICE)
    return <ChoiceInput choices={props.userInput.choices} onCancel={props.onCancel} onChoose={props.onChoose} />;
  if (props.userInput._tag === USER_INPUT_TAGS.QUESTION)
    return <QuestionInput answers={props.userInput.answers} onCancel={props.onCancel} onChoose={props.onChoose} />;

  return <TextInput onCancel={props.onCancel} onEnterText={props.onEnterText} value={props.userInput.value} />;
};
