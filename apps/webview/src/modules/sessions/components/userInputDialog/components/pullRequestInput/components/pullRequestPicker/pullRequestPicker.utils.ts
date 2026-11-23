import {GITHUB_CLI_LABELS} from "@pkg/constants/src/gitHubCli.constant.ts";
import {SESSION_LABELS} from "@pkg/constants/src/session.constant.ts";
import {PULL_REQUEST_STATE_LABELS} from "@pkg/constants/src/sessionsView.constant.ts";

import type {ListedPullRequestDto} from "@/dtos/pullRequest.dto.ts";
import type {SessionListItemDto} from "@/dtos/session.dto.ts";
import type {UserInputOption} from "@/modules/sessions/sessions.type.ts";

export const makePullRequestOptions = (
  pullRequests: readonly ListedPullRequestDto[],
  linkedSession: SessionListItemDto
): readonly UserInputOption[] =>
  pullRequests.map((pullRequest) => ({
    ...(pullRequest.number === linkedSession.pullRequest?.number ? {badge: SESSION_LABELS.CURRENT} : {}),
    description: `${pullRequest.branchName} · ${PULL_REQUEST_STATE_LABELS[pullRequest.state]}`,
    label: GITHUB_CLI_LABELS.PULL_REQUEST_OPTION(pullRequest.number, pullRequest.title),
    optionId: `${pullRequest.number}`
  }));

export const findDefaultPullRequestId = (
  pullRequests: readonly ListedPullRequestDto[],
  linkedSession: SessionListItemDto
) => {
  const shownPullRequest =
    pullRequests.find((pullRequest) => pullRequest.number === linkedSession.pullRequest?.number) ?? pullRequests[0];

  return shownPullRequest === undefined ? "" : `${shownPullRequest.number}`;
};
