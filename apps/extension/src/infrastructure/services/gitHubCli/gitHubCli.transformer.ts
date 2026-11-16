import {PULL_REQUEST_STATES, PullRequestStateValueObjectSchema} from "@valueObjects/pullRequestState.valueObject.ts";
import {Effect, Schema, String} from "effect";

import type {BranchPullRequest} from "@interfaces/gitHubCli.infraService.interface.ts";

// What `gh pr view --json number,url,state,isDraft,title` prints; its states are ours in upper case, a draft is open.
const GitHubCliPullRequestJson = Schema.fromJsonString(
  Schema.Struct({
    isDraft: Schema.Boolean,
    number: Schema.Int,
    state: Schema.String,
    title: Schema.String,
    url: Schema.String
  })
);

export const toBranchPullRequest = Effect.fn("GitHubCliInfraService.toBranchPullRequest")(function* (
  gitHubCliOutput: string
) {
  const gitHubCliPullRequest = yield* Schema.decodeEffect(GitHubCliPullRequestJson)(gitHubCliOutput);
  const pullRequestState = yield* Schema.decodeUnknownEffect(PullRequestStateValueObjectSchema)(
    String.toLowerCase(gitHubCliPullRequest.state)
  );
  const branchPullRequest: BranchPullRequest = {
    number: gitHubCliPullRequest.number,
    state:
      gitHubCliPullRequest.isDraft && pullRequestState === PULL_REQUEST_STATES.OPEN
        ? PULL_REQUEST_STATES.DRAFT
        : pullRequestState,
    title: gitHubCliPullRequest.title,
    url: gitHubCliPullRequest.url
  };

  return branchPullRequest;
});
