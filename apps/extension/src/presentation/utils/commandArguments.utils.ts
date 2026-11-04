import {InvalidCommandArgumentsError} from "@/presentation/middlewares/registerCommand/registerCommand.middleware.error.ts";
import {Effect, Schema} from "effect";

// VS Code passes command arguments untyped; each controller decodes the ones its menu entry sends.
export const decodeCommandArgument = Effect.fn("decodeCommandArgument")(function* <
  ArgumentSchema extends Schema.Constraint
>(argumentSchema: ArgumentSchema, commandArgument: unknown) {
  return yield* Effect.mapError(
    Schema.decodeUnknownEffect(argumentSchema)(commandArgument),
    (cause) => new InvalidCommandArgumentsError({cause})
  );
});
