import {
  findDefaultPullRequestId,
  toPullRequestOptions
} from "@/modules/sessions/components/userInputDialog/components/pullRequestInput/components/pullRequestPicker/pullRequestPicker.utils.ts";
import {useSessionsStore} from "@/modules/sessions/stores/sessions/sessions.store.ts";
import {useState} from "react";

import type {ListedPullRequestDto} from "@dtos/pullRequest.dto.ts";
import type {SessionListItemDto} from "@dtos/session.dto.ts";
import type {SubmitEvent} from "react";

interface UsePullRequestPickerProps {
  readonly linkedSession: SessionListItemDto;
  readonly pullRequests: readonly ListedPullRequestDto[];
}

export const usePullRequestPicker = (props: UsePullRequestPickerProps) => {
  const linkChosenPullRequest = useSessionsStore({
    selectFromState: (sessionsState) => sessionsState.linkChosenPullRequest
  });
  const [chosenPullRequestId, setChosenPullRequestId] = useState(() =>
    findDefaultPullRequestId(props.pullRequests, props.linkedSession)
  );
  const link = (formEvent: SubmitEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    linkChosenPullRequest(Number(chosenPullRequestId));
  };

  return {
    chooseOption: setChosenPullRequestId,
    chosenPullRequestId,
    link,
    pullRequestOptions: toPullRequestOptions(props.pullRequests, props.linkedSession)
  };
};
