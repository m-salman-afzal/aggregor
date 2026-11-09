import {Context} from "effect";

import type {Effect} from "effect";

// VS Code's progress indicators for work the user is waiting on.
export class IProgressInfraService extends Context.Service<
  IProgressInfraService,
  {
    // Shows the title in Source Control's progress while the effect runs, and keeps the context key true meanwhile so
    // the manifest's menus can react.
    readonly withSourceControlProgress: <A, E, R>(
      progressTitle: string,
      busyContextKey: string,
      effect: Effect.Effect<A, E, R>
    ) => Effect.Effect<A, E, R>;
  }
>()("aggregor-app/application/interfaces/progress.infraService.interface/IProgressInfraService") {}
