import {Context, Schema} from "effect";

import type {HarnessIdValueObject} from "@valueObjects/harnessId.valueObject.ts";
import type {Effect} from "effect";

// How New Session picks its agent.
export interface SessionSettings {
  readonly defaultHarnessId: HarnessIdValueObject;
  readonly skipHarnessPicker: boolean;
}

export interface Settings {
  readonly autoCommit: boolean;
  readonly commitCommand: string;
}

export class InvalidSettingsError extends Schema.TaggedError<InvalidSettingsError, {readonly brand: unique symbol}>()(
  "InvalidSettingsError",
  {reason: Schema.String}
) {}

// The extension's settings, read fresh on every call so a change applies at once.
export class ISettingsConfig extends Context.Service<
  ISettingsConfig,
  {
    readonly readSessionSettings: Effect.Effect<SessionSettings, InvalidSettingsError>;
    readonly readSettings: Effect.Effect<Settings, InvalidSettingsError>;
    // Writes aggregorApp.defaultHarness to the user's settings.
    readonly saveDefaultHarnessId: (harnessId: HarnessIdValueObject) => Effect.Effect<void>;
  }
>()("aggregor-app/application/interfaces/settings.config.interface/ISettingsConfig") {}
