import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {Schema} from "effect";

export const SessionProcessDtoSchema = Schema.Struct({
  commandLine: Schema.String,
  name: Schema.String,
  parentProcessId: Schema.Int,
  processId: Schema.Int
});

export type SessionProcessDto = typeof SessionProcessDtoSchema.Type;

// Everything one of a session's terminals runs.
export const TerminalProcessesDtoSchema = Schema.Struct({
  processes: Schema.Array(SessionProcessDtoSchema)
});

export type TerminalProcessesDto = typeof TerminalProcessesDtoSchema.Type;

// The shell of the session's folder, labelled as its status line is, and how many sessions in that folder share it.
export const FolderShellProcessesDtoSchema = Schema.Struct({
  ...TerminalProcessesDtoSchema.fields,
  sharingSessionCount: Schema.Int,
  statusLabel: Schema.String
});

export type FolderShellProcessesDto = typeof FolderShellProcessesDtoSchema.Type;

// No folder shell while it isn't running.
export const SessionProcessesDtoSchema = Schema.Struct({
  agentTerminal: TerminalProcessesDtoSchema,
  folderShell: Schema.optional(FolderShellProcessesDtoSchema),
  sessionId: EntityIdValueObjectSchema
});

export type SessionProcessesDto = typeof SessionProcessesDtoSchema.Type;

// The sessions whose dropdowns are open; none stops the readings.
export const WatchSessionProcessesRequestDtoSchema = Schema.Struct({
  sessionIds: Schema.Array(EntityIdValueObjectSchema)
});

export type WatchSessionProcessesRequestDto = typeof WatchSessionProcessesRequestDtoSchema.Type;
