import {Context, Schema} from "effect";

import type {AgentIdValueObject} from "@valueObjects/agentId.valueObject.ts";
import type {AgentStatusValueObject} from "@valueObjects/agentStatus.valueObject.ts";
import type {Effect} from "effect";

// The states a session out of view notifies about.
export interface AlertSettings {
  readonly notifyOnStatuses: readonly AgentStatusValueObject[];
}

// How New Session picks its agent.
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

// The extension's settings, read fresh on every call so a change applies at once.
export class ISettingsConfig extends Context.Service<
  ISettingsConfig,
  {
    readonly readAlertSettings: Effect.Effect<AlertSettings, InvalidSettingsError>;
    readonly readSessionSettings: Effect.Effect<SessionSettings, InvalidSettingsError>;
    readonly readSettings: Effect.Effect<Settings, InvalidSettingsError>;
    // Writes aggregorApp.defaultAgent to the user's settings.
    readonly saveDefaultAgentId: (agentId: AgentIdValueObject) => Effect.Effect<void>;
  }
>()("aggregor-app/application/interfaces/settings.config.interface/ISettingsConfig") {}
