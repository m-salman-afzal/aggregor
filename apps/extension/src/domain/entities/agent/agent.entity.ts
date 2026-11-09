import {AgentIconValueObjectSchema} from "@valueObjects/agentIcon.valueObject.ts";
import {AgentIdValueObjectSchema} from "@valueObjects/agentId.valueObject.ts";
import {EnvironmentVariablesValueObjectSchema} from "@valueObjects/environmentVariables.valueObject.ts";
import {Schema} from "effect";

// An agent CLI the user can start sessions with, identified by its settings key; editing its command or arguments keeps
// it the same agent. It lives in settings, not in the database, so it has no BaseEntity columns. `args` start a new
// session and `resumeArgs` reopen one that has worked; `environmentVariables` go to the agent either way.
export class AgentEntity extends Schema.Class<AgentEntity, {readonly brand: unique symbol}>("Agent")({
  args: Schema.Array(Schema.String),
  command: Schema.NonEmptyString,
  environmentVariables: EnvironmentVariablesValueObjectSchema,
  icon: AgentIconValueObjectSchema,
  id: AgentIdValueObjectSchema,
  name: Schema.NonEmptyString,
  resumeArgs: Schema.Array(Schema.String)
}) {}
