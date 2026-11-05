import type {SessionIdValueObject} from "@valueObjects/sessionId.valueObject.ts";
import type {StatusValueObject} from "@valueObjects/status.valueObject.ts";
import type {SubscriptionRef} from "effect";

// Each session's status, keyed by session id.
export type SessionStatusesReference = SubscriptionRef.SubscriptionRef<
  ReadonlyMap<SessionIdValueObject, StatusValueObject>
>;
