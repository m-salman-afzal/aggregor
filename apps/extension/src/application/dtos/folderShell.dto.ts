import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {Schema} from "effect";

export const OpenProjectTerminalRequestDtoSchema = Schema.Struct({projectPath: ProjectPathValueObjectSchema});

export type OpenProjectTerminalRequestDto = typeof OpenProjectTerminalRequestDtoSchema.Type;

export const OpenSessionFolderTerminalRequestDtoSchema = Schema.Struct({sessionId: EntityIdValueObjectSchema});

export type OpenSessionFolderTerminalRequestDto = typeof OpenSessionFolderTerminalRequestDtoSchema.Type;
