import {Schema} from "effect";

// How an agent looks in its sessions' rows and tabs: a codicon, or an image file.
export const HarnessIconValueObjectSchema = Schema.TaggedUnion({
  CodiconIcon: {codiconId: Schema.NonEmptyString},
  FileIcon: {filePath: Schema.NonEmptyString}
});

export type HarnessIconValueObject = typeof HarnessIconValueObjectSchema.Type;
