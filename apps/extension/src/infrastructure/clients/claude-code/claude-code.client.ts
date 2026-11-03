import {HarnessClient} from "@/application/clients/harness.client.ts";
import {SessionRepository} from "@/domain/entities/session/session.repository.ts";
import {clearStatusFile, watchStatusDirectory} from "@/infrastructure/clients/claude-code/status.utils.ts";
import {getSessionTitle, watchTranscripts} from "@/infrastructure/clients/claude-code/titles.utils.ts";
import {findTranscriptFilePath} from "@/infrastructure/clients/claude-code/transcript.utils.ts";
import {VsCodeService} from "@/infrastructure/vscode/vscode.service.ts";
import {HOOKS_FILE, MODEL_ICONS, STATUS_ENV} from "@pkg/constants/src/extension.constant.ts";
import {Context, Effect, Layer, SubscriptionRef} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";

import type {Session} from "@/domain/entities/session/session.entity.ts";
import type {LaunchPlan} from "@/domain/value-objects/launch-plan.value-object.ts";
import type {SessionId} from "@/domain/value-objects/session-id.value-object.ts";
import type {Status} from "@/domain/value-objects/status.value-object.ts";
import type {SessionStatusesReference} from "@/infrastructure/clients/claude-code/status.utils.ts";
import type {SessionTitlesReference} from "@/infrastructure/clients/claude-code/titles.utils.ts";

// Where the launch reads its hooks from and where the hooks write each session's status.
interface StatusPaths {
  readonly hooksFilePath: string;
  readonly statusDirectoryPath: string;
}

// A failed lookup counts as "no transcript": starting fresh is better than a resume that cannot work.
const hasTranscript = Effect.fn("ClaudeCodeHarnessClient.hasTranscript")(
  function* (session: Session) {
    yield* findTranscriptFilePath(session.id);

    return true;
  },
  Effect.catchTag("TranscriptNotFound", () => Effect.succeed(false)),
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
const prepareLaunch = Effect.fn("ClaudeCodeHarnessClient.prepareLaunch")(function* (
  statusPaths: StatusPaths,
  session: Session
) {
  const fileSystem = yield* FileSystem;
  const path = yield* Path;
  const statusFilePath = path.join(statusPaths.statusDirectoryPath, session.id);
  yield* clearStatusFile(fileSystem, statusFilePath);
  const sessionArguments = (yield* hasTranscript(session)) ? ["--resume", session.id] : ["--session-id", session.id];
  const launchPlan: LaunchPlan = {
    command: "claude",
    commandArguments: [...sessionArguments, "--settings", statusPaths.hooksFilePath],
    environmentVariables: {[STATUS_ENV]: statusFilePath}
  };

  return launchPlan;
});

const makeClaudeCodeHarnessClient = Effect.fn("ClaudeCodeHarnessClient.make")(function* () {
  const fileSystem = yield* FileSystem;
  const path = yield* Path;
  // Only these two services: providing the whole context would also hand over make's span as the parent.
  const fileServices = Context.add(Context.make(FileSystem, fileSystem), Path, path);
  const {extensionUri, globalStorageUri, Uri} = yield* VsCodeService;
  const statusPaths: StatusPaths = {
    hooksFilePath: Uri.joinPath(extensionUri, HOOKS_FILE).fsPath,
    statusDirectoryPath: path.join(globalStorageUri.fsPath, "status")
  };
  const sessionStatuses: SessionStatusesReference = yield* SubscriptionRef.make<ReadonlyMap<SessionId, Status>>(
    new Map()
  );
  const sessionTitles: SessionTitlesReference = yield* SubscriptionRef.make<ReadonlyMap<SessionId, string>>(new Map());
  const trackedSessions = (yield* SessionRepository).sessions;
  yield* Effect.forkScoped(watchStatusDirectory(sessionStatuses, statusPaths.statusDirectoryPath));
  yield* Effect.forkScoped(
    watchTranscripts({sessionTitles, trackedSessions, transcriptProgressBySessionId: new Map()})
  );

  return {
    clearSessionStatus: (sessionId: SessionId) =>
      clearStatusFile(fileSystem, path.join(statusPaths.statusDirectoryPath, sessionId)),
    getSessionTitle: (sessionId: SessionId) => getSessionTitle(sessionTitles, sessionId),
    iconPath: Uri.joinPath(extensionUri, MODEL_ICONS.CLAUDE).fsPath,
    prepareLaunch: (session: Session) => Effect.provide(prepareLaunch(statusPaths, session), fileServices),
    sessionStatuses,
    sessionTitles
  };
});

// Claude Code's hooks (HOOKS_FILE) write one word per session to a file in global storage, which every window shares;
// its transcripts under ~/.claude/projects carry the titles.
export const ClaudeCodeHarnessClient = Layer.effect(HarnessClient, makeClaudeCodeHarnessClient());
