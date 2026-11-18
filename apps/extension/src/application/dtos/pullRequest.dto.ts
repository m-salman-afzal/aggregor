import {PULL_REQUEST_LIST_PROBLEMS} from "@pkg/constants/src/gitHubCli.constant.ts";
import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {PullRequestStateValueObjectSchema} from "@valueObjects/pullRequestState.valueObject.ts";
import {Schema} from "effect";

export const OpenSessionPullRequestRequestDtoSchema = Schema.Struct({sessionId: EntityIdValueObjectSchema});

export type OpenSessionPullRequestRequestDto = typeof OpenSessionPullRequestRequestDtoSchema.Type;

export const LinkSessionPullRequestRequestDtoSchema = Schema.Struct({
  pullRequestNumber: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  sessionId: EntityIdValueObjectSchema
});

export type LinkSessionPullRequestRequestDto = typeof LinkSessionPullRequestRequestDtoSchema.Type;

export const UnlinkSessionPullRequestRequestDtoSchema = Schema.Struct({sessionId: EntityIdValueObjectSchema});

export type UnlinkSessionPullRequestRequestDto = typeof UnlinkSessionPullRequestRequestDtoSchema.Type;

export const ListSessionPullRequestsRequestDtoSchema = Schema.Struct({sessionId: EntityIdValueObjectSchema});

export type ListSessionPullRequestsRequestDto = typeof ListSessionPullRequestsRequestDtoSchema.Type;

export const ListedPullRequestDtoSchema = Schema.Struct({
  branchName: Schema.String,
  number: Schema.Int,
  state: PullRequestStateValueObjectSchema,
  title: Schema.String
});

export type ListedPullRequestDto = typeof ListedPullRequestDtoSchema.Type;

// With a problem, gh listed nothing: it isn't signed in, or it couldn't list this repository's pull requests.
export const SessionPullRequestsDtoSchema = Schema.Struct({
  listProblem: Schema.optional(
    Schema.Literals([PULL_REQUEST_LIST_PROBLEMS.FAILED, PULL_REQUEST_LIST_PROBLEMS.SIGNED_OUT])
  ),
  pullRequests: Schema.Array(ListedPullRequestDtoSchema),
  sessionId: EntityIdValueObjectSchema
});

export type SessionPullRequestsDto = typeof SessionPullRequestsDtoSchema.Type;
