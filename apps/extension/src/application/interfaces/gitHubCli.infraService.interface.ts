import {Context, Schema} from "effect";

import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {PullRequestStateValueObject} from "@valueObjects/pullRequestState.valueObject.ts";
import type {Effect, Stream} from "effect";

export interface PullRequestBranch {
  readonly branchName: string;
  readonly folderPath: ProjectPathValueObject;
}

export interface BranchPullRequest {
  readonly number: number;
  readonly state: PullRequestStateValueObject;
  readonly title: string;
  readonly url: string;
}

export class GitHubCliNotFoundError extends Schema.TaggedError<
  GitHubCliNotFoundError,
  {readonly brand: unique symbol}
>()("GitHubCliNotFoundError", {}) {}
export class GitHubCliSignedOutError extends Schema.TaggedError<
  GitHubCliSignedOutError,
  {readonly brand: unique symbol}
>()("GitHubCliSignedOutError", {}) {}
// None was found, it isn't looked up yet, or gh couldn't look; the lookup's span says which.
export class PullRequestNotFoundError extends Schema.TaggedError<
  PullRequestNotFoundError,
  {readonly brand: unique symbol}
>()("PullRequestNotFoundError", {}) {}

export type GitHubCliProblem = GitHubCliNotFoundError | GitHubCliSignedOutError;

// gh from PATH, never one of Aggregor's own; lookups are cached and run in the background.
export class IGitHubCliInfraService extends Context.Service<
  IGitHubCliInfraService,
  {
    // The last lookup's answer; a branch not looked up yet is looked up, and pullRequestChangedFolderPaths tells when.
    readonly findPullRequest: (
      pullRequestBranch: PullRequestBranch
    ) => Effect.Effect<BranchPullRequest, PullRequestNotFoundError>;
    // Each problem once per window, the first time a lookup meets it.
    readonly gitHubCliProblems: Stream.Stream<GitHubCliProblem>;
    // A terminal running gh's install or sign-in, which the user watches and answers.
    readonly openGitHubCliTerminal: (commandLine: string) => Effect.Effect<void>;
    readonly openPullRequestInBrowser: (pullRequest: BranchPullRequest) => Effect.Effect<void>;
    // Falls back to the browser without the GitHub Pull Requests extension.
    readonly openPullRequestInVsCode: (pullRequest: BranchPullRequest) => Effect.Effect<void>;
    readonly pullRequestChangedFolderPaths: Stream.Stream<ProjectPathValueObject>;
    readonly refreshPullRequest: (pullRequestBranch: PullRequestBranch) => Effect.Effect<void>;
  }
>()("aggregor-app/application/interfaces/gitHubCli.infraService.interface/IGitHubCliInfraService") {}
