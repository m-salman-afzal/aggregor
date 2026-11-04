import {Context} from "effect";

import type {InvalidSettingsError} from "@/application/interfaces/settings/settings.config.error.ts";
import type {Effect} from "effect";

export interface Settings {
  readonly autoCommit: boolean;
  readonly commitCommand: string;
}

// The extension's settings, read fresh on every call so a change applies at once.
export class ISettingsConfig extends Context.Service<
  ISettingsConfig,
  {readonly readSettings: () => Effect.Effect<Settings, InvalidSettingsError>}
>()("aggregor/application/interfaces/settings/settings.config.interface/ISettingsConfig") {}
