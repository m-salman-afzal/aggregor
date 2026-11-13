import {Context, Schema} from "effect";

import type {AgentIdValueObject} from "@valueObjects/agentId.valueObject.ts";
import type {AgentStatusValueObject} from "@valueObjects/agentStatus.valueObject.ts";
import type {Effect} from "effect";

export interface AlertSettings {
  readonly notifyOnStatuses: readonly AgentStatusValueObject[];
}

export interface SessionSettings {
  readonly defaultAgentId: AgentIdValueObject;
  readonly skipAgentPicker: boolean;
}

export interface Settings {
  readonly autoCommit: boolean;
  readonly commitCommand: string;
}

export class InvalidSettingsError extends Schema.TaggedError<InvalidSettingsError, {readonly brand: unique symbol}>()(
  "InvalidSettingsError",
  {reason: Schema.String}
) {}

// Read fresh on every call, so a change applies at once.
export class ISettingsConfig extends Context.Service<
  ISettingsConfig,
  {
    readonly readAlertSettings: Effect.Effect<AlertSettings, InvalidSettingsError>;
    readonly readSessionSettings: Effect.Effect<SessionSettings, InvalidSettingsError>;
    readonly readSettings: Effect.Effect<Settings, InvalidSettingsError>;
    readonly saveDefaultAgentId: (agentId: AgentIdValueObject) => Effect.Effect<void>;
  }
>()("aggregor-app/application/interfaces/settings.config.interface/ISettingsConfig") {}
