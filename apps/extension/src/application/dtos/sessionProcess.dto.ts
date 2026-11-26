import {Schema} from "effect";

import {EntityIdValueObjectSchema} from "@/valueObjects/entityId.valueObject.ts";

export const SessionProcessDtoSchema = Schema.Struct({
  commandLine: Schema.String,
  name: Schema.String,
  parentProcessId: Schema.Int,
  processId: Schema.Int
});

export type SessionProcessDto = typeof SessionProcessDtoSchema.Type;

export const TerminalProcessesDtoSchema = Schema.Struct({
  processes: Schema.Array(SessionProcessDtoSchema)
});

export type TerminalProcessesDto = typeof TerminalProcessesDtoSchema.Type;

export const FolderShellProcessesDtoSchema = Schema.Struct({
  ...TerminalProcessesDtoSchema.fields,
  sharingSessionCount: Schema.Int,
  statusLabel: Schema.String
});

export type FolderShellProcessesDto = typeof FolderShellProcessesDtoSchema.Type;

export const SessionProcessesDtoSchema = Schema.Struct({
  agentTerminal: TerminalProcessesDtoSchema,
  folderShell: Schema.optional(FolderShellProcessesDtoSchema),
  sessionId: EntityIdValueObjectSchema
});

export type SessionProcessesDto = typeof SessionProcessesDtoSchema.Type;

export const GetSessionProcessesRequestDtoSchema = Schema.Struct({sessionId: EntityIdValueObjectSchema});

export type GetSessionProcessesRequestDto = typeof GetSessionProcessesRequestDtoSchema.Type;

export const WatchSessionProcessesRequestDtoSchema = Schema.Struct({
  sessionIds: Schema.Array(EntityIdValueObjectSchema)
});

export type WatchSessionProcessesRequestDto = typeof WatchSessionProcessesRequestDtoSchema.Type;
