import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {PULL_REQUEST_STATES, PullRequestStateValueObjectSchema} from "@valueObjects/pullRequestState.valueObject.ts";
import {Context, Effect, Layer, Schema, String} from "effect";

import type {BranchPullRequest, ListedPullRequest} from "@interfaces/gitHubCli.infraService.interface.ts";

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

// What `gh pr list --json number,state,isDraft,title,headRefName` prints.
const GitHubCliPullRequestListJson = Schema.fromJsonString(
  Schema.Array(
    Schema.Struct({
      headRefName: Schema.String,
      isDraft: Schema.Boolean,
      number: Schema.Int,
      state: Schema.String,
      title: Schema.String
    })
  )
);

export class GitHubCliTransformer extends Context.Service<GitHubCliTransformer>()(
  "aggregor-app/infrastructure/services/gitHubCli/gitHubCli.transformer/GitHubCliTransformer",
  {
    make: Effect.fn("make")(function* () {
      const toPullRequestState = Effect.fn("toPullRequestState")(function* (gitHubCliState: string, isDraft: boolean) {
        const pullRequestState = yield* Schema.decodeUnknownEffect(PullRequestStateValueObjectSchema)(
          String.toLowerCase(gitHubCliState)
        );

        return isDraft && pullRequestState === PULL_REQUEST_STATES.OPEN ? PULL_REQUEST_STATES.DRAFT : pullRequestState;
      });

      const toBranchPullRequest = Effect.fn("toBranchPullRequest")(function* (gitHubCliOutput: string) {
        const gitHubCliPullRequest = yield* Schema.decodeEffect(GitHubCliPullRequestJson)(gitHubCliOutput);
        const branchPullRequest: BranchPullRequest = {
          number: gitHubCliPullRequest.number,
          state: yield* toPullRequestState(gitHubCliPullRequest.state, gitHubCliPullRequest.isDraft),
          title: gitHubCliPullRequest.title,
          url: gitHubCliPullRequest.url
        };

        return branchPullRequest;
      });

      const toListedPullRequests = Effect.fn("toListedPullRequests")(function* (gitHubCliOutput: string) {
        const gitHubCliPullRequests = yield* Schema.decodeEffect(GitHubCliPullRequestListJson)(gitHubCliOutput);

        return yield* Effect.forEach(gitHubCliPullRequests, (gitHubCliPullRequest) =>
          Effect.map(toPullRequestState(gitHubCliPullRequest.state, gitHubCliPullRequest.isDraft), (state) => {
            const listedPullRequest: ListedPullRequest = {
              branchName: gitHubCliPullRequest.headRefName,
              number: gitHubCliPullRequest.number,
              state,
              title: gitHubCliPullRequest.title
            };

            return listedPullRequest;
          })
        );
      });

      return {toBranchPullRequest, toListedPullRequests};
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("GitHubCliTransformer", this.make()));
}
