import {HarnessIdValueObjectSchema} from "@valueObjects/harnessId.valueObject.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {SessionIdValueObjectSchema} from "@valueObjects/sessionId.valueObject.ts";
import {Schema} from "effect";

// One agent conversation, started in a project. `name` is ours, shown until the agent names the conversation.
export class SessionEntity extends Schema.Class<SessionEntity, {readonly brand: unique symbol}>("Session")({
  harnessId: HarnessIdValueObjectSchema,
  id: SessionIdValueObjectSchema,
  name: Schema.String,
  projectPath: ProjectPathValueObjectSchema
}) {}
