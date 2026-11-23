import {useState} from "react";

import {
  chooseNewSessionParts,
  findMovedSessionChoices,
  findNewWorktreesRootPath,
  makeChangeWorkingTreeRequest,
  makeOptionGroups
} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/newSessionInput.utils.ts";
import {useSessionsStore} from "@/modules/sessions/stores/sessions/sessions.store.ts";

import type {SubmitEvent} from "react";

import type {NewSessionChoices} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/newSessionInput.type.ts";
import type {USER_INPUT_TAGS} from "@/modules/sessions/sessions.constant.ts";
import type {UserInput} from "@/modules/sessions/sessions.type.ts";

interface UseWorkingTreeInputProps {
  readonly userInput: Extract<UserInput, {readonly _tag: typeof USER_INPUT_TAGS.WORKING_TREE}>;
}

export const useWorkingTreeInput = (props: UseWorkingTreeInputProps) => {
  const projectRows = useSessionsStore({selectFromState: (sessionsState) => sessionsState.projectRows});
  const archiveProjectRows = useSessionsStore({selectFromState: (sessionsState) => sessionsState.archiveProjectRows});
  const moveSessionToWorkingTree = useSessionsStore({
    selectFromState: (sessionsState) => sessionsState.moveSessionToWorkingTree
  });
  const [choices, setChoices] = useState(() => findMovedSessionChoices(props.userInput.movedSession));
  const choose = (chosenParts: Partial<NewSessionChoices>) => {
    chooseNewSessionParts(choices, chosenParts, setChoices);
  };
  const move = (formEvent: SubmitEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    moveSessionToWorkingTree(makeChangeWorkingTreeRequest(props.userInput.movedSession, choices));
  };

  return {
    move,
    newWorktreesRootPath: findNewWorktreesRootPath(projectRows, choices),
    optionGroups: makeOptionGroups({
      agentRows: [],
      allProjectRows: [...projectRows, ...archiveProjectRows],
      branches: props.userInput.branches,
      choices,
      choose,
      isAgentShown: false,
      isProjectShown: false,
      movedSession: props.userInput.movedSession,
      projectRows
    })
  };
};
