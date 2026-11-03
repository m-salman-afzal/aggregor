import {Harnesses} from "@/application/clients/harness.client.ts";
import {ClaudeCodeHarnessClient} from "@/infrastructure/clients/claude-code/claude-code.client.ts";
import {Effect, Layer, LayerMap} from "effect";

import type {HarnessClient} from "@/application/clients/harness.client.ts";
import type {HarnessId} from "@/domain/value-objects/harness-id.value-object.ts";

// One client per harness id, so a harness id without a client fails to compile.
const HARNESS_CLIENT_LAYERS = {
  "claude-code": ClaudeCodeHarnessClient
} satisfies Record<HarnessId, Layer.Layer<HarnessClient, never, any>>;

// Every harness starts with the window and lives as long as it, since the view reads its statuses all the time.
const makeHarnesses = Effect.fn("Harnesses.make")(function* () {
  return yield* LayerMap.fromRecord(HARNESS_CLIENT_LAYERS, {idleTimeToLive: "Infinity", preload: true});
});

export const HarnessesLayer = Layer.effect(Harnesses, makeHarnesses());
