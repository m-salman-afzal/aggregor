import {AGGREGOR_FOLDER} from "@pkg/constants/src/app.constant.ts";
import {Config, Effect, Schema} from "effect";
import {Path} from "effect/Path";
import {homedir} from "node:os";

// A relative path would resolve against wherever VS Code started, so it fails, with the variable's name in the error.
export const readAbsolutePathVariable = Effect.fn("readAbsolutePathVariable")(function* (
  variableName: string,
  defaultPath: string
) {
  const path = yield* Path;
  const absolutePathSchema = Schema.String.check(
    Schema.makeFilter((configuredPath: string) => path.isAbsolute(configuredPath), {expected: "an absolute path"})
  );

  return yield* Config.withDefault(Config.schema(absolutePathSchema, variableName), defaultPath);
});

// Where Aggregor keeps its files: data/ holds the database and aggregor-pty's log, anchor/ the window's anchor folder.
export const getAggregorFolderPath = Effect.fn("getAggregorFolderPath")(function* () {
  const path = yield* Path;

  return yield* readAbsolutePathVariable(
    AGGREGOR_FOLDER.ENVIRONMENT_VARIABLE,
    path.join(homedir(), AGGREGOR_FOLDER.DEFAULT_NAME)
  );
});
