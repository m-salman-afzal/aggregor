import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {Context} from "effect";

import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {PullRequestStateValueObject} from "@valueObjects/pullRequestState.valueObject.ts";
import type {Effect, Stream} from "effect";

// gh pr view takes a branch's name or a pull request's number alike.
export interface PullRequestLookup {
  readonly folderPath: ProjectPathValueObject;
  readonly pullRequestReference: string;
}

export interface BranchPullRequest {
  readonly number: number;
  readonly state: PullRequestStateValueObject;
  readonly title: string;
  readonly url: string;
}

export interface ListedPullRequest {
  readonly branchName: string;
  readonly number: number;
  readonly state: PullRequestStateValueObject;
  readonly title: string;
}

export class IGitHubCliInfraServiceErrors extends TaggedErrors({
  GitHubCliSignedOutError: {},
  // gh is missing, the folder has no GitHub repository, or gh gave up; the listing's span says which.
  PullRequestListFailedError: {},
  // None was found, it isn't looked up yet, or gh couldn't look or isn't installed; the lookup's span says which.
  PullRequestNotFoundError: {}
}) {}

// gh from PATH, never one of Aggregor's own; lookups are cached and run in the background.
export class IGitHubCliInfraService extends Context.Service<
  IGitHubCliInfraService,
  {
    // The last lookup's answer; one not looked up yet is looked up, and pullRequestChangedFolderPaths tells when.
    readonly findPullRequest: (
      pullRequestLookup: PullRequestLookup
    ) => Effect.Effect<BranchPullRequest, IGitHubCliInfraServiceErrors["PullRequestNotFoundError"]>;
    // Once per window, the first time a lookup meets it, and again after the setup terminal closes.
    readonly gitHubCliSignedOutProblems: Stream.Stream<IGitHubCliInfraServiceErrors["GitHubCliSignedOutError"]>;
    // The repository's newest pull requests, any state, read from GitHub each time.
    readonly listPullRequests: (
      folderPath: ProjectPathValueObject
    ) => Effect.Effect<
      readonly ListedPullRequest[],
      IGitHubCliInfraServiceErrors["GitHubCliSignedOutError" | "PullRequestListFailedError"]
    >;
    readonly openPullRequestInBrowser: (pullRequest: BranchPullRequest) => Effect.Effect<void>;
    // Falls back to the browser without the GitHub Pull Requests extension.
    readonly openPullRequestInVsCode: (pullRequest: BranchPullRequest) => Effect.Effect<void>;
    readonly pullRequestChangedFolderPaths: Stream.Stream<ProjectPathValueObject>;
    readonly refreshPullRequest: (pullRequestLookup: PullRequestLookup) => Effect.Effect<void>;
  }
>()("aggregor-app/application/interfaces/gitHubCli.infraService.interface/IGitHubCliInfraService") {}
