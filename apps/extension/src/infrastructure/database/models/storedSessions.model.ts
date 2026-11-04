import {HarnessIdValueObjectSchema} from "@/domain/valueObjects/harnessId.valueObject.ts";
import {ProjectPathValueObjectSchema} from "@/domain/valueObjects/projectPath.valueObject.ts";
import {SessionIdValueObjectSchema} from "@/domain/valueObjects/sessionId.valueObject.ts";
import {Schema} from "effect";

// The sessions as globalState keeps them. Any change to this shape bumps `version`, so windows still running older code
// fail to decode it instead of writing back a copy with the new fields stripped.
export const StoredSessionsModel = Schema.Struct({
  sessions: Schema.Array(
    Schema.Struct({
      harnessId: HarnessIdValueObjectSchema,
      id: SessionIdValueObjectSchema,
      name: Schema.String,
      projectPath: ProjectPathValueObjectSchema
    })
  ),
  version: Schema.Literal(1)
});

export const NO_STORED_SESSIONS: typeof StoredSessionsModel.Encoded = {sessions: [], version: 1};
