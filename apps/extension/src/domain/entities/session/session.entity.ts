import {HarnessIdSchema} from "@/domain/value-objects/harness-id.value-object.ts";
import {ProjectPathSchema} from "@/domain/value-objects/project-path.value-object.ts";
import {SessionIdSchema} from "@/domain/value-objects/session-id.value-object.ts";
import {Schema} from "effect";

import type {SessionId} from "@/domain/value-objects/session-id.value-object.ts";
import type {Status} from "@/domain/value-objects/status.value-object.ts";

// One agent conversation, started in a project. `name` is ours, shown until the agent names the conversation.
export class Session extends Schema.Class<Session, {readonly brand: unique symbol}>("Session")({
  harnessId: HarnessIdSchema,
  id: SessionIdSchema,
  name: Schema.String,
  projectPath: ProjectPathSchema
}) {}

// Lowest free "<project> #n", so removing #1 frees the name for the next session.
export const getNewSessionName = (projectName: string, existingSessions: readonly Session[]) => {
  const takenSessionNames = new Set(existingSessions.map((session) => session.name));
  let sessionNumber = 1;
  while (takenSessionNames.has(`${projectName} #${sessionNumber}`)) sessionNumber += 1;

  return `${projectName} #${sessionNumber}`;
};

// A turn is in progress while its session runs or waits on the user.
const TURN_IN_PROGRESS_STATUSES: ReadonlySet<Status | undefined> = new Set(["needs-input", "running"]);

interface UnreadSessionIdsInputs {
  readonly currentStatuses: ReadonlyMap<SessionId, Status>;
  readonly previousStatuses: ReadonlyMap<SessionId, Status>;
  readonly previousUnreadSessionIds: ReadonlySet<SessionId>;
  readonly viewedSessionId: SessionId | undefined;
}

// A turn that ends while its session is out of view leaves it unread until it comes into view or starts another turn.
// Ended means idle now, and running or waiting on the user at the previous look.
export const getUnreadSessionIds = (inputs: UnreadSessionIdsInputs): ReadonlySet<SessionId> => {
  const {currentStatuses, previousStatuses, previousUnreadSessionIds, viewedSessionId} = inputs;
  const endedSessionIds = [...currentStatuses]
    .filter(
      ([sessionId, sessionStatus]) =>
        sessionStatus === "idle" && TURN_IN_PROGRESS_STATUSES.has(previousStatuses.get(sessionId))
    )
    .map(([sessionId]) => sessionId);
  const isIdleAndOutOfView = (sessionId: SessionId) =>
    currentStatuses.get(sessionId) === "idle" && sessionId !== viewedSessionId;

  return new Set([...previousUnreadSessionIds, ...endedSessionIds].filter(isIdleAndOutOfView));
};
