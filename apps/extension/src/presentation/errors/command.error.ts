import {Data} from "effect";

// What VS Code passed a command is not what its menu entry sends.
export class InvalidCommandArguments extends Data.TaggedError("InvalidCommandArguments")<{readonly cause: unknown}> {}
