import {Context, Schema} from "effect";

import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";

import type {Effect} from "effect";

import type {AggregorSettingsDto} from "@/dtos/settings.dto.ts";
import type {AgentIdValueObject} from "@/valueObjects/agentId.valueObject.ts";
import type {AgentStatusValueObject} from "@/valueObjects/agentStatus.valueObject.ts";
import type {PULL_REQUEST_OPEN_PLACES} from "@pkg/constants/src/gitHubCli.constant.ts";
import type {SESSION_OPEN_PLACES} from "@pkg/constants/src/terminal.constant.ts";

export interface AlertSettings {
  readonly notifyOnStatuses: readonly AgentStatusValueObject[];
}

export interface SessionSettings {
  readonly defaultAgentId: AgentIdValueObject;
  readonly openSessionIn: (typeof SESSION_OPEN_PLACES)[keyof typeof SESSION_OPEN_PLACES];
  readonly pinSessionTabs: boolean;
  readonly sessionMemoryLimit: string | undefined;
  readonly skipAgentPicker: boolean;
}

export interface PullRequestSettings {
  readonly openPullRequestIn: (typeof PULL_REQUEST_OPEN_PLACES)[keyof typeof PULL_REQUEST_OPEN_PLACES];
}

export interface Settings {
  readonly autoCommit: boolean;
  readonly autoPush: boolean;
  readonly commitCommand: string;
}

export class ISettingsConfigErrors extends TaggedErrors({
  InvalidSettingsError: {reason: Schema.String},
  SettingSaveFailedError: {cause: Schema.Unknown, settingKey: Schema.String, settingsSection: Schema.String}
}) {}

export class ISettingsConfig extends Context.Service<
  ISettingsConfig,
  {
    readonly readAggregorSettings: Effect.Effect<AggregorSettingsDto, ISettingsConfigErrors["InvalidSettingsError"]>;
    readonly readAlertSettings: Effect.Effect<AlertSettings, ISettingsConfigErrors["InvalidSettingsError"]>;
    readonly readPullRequestSettings: Effect.Effect<PullRequestSettings, ISettingsConfigErrors["InvalidSettingsError"]>;
    readonly readSessionSettings: Effect.Effect<SessionSettings, ISettingsConfigErrors["InvalidSettingsError"]>;
    readonly readSettings: Effect.Effect<Settings, ISettingsConfigErrors["InvalidSettingsError"]>;
    readonly saveDefaultAgentId: (agentId: AgentIdValueObject) => Effect.Effect<void>;
    readonly saveUserSetting: (
      settingsSection: string,
      settingKey: string,
      settingValue: unknown
    ) => Effect.Effect<unknown, ISettingsConfigErrors["SettingSaveFailedError"]>;
  }
>()("aggregor-app/application/interfaces/settings.config.interface/ISettingsConfig") {}
