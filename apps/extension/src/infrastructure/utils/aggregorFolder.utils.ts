import {NodeServices} from "@effect/platform-node";
import {AGGREGOR_FOLDER} from "@pkg/constants/src/app.constant.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {Config, Context, Effect, Layer, Schema} from "effect";
import {Path} from "effect/Path";
import {homedir} from "node:os";

export class AggregorFolderUtils extends Context.Service<AggregorFolderUtils>()(
  "aggregor-app/infrastructure/utils/aggregorFolder.utils/AggregorFolderUtils",
  {
    make: Effect.fn("make")(function* () {
      const path = yield* Path;

      // A relative path would resolve against wherever VS Code started, so it fails, with the variable's name in the error.
      const readAbsolutePathVariable = Effect.fn("readAbsolutePathVariable")(function* (
        variableName: string,
        defaultPath: string
      ) {
        const absolutePathSchema = Schema.String.check(
          Schema.makeFilter((configuredPath: string) => path.isAbsolute(configuredPath), {
            expected: "an absolute path"
          })
        );

        return yield* Config.withDefault(Config.schema(absolutePathSchema, variableName), defaultPath);
      });

      const getAggregorFolderPath = Effect.fn("getAggregorFolderPath")(function* () {
        return yield* readAbsolutePathVariable(
          AGGREGOR_FOLDER.ENVIRONMENT_VARIABLE,
          path.join(homedir(), AGGREGOR_FOLDER.DEFAULT_NAME)
        );
      });

      return {getAggregorFolderPath: getAggregorFolderPath(), readAbsolutePathVariable};
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("AggregorFolderUtils", this.make())).pipe(
    Layer.provide(NodeServices.layer)
  );
}
