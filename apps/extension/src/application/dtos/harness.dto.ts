import {HarnessIconValueObjectSchema} from "@valueObjects/harnessIcon.valueObject.ts";
import {HarnessIdValueObjectSchema} from "@valueObjects/harnessId.valueObject.ts";
import {Schema} from "effect";

// What crosses between the harness picker and the session use cases.

// A harness as the picker lists it.
export const HarnessListItemDtoSchema = Schema.Struct({
  command: Schema.NonEmptyString,
  harnessId: HarnessIdValueObjectSchema,
  icon: HarnessIconValueObjectSchema,
  isDefault: Schema.Boolean,
  name: Schema.NonEmptyString
});

export type HarnessListItemDto = typeof HarnessListItemDtoSchema.Type;
