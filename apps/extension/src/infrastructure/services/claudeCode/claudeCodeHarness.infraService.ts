import {IHarnessInfraService} from "@/application/interfaces/harness.infraService.interface.ts";
import {ISessionRepository} from "@/domain/entities/session/session.repository.interface.ts";
import {clearStatusFile, watchStatusDirectory} from "@/infrastructure/services/claudeCode/status.utils.ts";
import {getSessionTitle, watchTranscripts} from "@/infrastructure/services/claudeCode/titles.utils.ts";
import {findTranscriptFilePath} from "@/infrastructure/services/claudeCode/transcript.utils.ts";
import {VsCodeApi} from "@/infrastructure/vscode/vscode.api.ts";
import {HOOKS_FILE, MODEL_ICONS, STATUS_ENV} from "@pkg/constants/src/extension.constant.ts";
import {Context, Effect, Layer, SubscriptionRef} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";

import type {SessionEntity} from "@/domain/entities/session/session.entity.ts";
import type {LaunchPlanValueObject} from "@/domain/valueObjects/launchPlan.valueObject.ts";
import type {SessionIdValueObject} from "@/domain/valueObjects/sessionId.valueObject.ts";
import type {StatusValueObject} from "@/domain/valueObjects/status.valueObject.ts";
import type {
  SessionStatusesReference,
  SessionTitlesReference
} from "@/infrastructure/services/claudeCode/claudeCodeHarness.infraService.type.ts";

// Where the launch reads its hooks from and where the hooks write each session's status.
interface StatusPaths {
  readonly hooksFilePath: string;
  readonly statusDirectoryPath: string;
}

// A failed lookup counts as "no transcript": starting fresh is better than a resume that cannot work.
const hasTranscript = Effect.fn("ClaudeCodeHarnessInfraService.hasTranscript")(
  function* (session: SessionEntity) {
    yield* findTranscriptFilePath(session.id);

    return true;
  },
  Effect.catchTag("TranscriptNotFoundError", () => Effect.succeed(false)),
  (effect, session) =>
    Effect.catch(effect, (lookupError) =>
      Effect.as(
        Effect.logWarning(`Could not look up the transcript of session ${session.id}; starting it fresh`, lookupError),
        false
      )
    )
);

// Every launch carries the status hooks; the env var tells them which file to write. Clearing that file first keeps a
// word left by the last run from showing.
const prepareLaunch = Effect.fn("ClaudeCodeHarnessInfraService.prepareLaunch")(function* (
  statusPaths: StatusPaths,
  session: SessionEntity
) {
  const fileSystem = yield* FileSystem;
  const path = yield* Path;
  const statusFilePath = path.join(statusPaths.statusDirectoryPath, session.id);
  yield* clearStatusFile(fileSystem, statusFilePath);
  const sessionArguments = (yield* hasTranscript(session)) ? ["--resume", session.id] : ["--session-id", session.id];
  const launchPlan: LaunchPlanValueObject = {
    command: "claude",
    commandArguments: [...sessionArguments, "--settings", statusPaths.hooksFilePath],
    environmentVariables: {[STATUS_ENV]: statusFilePath}
  };

  return launchPlan;
});

const makeClaudeCodeHarnessInfraService = Effect.fn("ClaudeCodeHarnessInfraService.make")(function* () {
  const fileSystem = yield* FileSystem;
  const path = yield* Path;
  // Only these two services: providing the whole context would also hand over make's span as the parent.
  const fileServices = Context.add(Context.make(FileSystem, fileSystem), Path, path);
  const {extensionUri, globalStorageUri, Uri} = yield* VsCodeApi;
  const statusPaths: StatusPaths = {
    hooksFilePath: Uri.joinPath(extensionUri, HOOKS_FILE).fsPath,
    statusDirectoryPath: path.join(globalStorageUri.fsPath, "status")
  };
  const sessionStatuses: SessionStatusesReference = yield* SubscriptionRef.make<
    ReadonlyMap<SessionIdValueObject, StatusValueObject>
  >(new Map());
  const sessionTitles: SessionTitlesReference = yield* SubscriptionRef.make<ReadonlyMap<SessionIdValueObject, string>>(
    new Map()
  );
  const trackedSessions = (yield* ISessionRepository).sessions;
  yield* Effect.forkScoped(watchStatusDirectory(sessionStatuses, statusPaths.statusDirectoryPath));
  yield* Effect.forkScoped(
    watchTranscripts({sessionTitles, trackedSessions, transcriptProgressBySessionId: new Map()})
  );

  return {
    clearSessionStatus: (sessionId: SessionIdValueObject) =>
      clearStatusFile(fileSystem, path.join(statusPaths.statusDirectoryPath, sessionId)),
    getSessionTitle: (sessionId: SessionIdValueObject) => getSessionTitle(sessionTitles, sessionId),
    iconPath: Uri.joinPath(extensionUri, MODEL_ICONS.CLAUDE).fsPath,
    prepareLaunch: (session: SessionEntity) => Effect.provide(prepareLaunch(statusPaths, session), fileServices),
    sessionStatuses,
    sessionTitles
  };
});

// Claude Code's hooks (HOOKS_FILE) write one word per session to a file in global storage, which every window shares;
// its transcripts under ~/.claude/projects carry the titles.
export const ClaudeCodeHarnessInfraService = Layer.effect(IHarnessInfraService, makeClaudeCodeHarnessInfraService());
