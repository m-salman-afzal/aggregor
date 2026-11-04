import type {SessionEntity} from "@/domain/entities/session/session.entity.ts";
import type {SessionIdValueObject} from "@/domain/valueObjects/sessionId.valueObject.ts";
import type {StatusValueObject} from "@/domain/valueObjects/status.valueObject.ts";
import type {TitleNotFoundError} from "@/infrastructure/services/claudeCodeHarness/claudeCodeHarness.infraService.error.ts";
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
