import {ISettingsConfig, ISettingsConfigErrors} from "@interfaces/settings.config.interface.ts";
import {AGENT_SETTINGS} from "@pkg/constants/src/agent.constant.ts";
import {SETTINGS_SECTION} from "@pkg/constants/src/app.constant.ts";
import {PULL_REQUEST_OPEN_PLACES} from "@pkg/constants/src/gitHubCli.constant.ts";
import {SESSION_SETTINGS} from "@pkg/constants/src/session.constant.ts";
import {SESSION_OPEN_PLACES} from "@pkg/constants/src/terminal.constant.ts";
import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {AgentIdValueObjectSchema} from "@valueObjects/agentId.valueObject.ts";
import {AgentStatusValueObjectSchema} from "@valueObjects/agentStatus.valueObject.ts";
import {Context, Effect, Layer, Schema} from "effect";

import type {AlertSettings, PullRequestSettings, SessionSettings} from "@interfaces/settings.config.interface.ts";
import type {AgentIdValueObject} from "@valueObjects/agentId.valueObject.ts";

class SettingsConfigErrors extends TaggedErrors({
  DefaultAgentSaveFailedError: {cause: Schema.Unknown}
}) {}

const SettingsSchema = Schema.Struct({
  autoCommit: Schema.Boolean,
  autoPush: Schema.Boolean,
  commitCommand: Schema.NonEmptyString
});

const SessionSettingsSchema = Schema.Struct({
  defaultAgent: AgentIdValueObjectSchema,
  openSessionIn: Schema.Enum(SESSION_OPEN_PLACES),
  pinSessionTabs: Schema.Boolean,
  sessionMemoryLimit: Schema.String.check(Schema.isPattern(SESSION_SETTINGS.MEMORY_LIMIT_PATTERN)),
  skipAgentPicker: Schema.Boolean
});

const PullRequestSettingsSchema = Schema.Struct({
  openPullRequestIn: Schema.Enum(PULL_REQUEST_OPEN_PLACES)
});

const AlertSettingsSchema = Schema.Struct({
  notifyOn: Schema.Array(AgentStatusValueObjectSchema)
});

export class SettingsConfig extends Context.Service<SettingsConfig>()(
  "aggregor-app/infrastructure/config/settings.config/SettingsConfig",
  {
    make: Effect.fn("SettingsConfig.make")(function* () {
      const vsCodeApi = yield* VsCodeApi;

      const readSettings = Effect.fn("SettingsConfig.readSettings")(
        function* () {
          const configuredSettings = yield* vsCodeApi.getConfiguration(SETTINGS_SECTION);

          return yield* Schema.decodeUnknownEffect(SettingsSchema)(configuredSettings);
        },
        Effect.mapError((schemaError) => ISettingsConfigErrors.InvalidSettingsError.make({reason: schemaError.message}))
      );

      const readSessionSettings = Effect.fn("SettingsConfig.readSessionSettings")(
        function* () {
          const configuredSettings = yield* vsCodeApi.getConfiguration(SETTINGS_SECTION);
          const decodedSessionSettings = yield* Schema.decodeUnknownEffect(SessionSettingsSchema)(configuredSettings);
          const sessionSettings: SessionSettings = {
            defaultAgentId: decodedSessionSettings.defaultAgent,
            openSessionIn: decodedSessionSettings.openSessionIn,
            pinSessionTabs: decodedSessionSettings.pinSessionTabs,
            sessionMemoryLimit:
              decodedSessionSettings.sessionMemoryLimit === "" ? undefined : decodedSessionSettings.sessionMemoryLimit,
            skipAgentPicker: decodedSessionSettings.skipAgentPicker
          };

          return sessionSettings;
        },
        Effect.mapError((schemaError) => ISettingsConfigErrors.InvalidSettingsError.make({reason: schemaError.message}))
      );

      const readAlertSettings = Effect.fn("SettingsConfig.readAlertSettings")(
        function* () {
          const configuredSettings = yield* vsCodeApi.getConfiguration(SETTINGS_SECTION);
          const decodedAlertSettings = yield* Schema.decodeUnknownEffect(AlertSettingsSchema)(configuredSettings);
          const alertSettings: AlertSettings = {notifyOnStatuses: decodedAlertSettings.notifyOn};

          return alertSettings;
        },
        Effect.mapError((schemaError) => ISettingsConfigErrors.InvalidSettingsError.make({reason: schemaError.message}))
      );

      const readPullRequestSettings = Effect.fn("SettingsConfig.readPullRequestSettings")(
        function* () {
          const configuredSettings = yield* vsCodeApi.getConfiguration(SETTINGS_SECTION);
          const decodedPullRequestSettings =
            yield* Schema.decodeUnknownEffect(PullRequestSettingsSchema)(configuredSettings);
          const pullRequestSettings: PullRequestSettings = {
            openPullRequestIn: decodedPullRequestSettings.openPullRequestIn
          };

          return pullRequestSettings;
        },
        Effect.mapError((schemaError) => ISettingsConfigErrors.InvalidSettingsError.make({reason: schemaError.message}))
      );

      const saveDefaultAgentId = Effect.fn("SettingsConfig.saveDefaultAgentId")(
        function* (agentId: AgentIdValueObject) {
          const config = yield* vsCodeApi.getConfiguration(SETTINGS_SECTION);

          yield* Effect.tryPromise({
            catch: (cause) => SettingsConfigErrors.DefaultAgentSaveFailedError.make({cause}),
            try: () => config.update(AGENT_SETTINGS.DEFAULT_AGENT, agentId, vsCodeApi.ConfigurationTarget.Global)
          });
        },
        Effect.catch((writeError) => Effect.logWarning("Could not save the default agent", writeError))
      );

      return {
        readAlertSettings: readAlertSettings(),
        readPullRequestSettings: readPullRequestSettings(),
        readSessionSettings: readSessionSettings(),
        readSettings: readSettings(),
        saveDefaultAgentId
      };
    })
  }
) {
  public static readonly layer = Layer.effect(ISettingsConfig, this.make());
}
