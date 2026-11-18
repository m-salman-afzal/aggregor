import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {Schema} from "effect";

export const OpenProjectTerminalRequestDtoSchema = Schema.Struct({projectPath: ProjectPathValueObjectSchema});

export type OpenProjectTerminalRequestDto = typeof OpenProjectTerminalRequestDtoSchema.Type;

export const OpenSessionFolderTerminalRequestDtoSchema = Schema.Struct({sessionId: EntityIdValueObjectSchema});

export type OpenSessionFolderTerminalRequestDto = typeof OpenSessionFolderTerminalRequestDtoSchema.Type;

// With no folder shell terminal, VS Code opens its own shell, as it does without Aggregor.
export const ProfileTerminalDtoSchema = Schema.Struct({
  folderShellTerminal: Schema.optional(
    Schema.Struct({
      cwd: Schema.String,
      name: Schema.String,
      shellArgs: Schema.Array(Schema.String),
      shellPath: Schema.String
    })
  )
});

export type ProfileTerminalDto = typeof ProfileTerminalDtoSchema.Type;
