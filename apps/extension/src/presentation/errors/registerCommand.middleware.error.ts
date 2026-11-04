import {Data} from "effect";

// What VS Code passed a command is not what its menu entry sends.
export class InvalidCommandArgumentsError extends Data.TaggedError("InvalidCommandArgumentsError")<{
  readonly cause: unknown;
}> {}
