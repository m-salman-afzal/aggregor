import {Context} from "effect";

import type {InvalidSettings} from "@/application/errors/settings.error.ts";
import type {Effect} from "effect";

export interface Settings {
  readonly autoCommit: boolean;
  readonly commitCommand: string;
}

// The extension's settings, read fresh on every call so a change applies at once.
export class SettingsClient extends Context.Service<
  SettingsClient,
  {readonly readSettings: () => Effect.Effect<Settings, InvalidSettings>}
>()("aggregor/application/clients/settings.client/SettingsClient") {}
