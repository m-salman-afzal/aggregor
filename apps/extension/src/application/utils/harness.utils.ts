import {IHarnessInfraServices} from "@interfaces/harness.infraService.interface.ts";
import {Effect} from "effect";

import type {IHarnessInfraService} from "@interfaces/harness.infraService.interface.ts";
import type {HarnessIdValueObject} from "@valueObjects/harnessId.valueObject.ts";

// Runs the effect with that harness's infra service.
export const withHarnessInfraService = Effect.fn("withHarnessInfraService")(function* <A, E, R>(
  harnessId: HarnessIdValueObject,
  effect: Effect.Effect<A, E, IHarnessInfraService | R>
) {
  const harnessInfraServices = yield* IHarnessInfraServices;

  // LayerMap owns each harness layer's lifetime, so providing one here leaves its scope intact.
  // @effect-diagnostics-next-line strictEffectProvide:off
  return yield* Effect.provide(effect, harnessInfraServices.get(harnessId));
});
