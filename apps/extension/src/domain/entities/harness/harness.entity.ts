import {HarnessIconValueObjectSchema} from "@valueObjects/harnessIcon.valueObject.ts";
import {HarnessIdValueObjectSchema} from "@valueObjects/harnessId.valueObject.ts";
import {Schema} from "effect";

// An agent CLI the user can start sessions with, identified by its settings key; editing its command or arguments keeps
// it the same harness. It lives in settings, not in the database, so it has no BaseEntity columns. `args` start a new
// session and `resumeArgs` reopen one that has worked.
export class HarnessEntity extends Schema.Class<HarnessEntity, {readonly brand: unique symbol}>("Harness")({
  args: Schema.Array(Schema.String),
  command: Schema.NonEmptyString,
  icon: HarnessIconValueObjectSchema,
  id: HarnessIdValueObjectSchema,
  name: Schema.NonEmptyString,
  resumeArgs: Schema.Array(Schema.String)
}) {}
