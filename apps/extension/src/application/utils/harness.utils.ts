import {IHarnessInfraServices} from "@interfaces/harness.infraService.interface.ts";
import {HarnessIdValueObjectSchema} from "@valueObjects/harnessId.valueObject.ts";
import {Effect} from "effect";

import type {IHarnessInfraService} from "@interfaces/harness.infraService.interface.ts";
import type {HarnessIdValueObject} from "@valueObjects/harnessId.valueObject.ts";

// Runs the effect with that harness's infra service.
export const withHarnessInfraService = Effect.fn("withHarnessInfraService")(function* <A, E, R>(
  harnessId: HarnessIdValueObject,
  effect: Effect.Effect<A, E, IHarnessInfraService | R>
) {
  const harnessInfraServices = yield* IHarnessInfraServices;

  return yield* Effect.provide(effect, harnessInfraServices.get(harnessId));
});

// Runs the effect once with each harness's infra service, in HarnessIdValueObject order.
export const forEachHarnessInfraService = Effect.fn("forEachHarnessInfraService")(function* <A, E, R>(
  effect: Effect.Effect<A, E, IHarnessInfraService | R>
) {
  return yield* Effect.forEach(HarnessIdValueObjectSchema.literals, (harnessId) =>
    withHarnessInfraService(harnessId, effect)
  );
});
