import {HarnessIdSchema} from "@/domain/value-objects/harness-id.value-object.ts";
import {ProjectPathSchema} from "@/domain/value-objects/project-path.value-object.ts";
import {SessionIdSchema} from "@/domain/value-objects/session-id.value-object.ts";
import {Schema} from "effect";

// The sessions as globalState keeps them. Any change to this shape bumps `version`, so windows still running older code
// fail to decode it instead of writing back a copy with the new fields stripped.
export const StoredSessions = Schema.Struct({
  sessions: Schema.Array(
    Schema.Struct({
      harnessId: HarnessIdSchema,
      id: SessionIdSchema,
      name: Schema.String,
      projectPath: ProjectPathSchema
    })
  ),
  version: Schema.Literal(1)
});

export const NO_STORED_SESSIONS: typeof StoredSessions.Encoded = {sessions: [], version: 1};
