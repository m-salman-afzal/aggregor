import {Schema} from "effect";

// Which agent CLI a session runs: its key in aggregorApp.harnesses, such as claude.
export const HarnessIdValueObjectSchema = Schema.NonEmptyString.pipe(Schema.brand("HarnessId"));

export type HarnessIdValueObject = typeof HarnessIdValueObjectSchema.Type;
