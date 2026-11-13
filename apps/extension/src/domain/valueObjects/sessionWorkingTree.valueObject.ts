import {Schema} from "effect";

export const SessionWorkingTreeValueObjectSchema = Schema.Enum({
  PROJECT_ROOT: "projectRoot",
  WORKTREE: "worktree"
});

export const SESSION_WORKING_TREES = SessionWorkingTreeValueObjectSchema.enums;

export type SessionWorkingTreeValueObject = typeof SessionWorkingTreeValueObjectSchema.Type;
