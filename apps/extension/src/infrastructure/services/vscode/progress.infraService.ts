import {IProgressInfraService} from "@interfaces/progress.infraService.interface.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {runWithProgressIndicator, setWhenClauseContextKey} from "@pkg/vscode/src/vscode.utils.ts";
import {Effect, Layer} from "effect";

// What Source Control's progress shows, and the context key that stays true while it does.
interface SourceControlProgress {
  readonly busyContextKey: string;
  readonly progressTitle: string;
}

const withSourceControlProgress = Effect.fn("ProgressInfraService.withSourceControlProgress")(
  function* <A, E, R>({busyContextKey, progressTitle}: SourceControlProgress, effect: Effect.Effect<A, E, R>) {
    const {ProgressLocation} = yield* VsCodeApi;
    yield* setWhenClauseContextKey(busyContextKey, true);

    return yield* runWithProgressIndicator({location: ProgressLocation.SourceControl, title: progressTitle}, effect);
  },
  (effect, {busyContextKey}) => Effect.ensuring(effect, setWhenClauseContextKey(busyContextKey, false))
);

const makeProgressInfraService = Effect.fn("ProgressInfraService.make")(function* () {
  const vsCodeApi = yield* VsCodeApi;

  return {
    withSourceControlProgress: <A, E, R>(
      progressTitle: string,
      busyContextKey: string,
      effect: Effect.Effect<A, E, R>
    ) => Effect.provideService(withSourceControlProgress({busyContextKey, progressTitle}, effect), VsCodeApi, vsCodeApi)
  };
});

export const ProgressInfraService = Layer.effect(IProgressInfraService, makeProgressInfraService());
