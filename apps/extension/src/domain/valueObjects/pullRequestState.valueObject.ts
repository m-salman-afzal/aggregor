import {Schema} from "effect";

// GitHub's open, merged and closed, with a draft told apart from an open pull request ready for review.
export const PullRequestStateValueObjectSchema = Schema.Enum({
  CLOSED: "closed",
  DRAFT: "draft",
  MERGED: "merged",
  OPEN: "open"
});

export const PULL_REQUEST_STATES = PullRequestStateValueObjectSchema.enums;

export type PullRequestStateValueObject = typeof PullRequestStateValueObjectSchema.Type;
