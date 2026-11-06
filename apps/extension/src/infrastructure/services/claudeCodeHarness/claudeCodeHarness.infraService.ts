import {
  clearStatusFile,
  watchStatusDirectory,
  writeIdleStatusFile
} from "@infraServices/claudeCodeHarness/status.utils.ts";
import {findTranscriptFilePath} from "@infraServices/claudeCodeHarness/transcript.utils.ts";
import {IHarnessInfraService} from "@interfaces/harness.infraService.interface.ts";
import {HOOKS_FILE, MODEL_ICONS, STATUS_ENV} from "@pkg/constants/src/extension.constant.ts";
import {VsCodeApi} from "@vscodeApi/vscode.api.ts";
import {Context, Effect, Layer, SubscriptionRef} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";

import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {SessionStatusesReference} from "@infraServices/claudeCodeHarness/claudeCodeHarness.infraService.type.ts";
import type {LaunchPlanValueObject} from "@valueObjects/launchPlan.valueObject.ts";
import type {SessionIdValueObject} from "@valueObjects/sessionId.valueObject.ts";
import type {StatusValueObject} from "@valueObjects/status.valueObject.ts";

// Where the launch reads its hooks from and where the hooks write each session's status.
interface StatusPaths {
  readonly hooksFilePath: string;
  readonly statusDirectoryPath: string;
}

// Claude's terminal reads "claude", its process name, then "Claude Code" until the conversation has a title, and
// "claude · resume" in its resume picker.
const PLACEHOLDER_TITLES: ReadonlySet<string> = new Set(["claude", "claude · resume", "Claude Code"]);

// Claude's title starts with ✳ while it waits for the user and with a spinner frame while a turn runs.
const IDLE_TITLE_MARK = "✳";

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
  yield* Effect.forkScoped(watchStatusDirectory(sessionStatuses, statusPaths.statusDirectoryPath));

  return {
    clearSessionStatus: (sessionId: SessionIdValueObject) =>
      clearStatusFile(fileSystem, path.join(statusPaths.statusDirectoryPath, sessionId)),
    iconPath: Uri.joinPath(extensionUri, MODEL_ICONS.CLAUDE).fsPath,
    idleTitleMark: IDLE_TITLE_MARK,
    placeholderTitles: PLACEHOLDER_TITLES,
    prepareLaunch: (session: SessionEntity) => Effect.provide(prepareLaunch(statusPaths, session), fileServices),
    sessionStatuses,
    settleSessionTurn: (sessionId: SessionIdValueObject) =>
      writeIdleStatusFile(fileSystem, path.join(statusPaths.statusDirectoryPath, sessionId))
  };
});

// Claude Code's hooks (HOOKS_FILE) write one word per session to a file in global storage, which every window shares;
// its terminal title carries the session's title.
export const ClaudeCodeHarnessInfraService = Layer.effect(IHarnessInfraService, makeClaudeCodeHarnessInfraService());
