import {homedir} from "node:os";

import {NodeServices} from "@effect/platform-node";
import {Config, Context, Effect, Layer, Schema} from "effect";
import {Path} from "effect/Path";

import {AGGREGOR_FOLDER} from "@pkg/constants/src/app.constant.ts";

export class AggregorFolderUtils extends Context.Service<AggregorFolderUtils>()(
  "aggregor-app/infrastructure/utils/aggregorFolder.utils/AggregorFolderUtils",
  {
    make: Effect.fn("AggregorFolderUtils.make")(function* () {
      const path = yield* Path;

      // A relative path would resolve against wherever VS Code started, so it fails, with the variable's name in the error.
      const readAbsolutePathVariable = Effect.fn("AggregorFolderUtils.readAbsolutePathVariable")(function* (
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

      const getAggregorFolderPath = Effect.fn("AggregorFolderUtils.getAggregorFolderPath")(function* () {
        return yield* readAbsolutePathVariable(
          AGGREGOR_FOLDER.ENVIRONMENT_VARIABLE,
          path.join(homedir(), AGGREGOR_FOLDER.DEFAULT_NAME)
        );
      });

      return {getAggregorFolderPath: getAggregorFolderPath(), readAbsolutePathVariable};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(Layer.provide(NodeServices.layer));
}
