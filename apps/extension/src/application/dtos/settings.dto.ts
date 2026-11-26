import {Schema} from "effect";

import {AgentIdValueObjectSchema} from "@/valueObjects/agentId.valueObject.ts";
import {AgentStatusValueObjectSchema} from "@/valueObjects/agentStatus.valueObject.ts";
import {EnvironmentVariablesValueObjectSchema} from "@/valueObjects/environmentVariables.valueObject.ts";
import {AGENT_ICON, AGENT_SETTINGS} from "@pkg/constants/src/agent.constant.ts";
import {TRACE_LOGGING} from "@pkg/constants/src/app.constant.ts";
import {PULL_REQUEST_OPEN_PLACES} from "@pkg/constants/src/gitHubCli.constant.ts";
import {SESSION_SETTINGS} from "@pkg/constants/src/session.constant.ts";
import {SESSIONS_VIEW_SETTINGS} from "@pkg/constants/src/sessionsView.constant.ts";
import {SETTING_KEYS} from "@pkg/constants/src/settings.constant.ts";
import {SESSION_OPEN_PLACES} from "@pkg/constants/src/terminal.constant.ts";

const AgentSettingDtoSchema = Schema.Struct({
  args: Schema.optionalKey(Schema.Array(Schema.String)),
  command: Schema.optionalKey(Schema.NonEmptyString),
  env: Schema.optionalKey(EnvironmentVariablesValueObjectSchema),
  icon: Schema.optionalKey(Schema.String.check(Schema.isPattern(AGENT_ICON.FILE_PATTERN))),
  name: Schema.optionalKey(Schema.NonEmptyString),
  resumeArgs: Schema.optionalKey(Schema.Array(Schema.String))
});

// Each aggregorApp.* setting in package.json's contributes.configuration, typed as it declares it.
export const AggregorSettingsDtoSchema = Schema.Struct({
  accentColor: Schema.String.check(Schema.isPattern(SESSIONS_VIEW_SETTINGS.ACCENT_COLOR_PATTERN)),
  agents: Schema.Record(Schema.String, Schema.NullOr(AgentSettingDtoSchema)),
  autoCommit: Schema.Boolean,
  autoPush: Schema.Boolean,
  commitCommand: Schema.NonEmptyString,
  defaultAgent: AgentIdValueObjectSchema,
  fontSize: Schema.Finite.check(
    Schema.isBetween({
      maximum: SESSIONS_VIEW_SETTINGS.FONT_SIZE_MAXIMUM,
      minimum: SESSIONS_VIEW_SETTINGS.FONT_SIZE_MINIMUM
    })
  ),
  notifyOn: Schema.UniqueArray(AgentStatusValueObjectSchema),
  openPullRequestIn: Schema.Enum(PULL_REQUEST_OPEN_PLACES),
  openSessionIn: Schema.Enum(SESSION_OPEN_PLACES),
  pinSessionTabs: Schema.Boolean,
  sessionMemoryLimit: Schema.String.check(Schema.isPattern(SESSION_SETTINGS.MEMORY_LIMIT_PATTERN)),
  skipAgentPicker: Schema.Boolean,
  traceLogging: Schema.Boolean
});

export type AggregorSettingsDto = typeof AggregorSettingsDtoSchema.Type;

const aggregorSettingFields = AggregorSettingsDtoSchema.fields;

// One member per setting, so the command's JSON Schema lists each setting with the values it takes.
export const UpdateSettingRequestDtoSchema = Schema.Union([
  Schema.Struct({
    setting: Schema.Literal(SESSIONS_VIEW_SETTINGS.ACCENT_COLOR),
    value: aggregorSettingFields.accentColor
  }),
  Schema.Struct({setting: Schema.Literal(AGENT_SETTINGS.AGENTS), value: aggregorSettingFields.agents}),
  Schema.Struct({setting: Schema.Literal(SETTING_KEYS.AUTO_COMMIT), value: aggregorSettingFields.autoCommit}),
  Schema.Struct({setting: Schema.Literal(SETTING_KEYS.AUTO_PUSH), value: aggregorSettingFields.autoPush}),
  Schema.Struct({setting: Schema.Literal(SETTING_KEYS.COMMIT_COMMAND), value: aggregorSettingFields.commitCommand}),
  Schema.Struct({setting: Schema.Literal(AGENT_SETTINGS.DEFAULT_AGENT), value: aggregorSettingFields.defaultAgent}),
  Schema.Struct({setting: Schema.Literal(SESSIONS_VIEW_SETTINGS.FONT_SIZE), value: aggregorSettingFields.fontSize}),
  Schema.Struct({setting: Schema.Literal(SETTING_KEYS.NOTIFY_ON), value: aggregorSettingFields.notifyOn}),
  Schema.Struct({
    setting: Schema.Literal(SETTING_KEYS.OPEN_PULL_REQUEST_IN),
    value: aggregorSettingFields.openPullRequestIn
  }),
  Schema.Struct({setting: Schema.Literal(SETTING_KEYS.OPEN_SESSION_IN), value: aggregorSettingFields.openSessionIn}),
  Schema.Struct({setting: Schema.Literal(SETTING_KEYS.PIN_SESSION_TABS), value: aggregorSettingFields.pinSessionTabs}),
  Schema.Struct({
    setting: Schema.Literal(SETTING_KEYS.SESSION_MEMORY_LIMIT),
    value: aggregorSettingFields.sessionMemoryLimit
  }),
  Schema.Struct({
    setting: Schema.Literal(AGENT_SETTINGS.SKIP_AGENT_PICKER),
    value: aggregorSettingFields.skipAgentPicker
  }),
  Schema.Struct({setting: Schema.Literal(TRACE_LOGGING.SETTING), value: aggregorSettingFields.traceLogging})
]);

export type UpdateSettingRequestDto = typeof UpdateSettingRequestDtoSchema.Type;

export const SettingChangeDtoSchema = Schema.Struct({
  newValue: Schema.Unknown,
  previousValue: Schema.Unknown,
  settingId: Schema.String
});

export type SettingChangeDto = typeof SettingChangeDtoSchema.Type;
