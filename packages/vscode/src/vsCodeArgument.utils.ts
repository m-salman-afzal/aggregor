import {Effect, Schema} from "effect";

export class InvalidVsCodeArgumentError extends Schema.TaggedError<
  InvalidVsCodeArgumentError,
  {readonly brand: unique symbol}
>()("InvalidVsCodeArgumentError", {cause: Schema.Unknown}) {}

// VS Code passes arguments untyped; each caller decodes the ones its menu entry or view sends.
export const decodeVsCodeArgument = Effect.fn("decodeVsCodeArgument")(function* <
  ArgumentSchema extends Schema.Constraint
>(argumentSchema: ArgumentSchema, vsCodeArgument: unknown) {
  return yield* Effect.mapError(Schema.decodeUnknownEffect(argumentSchema)(vsCodeArgument), (cause) =>
    InvalidVsCodeArgumentError.make({cause})
  );
});
