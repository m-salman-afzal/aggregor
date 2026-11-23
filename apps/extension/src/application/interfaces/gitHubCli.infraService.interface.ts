import {Context} from "effect";

import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";

import type {Effect, Stream} from "effect";

import type {ProjectPathValueObject} from "@/valueObjects/projectPath.valueObject.ts";
import type {PullRequestStateValueObject} from "@/valueObjects/pullRequestState.valueObject.ts";

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
  PullRequestListFailedError: {},
  PullRequestNotFoundError: {}
}) {}

export class IGitHubCliInfraService extends Context.Service<
  IGitHubCliInfraService,
  {
    // The last lookup's answer; one not looked up yet is looked up, and pullRequestChangedFolderPaths tells when.
    readonly findPullRequest: (
      pullRequestLookup: PullRequestLookup
    ) => Effect.Effect<BranchPullRequest, IGitHubCliInfraServiceErrors["PullRequestNotFoundError"]>;
    readonly gitHubCliSignedOutProblems: Stream.Stream<IGitHubCliInfraServiceErrors["GitHubCliSignedOutError"]>;
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
