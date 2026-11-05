import {HarnessIdValueObjectSchema} from "@valueObjects/harnessId.valueObject.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {SessionIdValueObjectSchema} from "@valueObjects/sessionId.valueObject.ts";
import {Array, Schema} from "effect";

import type {SessionIdValueObject} from "@valueObjects/sessionId.valueObject.ts";
import type {StatusValueObject} from "@valueObjects/status.valueObject.ts";

interface UnreadSessionIdsInputs {
  readonly currentStatuses: ReadonlyMap<SessionIdValueObject, StatusValueObject>;
  readonly previousStatuses: ReadonlyMap<SessionIdValueObject, StatusValueObject>;
  readonly previousUnreadSessionIds: ReadonlySet<SessionIdValueObject>;
  readonly viewedSessionId: SessionIdValueObject | undefined;
}

// One agent conversation, started in a project. `name` is ours, shown until the agent names the conversation.
export class SessionEntity extends Schema.Class<SessionEntity, {readonly brand: unique symbol}>("Session")({
  harnessId: HarnessIdValueObjectSchema,
  id: SessionIdValueObjectSchema,
  name: Schema.String,
  projectPath: ProjectPathValueObjectSchema
}) {}

// Lowest free "<project> #n", so removing #1 frees the name for the next session.
export const getNewSessionName = (projectName: string, existingSessions: readonly SessionEntity[]) => {
  const takenSessionNames = new Set(Array.map(existingSessions, (session) => session.name));
  let sessionNumber = 1;
  while (takenSessionNames.has(`${projectName} #${sessionNumber}`)) sessionNumber += 1;

  return `${projectName} #${sessionNumber}`;
};

// A turn is in progress while its session runs or waits on the user.
const TURN_IN_PROGRESS_STATUSES: ReadonlySet<StatusValueObject | undefined> = new Set(["needs-input", "running"]);

// A turn that ends while its session is out of view leaves it unread until it comes into view or starts another turn.
// Ended means idle now, and running or waiting on the user at the previous look.
export const getUnreadSessionIds = (inputs: UnreadSessionIdsInputs): ReadonlySet<SessionIdValueObject> => {
  const {currentStatuses, previousStatuses, previousUnreadSessionIds, viewedSessionId} = inputs;
  const endedSessionIds = Array.map(
    Array.filter(
      [...currentStatuses],
      ([sessionId, sessionStatus]) =>
        sessionStatus === "idle" && TURN_IN_PROGRESS_STATUSES.has(previousStatuses.get(sessionId))
    ),
    ([sessionId]) => sessionId
  );
  const isIdleAndOutOfView = (sessionId: SessionIdValueObject) =>
    currentStatuses.get(sessionId) === "idle" && sessionId !== viewedSessionId;

  return new Set(Array.filter([...previousUnreadSessionIds, ...endedSessionIds], isIdleAndOutOfView));
};
