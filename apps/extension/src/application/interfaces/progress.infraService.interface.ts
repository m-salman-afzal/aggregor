import {Context} from "effect";

import type {Effect} from "effect";

export class IProgressInfraService extends Context.Service<
  IProgressInfraService,
  {
    readonly runWithSessionsViewProgress: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
    // Keeps the context key true meanwhile, so the manifest's menus can react.
    readonly runWithSourceControlProgress: <A, E, R>(
      progressTitle: string,
      busyContextKey: string,
      effect: Effect.Effect<A, E, R>
    ) => Effect.Effect<A, E, R>;
  }
>()("aggregor-app/application/interfaces/progress.infraService.interface/IProgressInfraService") {}
