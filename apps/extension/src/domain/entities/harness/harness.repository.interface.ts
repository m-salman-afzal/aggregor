import {HarnessIdValueObjectSchema} from "@valueObjects/harnessId.valueObject.ts";
import {Context, Schema} from "effect";

import type {HarnessEntity} from "@entities/harness/harness.entity.ts";
import type {HarnessIdValueObject} from "@valueObjects/harnessId.valueObject.ts";
import type {Effect} from "effect";

// No harness has that key: it was renamed, hidden with null, or left out as invalid.
export class HarnessNotFoundError extends Schema.TaggedError<HarnessNotFoundError, {readonly brand: unique symbol}>()(
  "HarnessNotFoundError",
  {harnessId: HarnessIdValueObjectSchema}
) {}

// The harnesses aggregorApp.harnesses defines, the built-ins included; an edit applies at once.
export class IHarnessRepository extends Context.Service<
  IHarnessRepository,
  {
    readonly findAll: Effect.Effect<readonly HarnessEntity[]>;
    readonly findById: (harnessId: HarnessIdValueObject) => Effect.Effect<HarnessEntity, HarnessNotFoundError>;
  }
>()("aggregor-app/domain/entities/harness/harness.repository.interface/IHarnessRepository") {}
