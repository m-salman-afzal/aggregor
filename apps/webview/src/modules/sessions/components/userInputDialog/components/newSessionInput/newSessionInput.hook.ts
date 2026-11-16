import {
  chooseNewSessionParts,
  findDefaultChoices,
  findNewWorktreesRootPath,
  isAgentChoiceShown,
  makeNewSessionRequest,
  makeOptionGroups
} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/newSessionInput.utils.ts";
import {useSessionsStore} from "@/modules/sessions/stores/sessions/sessions.store.ts";
import {useState} from "react";

import type {NewSessionChoices} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/newSessionInput.type.ts";
import type {ProjectBranchesDto} from "@dtos/worktree.dto.ts";
import type {CommandRequest} from "@views/sessions/sessions.view.type.ts";
import type {SubmitEvent} from "react";

interface UseNewSessionInputProps {
  readonly branches: ProjectBranchesDto | undefined;
  readonly chosenProjectPath?: string | undefined;
  readonly onStart: (newSessionRequest: CommandRequest) => void;
}

export const useNewSessionInput = (props: UseNewSessionInputProps) => {
  const projectRows = useSessionsStore({selectFromState: (sessionsState) => sessionsState.projectRows});
  const archiveProjectRows = useSessionsStore({selectFromState: (sessionsState) => sessionsState.archiveProjectRows});
  const agentRows = useSessionsStore({selectFromState: (sessionsState) => sessionsState.agentRows});
  const skipAgentPicker = useSessionsStore({selectFromState: (sessionsState) => sessionsState.skipAgentPicker});
  const [choices, setChoices] = useState<NewSessionChoices>(() =>
    findDefaultChoices(props.chosenProjectPath, projectRows, agentRows)
  );
  const isAgentShown = isAgentChoiceShown(agentRows, skipAgentPicker);

  return {
    newWorktreesRootPath: findNewWorktreesRootPath(projectRows, choices),
    optionGroups: makeOptionGroups({
      agentRows,
      allProjectRows: [...projectRows, ...archiveProjectRows],
      branches: props.branches,
      choices,
      choose: (chosenParts) => {
        chooseNewSessionParts(choices, chosenParts, setChoices);
      },
      isAgentShown,
      isProjectShown: props.chosenProjectPath === undefined && projectRows.length > 1,
      projectRows
    }),
    start: (formEvent: SubmitEvent<HTMLFormElement>) => {
      formEvent.preventDefault();
      props.onStart(makeNewSessionRequest(choices, isAgentShown ? choices.agentId : undefined));
    }
  };
};
