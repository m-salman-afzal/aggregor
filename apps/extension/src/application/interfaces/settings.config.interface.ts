import {Context} from "effect";

import type {InvalidSettingsError} from "@/application/interfaces/settings.config.error.ts";
import type {Settings} from "@/application/interfaces/settings.config.type.ts";
import type {Effect} from "effect";

// The extension's settings, read fresh on every call so a change applies at once.
export class ISettingsConfig extends Context.Service<
  ISettingsConfig,
  {readonly readSettings: () => Effect.Effect<Settings, InvalidSettingsError>}
>()("aggregor/application/interfaces/settings.config.interface/ISettingsConfig") {}
