import {Schema} from "effect";

import type {Cause} from "effect";

type ErrorFieldsByTag = Readonly<Record<string, Schema.Struct.Fields>>;

type TaggedErrorClasses<FieldsByTag extends ErrorFieldsByTag> = {
  readonly [ErrorTag in keyof FieldsByTag & string]: Schema.Class<
    TaggedErrorOf<ErrorTag, FieldsByTag[ErrorTag]>,
    Schema.TaggedStruct<ErrorTag, FieldsByTag[ErrorTag]>,
    Cause.YieldableError
  >;
};

type TaggedErrorOf<ErrorTag extends string, ErrorFields extends Schema.Struct.Fields> = Cause.YieldableError &
  Schema.TaggedStruct<ErrorTag, ErrorFields>["Type"];

// The instance side is never built: it only carries each error's type, read as `UnitErrors["SomeError"]`.
type TaggedErrorTypes<FieldsByTag extends ErrorFieldsByTag> = {
  readonly [ErrorTag in keyof FieldsByTag & string]: TaggedErrorOf<ErrorTag, FieldsByTag[ErrorTag]>;
};

// oxlint-disable-next-line eslint-js/no-restricted-syntax -- builds a unit's errors when its file loads, outside any effect, so it cannot be an Effect.fn inside a make
export const TaggedErrors = <const FieldsByTag extends ErrorFieldsByTag>(
  fieldsByTag: FieldsByTag
): TaggedErrorClasses<FieldsByTag> & (new () => TaggedErrorTypes<FieldsByTag>) => {
  const errorClassEntries = Object.entries(fieldsByTag).map(
    ([errorTag, errorFields]) => [errorTag, Schema.TaggedError()(errorTag, errorFields)] as const
  );

  // oxlint-disable-next-line typescript/consistent-type-assertions, typescript/no-unsafe-type-assertion, typescript/no-extraneous-class -- one class per key is built at run time, which no type can follow; the empty class only carries them as statics
  return Object.assign(class TaggedErrorHolder {}, Object.fromEntries(errorClassEntries)) as never;
};
