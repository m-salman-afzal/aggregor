import {HarnessIdValueObjectSchema} from "@valueObjects/harnessId.valueObject.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {SessionIdValueObjectSchema} from "@valueObjects/sessionId.valueObject.ts";
import {Schema} from "effect";

// One agent conversation, started in a project. `name` is the agent's latest title for it, or ours until the agent gives
// one; `customName` is the user's, which wins.
export class SessionEntity extends Schema.Class<SessionEntity, {readonly brand: unique symbol}>("Session")({
  customName: Schema.optional(Schema.String),
  harnessId: HarnessIdValueObjectSchema,
  id: SessionIdValueObjectSchema,
  name: Schema.String,
  projectPath: ProjectPathValueObjectSchema
}) {
  public get displayName(): string {
    return this.customName === undefined ? this.name : this.customName;
  }

  // The user's name for the session; undefined hands the title back to the agent.
  public withCustomName(customName: string | undefined): SessionEntity {
    const {harnessId, id, name, projectPath} = this;

    return SessionEntity.make({customName, harnessId, id, name, projectPath});
  }

  public withName(name: string): SessionEntity {
    const {customName, harnessId, id, projectPath} = this;

    return SessionEntity.make({customName, harnessId, id, name, projectPath});
  }
}
