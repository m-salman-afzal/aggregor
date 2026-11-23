import {Context, Effect, Layer} from "effect";

import {IProgressInfraService} from "@/interfaces/progress.infraService.interface.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {VscodeUtils} from "@pkg/vscode/src/vscode.utils.ts";

interface SourceControlProgress {
  readonly busyContextKey: string;
  readonly progressTitle: string;
}

export class ProgressInfraService extends Context.Service<ProgressInfraService>()(
  "aggregor-app/infrastructure/services/vscode/progress.infraService/ProgressInfraService",
  {
    make: Effect.fn("ProgressInfraService.make")(function* () {
      const vsCodeApi = yield* VsCodeApi;
      const vscodeUtils = yield* VscodeUtils;

      const runWithSourceControlProgress = Effect.fn("ProgressInfraService.runWithSourceControlProgress")(
        function* <A, E, R>(sourceControlProgress: SourceControlProgress, effect: Effect.Effect<A, E, R>) {
          yield* vscodeUtils.setWhenClauseContextKey(sourceControlProgress.busyContextKey, true);

          return yield* vscodeUtils.runWithProgressIndicator(
            {location: vsCodeApi.ProgressLocation.SourceControl, title: sourceControlProgress.progressTitle},
            effect
          );
        },
        (effect, sourceControlProgress) =>
          Effect.ensuring(effect, vscodeUtils.setWhenClauseContextKey(sourceControlProgress.busyContextKey, false))
      );

      return {
        runWithSourceControlProgress: <A, E, R>(
          progressTitle: string,
          busyContextKey: string,
          effect: Effect.Effect<A, E, R>
        ) => runWithSourceControlProgress({busyContextKey, progressTitle}, effect)
      };
    })
  }
) {
  public static readonly layer = Layer.effect(IProgressInfraService, this.make());
}
