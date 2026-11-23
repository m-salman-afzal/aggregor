import {Context, Effect, Layer, Schema, String} from "effect";

import {PULL_REQUEST_STATES, PullRequestStateValueObjectSchema} from "@/valueObjects/pullRequestState.valueObject.ts";

import type {BranchPullRequest, ListedPullRequest} from "@/interfaces/gitHubCli.infraService.interface.ts";

const GitHubCliPullRequestJson = Schema.fromJsonString(
  Schema.Struct({
    isDraft: Schema.Boolean,
    number: Schema.Int,
    state: Schema.String,
    title: Schema.String,
    url: Schema.String
  })
);

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
    make: Effect.fn("GitHubCliTransformer.make")(function* () {
      const decodePullRequestState = Effect.fn("GitHubCliTransformer.decodePullRequestState")(function* (
        gitHubCliState: string,
        isDraft: boolean
      ) {
        const pullRequestState = yield* Schema.decodeUnknownEffect(PullRequestStateValueObjectSchema)(
          String.toLowerCase(gitHubCliState)
        );

        return isDraft && pullRequestState === PULL_REQUEST_STATES.OPEN ? PULL_REQUEST_STATES.DRAFT : pullRequestState;
      });

      const decodeBranchPullRequest = Effect.fn("GitHubCliTransformer.decodeBranchPullRequest")(function* (
        gitHubCliOutput: string
      ) {
        const gitHubCliPullRequest = yield* Schema.decodeEffect(GitHubCliPullRequestJson)(gitHubCliOutput);
        const branchPullRequest: BranchPullRequest = {
          number: gitHubCliPullRequest.number,
          state: yield* decodePullRequestState(gitHubCliPullRequest.state, gitHubCliPullRequest.isDraft),
          title: gitHubCliPullRequest.title,
          url: gitHubCliPullRequest.url
        };

        return branchPullRequest;
      });

      const decodeListedPullRequests = Effect.fn("GitHubCliTransformer.decodeListedPullRequests")(function* (
        gitHubCliOutput: string
      ) {
        const gitHubCliPullRequests = yield* Schema.decodeEffect(GitHubCliPullRequestListJson)(gitHubCliOutput);

        return yield* Effect.forEach(gitHubCliPullRequests, (gitHubCliPullRequest) =>
          Effect.map(decodePullRequestState(gitHubCliPullRequest.state, gitHubCliPullRequest.isDraft), (state) => {
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

      return {decodeBranchPullRequest, decodeListedPullRequests};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make());
}
