import {Schema} from "effect";

import {EntityIdValueObjectSchema} from "@/valueObjects/entityId.valueObject.ts";
import {ProjectPathValueObjectSchema} from "@/valueObjects/projectPath.valueObject.ts";

export const OpenProjectTerminalRequestDtoSchema = Schema.Struct({projectPath: ProjectPathValueObjectSchema});

export type OpenProjectTerminalRequestDto = typeof OpenProjectTerminalRequestDtoSchema.Type;

export const OpenSessionFolderTerminalRequestDtoSchema = Schema.Struct({sessionId: EntityIdValueObjectSchema});

export type OpenSessionFolderTerminalRequestDto = typeof OpenSessionFolderTerminalRequestDtoSchema.Type;

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
