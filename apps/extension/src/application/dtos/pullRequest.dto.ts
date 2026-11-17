import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {Schema} from "effect";

export const OpenSessionPullRequestRequestDtoSchema = Schema.Struct({sessionId: EntityIdValueObjectSchema});

export type OpenSessionPullRequestRequestDto = typeof OpenSessionPullRequestRequestDtoSchema.Type;
