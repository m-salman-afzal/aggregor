import {GITHUB_CLI_LABELS, PULL_REQUEST_LIST_NOTICES} from "@pkg/constants/src/gitHubCli.constant.ts";

import type {SessionPullRequestsDto} from "@dtos/pullRequest.dto.ts";

// No notice means there are pull requests to pick from.
export const findPullRequestNotice = (pullRequests: SessionPullRequestsDto | undefined) => {
  if (pullRequests === undefined) return GITHUB_CLI_LABELS.LISTING;
  if (pullRequests.listProblem !== undefined) return PULL_REQUEST_LIST_NOTICES[pullRequests.listProblem];
  if (pullRequests.pullRequests.length === 0) return GITHUB_CLI_LABELS.NONE_LISTED;

  return undefined;
};
