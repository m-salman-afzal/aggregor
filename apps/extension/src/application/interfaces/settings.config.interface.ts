import {Context, Schema} from "effect";

import type {Effect} from "effect";

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
  {readonly readSettings: Effect.Effect<Settings, InvalidSettingsError>}
>()("aggregor-app/application/interfaces/settings.config.interface/ISettingsConfig") {}
