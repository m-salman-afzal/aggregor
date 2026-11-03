import {Harnesses} from "@/application/clients/harness.client.ts";
import {HarnessIdSchema} from "@/domain/value-objects/harness-id.value-object.ts";
import {Effect} from "effect";

import type {HarnessClient} from "@/application/clients/harness.client.ts";
import type {HarnessId} from "@/domain/value-objects/harness-id.value-object.ts";

// Runs the effect with that harness's client.
export const withHarnessClient = Effect.fn("withHarnessClient")(function* <A, E, R>(
  harnessId: HarnessId,
  effect: Effect.Effect<A, E, HarnessClient | R>
) {
  const harnesses = yield* Harnesses;

  return yield* Effect.provide(effect, harnesses.get(harnessId));
});

// Runs the effect once with each harness's client, in HarnessId order.
export const forEachHarnessClient = Effect.fn("forEachHarnessClient")(function* <A, E, R>(
  effect: Effect.Effect<A, E, HarnessClient | R>
) {
  return yield* Effect.forEach(HarnessIdSchema.literals, (harnessId) => withHarnessClient(harnessId, effect));
});
