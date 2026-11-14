import {CleanUpInput} from "@/modules/sessions/components/userInputDialog/components/cleanUpInput/cleanUpInput.tsx";
import {NewSessionInput} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/newSessionInput.tsx";
import {ProjectSettingsInput} from "@/modules/sessions/components/userInputDialog/components/projectSettingsInput/projectSettingsInput.tsx";
import {QuestionInput} from "@/modules/sessions/components/userInputDialog/components/questionInput.tsx";
import {TextInput} from "@/modules/sessions/components/userInputDialog/components/textInput.tsx";
import {USER_INPUT_TAGS} from "@/modules/sessions/sessions.constant.ts";

import type {ChosenLeftovers, UserInput} from "@/modules/sessions/sessions.type.ts";
import type {CommandRequest} from "@views/sessions/sessions.view.type.ts";
import type {SubmitEvent} from "react";

interface UserInputBodyProps {
  readonly onCancel: () => void;
  readonly onChoose: (choiceId: string, isSecondaryAction: boolean) => void;
  readonly onCleanUp: (chosenLeftovers: ChosenLeftovers) => void;
  readonly onEnterText: (formEvent: SubmitEvent<HTMLFormElement>) => void;
  readonly onSaveSettings: (formEvent: SubmitEvent<HTMLFormElement>) => void;
  readonly onStart: (newSessionRequest: CommandRequest) => void;
  readonly userInput: UserInput;
}

export const UserInputBody = (props: UserInputBodyProps) => {
  if (props.userInput._tag === USER_INPUT_TAGS.NEW_SESSION)
    return (
      <NewSessionInput
        chosenProjectPath={props.userInput.chosenProjectPath}
        onCancel={props.onCancel}
        onStart={props.onStart}
      />
    );
  if (props.userInput._tag === USER_INPUT_TAGS.CLEAN_UP)
    return <CleanUpInput leftovers={props.userInput.leftovers} onCancel={props.onCancel} onDelete={props.onCleanUp} />;
  if (props.userInput._tag === USER_INPUT_TAGS.QUESTION)
    return <QuestionInput answers={props.userInput.answers} onCancel={props.onCancel} onChoose={props.onChoose} />;
  if (props.userInput._tag === USER_INPUT_TAGS.PROJECT_SETTINGS)
    return (
      <ProjectSettingsInput
        onCancel={props.onCancel}
        onSave={props.onSaveSettings}
        settings={props.userInput.settings}
      />
    );

  return <TextInput onCancel={props.onCancel} onEnterText={props.onEnterText} value={props.userInput.value} />;
};
