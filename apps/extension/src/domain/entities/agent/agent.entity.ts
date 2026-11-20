import {AgentIconValueObjectSchema} from "@valueObjects/agentIcon.valueObject.ts";
import {AgentIdValueObjectSchema} from "@valueObjects/agentId.valueObject.ts";
import {EnvironmentVariablesValueObjectSchema} from "@valueObjects/environmentVariables.valueObject.ts";
import {Schema} from "effect";

export class AgentEntity extends Schema.Class<AgentEntity, {readonly brand: unique symbol}>("Agent")({
  args: Schema.Array(Schema.String),
  command: Schema.NonEmptyString,
  environmentVariables: EnvironmentVariablesValueObjectSchema,
  icon: AgentIconValueObjectSchema,
  id: AgentIdValueObjectSchema,
  name: Schema.NonEmptyString,
  resumeArgs: Schema.Array(Schema.String)
}) {}
