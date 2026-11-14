import {
  SESSION_WORKING_TREES,
  SessionWorkingTreeValueObjectSchema
} from "@valueObjects/sessionWorkingTree.valueObject.ts";
import {Effect, Schema} from "effect";

// A key missing, or holding a value that no longer decodes, takes its default, so a stored project always reads.
export const ProjectSettingsValueObjectSchema = Schema.Struct({
  filesToCopy: Schema.Array(Schema.String).pipe(
    Schema.catchDecoding(() => Effect.succeedSome([".env*"])),
    Schema.withDecodingDefaultKey(Effect.succeed([".env*"]))
  ),
  newSessionWorkingTree: SessionWorkingTreeValueObjectSchema.pipe(
    Schema.catchDecoding(() => Effect.succeedSome(SESSION_WORKING_TREES.PROJECT_ROOT)),
    Schema.withDecodingDefaultKey(Effect.succeed(SESSION_WORKING_TREES.PROJECT_ROOT))
  ),
  setupScript: Schema.String.pipe(
    Schema.catchDecoding(() => Effect.succeedSome("")),
    Schema.withDecodingDefaultKey(Effect.succeed(""))
  ),
  worktreeFolder: Schema.String.pipe(
    Schema.catchDecoding(() => Effect.succeedSome("")),
    Schema.withDecodingDefaultKey(Effect.succeed(""))
  )
});

export type ProjectSettingsValueObject = typeof ProjectSettingsValueObjectSchema.Type;
