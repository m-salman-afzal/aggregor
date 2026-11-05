import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {TitleNotFoundError} from "@infraServices/claudeCodeHarness/claudeCode.transformer.ts";
import type {SessionIdValueObject} from "@valueObjects/sessionId.valueObject.ts";
import type {StatusValueObject} from "@valueObjects/status.valueObject.ts";
import type {Result, SubscriptionRef} from "effect";

// Each session's status, keyed by session id.
export type SessionStatusesReference = SubscriptionRef.SubscriptionRef<
  ReadonlyMap<SessionIdValueObject, StatusValueObject>
>;

// Each session's title, keyed by session id.
export type SessionTitlesReference = SubscriptionRef.SubscriptionRef<ReadonlyMap<SessionIdValueObject, string>>;

export interface Titles {
  readonly aiTitle: Result.Result<string, TitleNotFoundError>;
  readonly customTitle: Result.Result<string, TitleNotFoundError>;
}

// What the title watcher reads and updates.
export interface TitleTracking {
  readonly sessionTitles: SessionTitlesReference;
  readonly trackedSessions: SubscriptionRef.SubscriptionRef<readonly SessionEntity[]>;
  readonly transcriptProgressBySessionId: Map<SessionIdValueObject, TranscriptProgress>;
}

// How far into a transcript we have read, so each refresh only scans what Claude appended since.
export interface TranscriptProgress {
  readonly byteOffset: bigint;
  readonly titles: Titles;
  readonly transcriptFilePath: string;
}
