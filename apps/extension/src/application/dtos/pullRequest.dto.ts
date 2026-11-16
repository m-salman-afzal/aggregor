import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {Schema} from "effect";

export const OpenSessionPullRequestRequestDtoSchema = Schema.Struct({sessionId: EntityIdValueObjectSchema});

export type OpenSessionPullRequestRequestDto = typeof OpenSessionPullRequestRequestDtoSchema.Type;

// Without an install command, no package manager Aggregor knows is on PATH.
export const GitHubCliProblemDtoSchema = Schema.TaggedUnion({
  GitHubCliMissing: {installCommandLine: Schema.optional(Schema.String)},
  GitHubCliSignedOut: {}
});

export type GitHubCliProblemDto = typeof GitHubCliProblemDtoSchema.Type;
