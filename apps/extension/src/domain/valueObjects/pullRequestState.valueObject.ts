import {Schema} from "effect";

export const PullRequestStateValueObjectSchema = Schema.Enum({
  CLOSED: "closed",
  DRAFT: "draft",
  MERGED: "merged",
  OPEN: "open"
});

export const PULL_REQUEST_STATES = PullRequestStateValueObjectSchema.enums;

export type PullRequestStateValueObject = typeof PullRequestStateValueObjectSchema.Type;
