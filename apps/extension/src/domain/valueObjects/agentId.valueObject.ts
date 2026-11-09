import {Schema} from "effect";

// Which agent CLI a session runs: its key in aggregorApp.agents, such as claude.
export const AgentIdValueObjectSchema = Schema.NonEmptyString.pipe(Schema.brand("AgentId"));

export type AgentIdValueObject = typeof AgentIdValueObjectSchema.Type;
