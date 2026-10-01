import {Context} from "effect";

import type {Effect} from "effect/Effect";

export class ErrorService extends Context.Service<
  ErrorService,
  {readonly show: (message: string, ...actions: string[]) => Effect<string | undefined>}
>()("aggregor/services/error.service/ErrorService") {}
