import {RemoveCancelled} from "@/errors/session.error.ts";
import {ErrorService} from "@/services/error.service.ts";
import {pickRepo} from "@/services/repo/repo.utils.ts";
import {StatusService} from "@/services/session/status.service.ts";
import {addSession, deleteSession, findSession} from "@/services/session/store.utils.ts";
import {TerminalService} from "@/services/session/terminal.service.ts";
import {TranscriptService} from "@/services/session/transcript.service.ts";
import {findTranscript} from "@/services/session/transcript.utils.ts";
import {VscService} from "@/services/vsc.service.ts";
import {ACTIONS, SESSION_MESSAGES} from "@pkg/constants/src/message.constant.ts";
import {Effect, Match, Option} from "effect";

import type {Repo} from "@/services/repo/repo.service.ts";
import type {Session} from "@/services/session/store.service.ts";

// The name Claude gave the conversation, or ours until it has one.
const displayName = Effect.fn("displayName")(function* (session: Session) {
  const title = yield* TranscriptService.use((service) => service.titleOf(session.id));

  return Option.getOrElse(title, () => session.name);
});

const isResumable = Effect.fn("isResumable")(function* (id: string) {
  yield* findTranscript(id);

  return true;
});

// A failed lookup counts as "no transcript": starting fresh is better than a resume that cannot work.
const claudeArgs = Effect.fn("claudeArgs")(function* (session: Session) {
  const resumable = yield* isResumable(session.id).pipe(Effect.orElseSucceed(() => false));

  return resumable ? ["--resume", session.id] : ["--session-id", session.id];
});

const startSession = Effect.fn("startSession")(function* (target: Repo | undefined) {
  const repo = target ?? (yield* pickRepo());
  const session = yield* addSession(repo);

  yield* TerminalService.use((service) =>
    service.open(session, {name: session.name, shellArgs: ["--session-id", session.id]})
  ).pipe(Effect.tapError(() => deleteSession(session.id)));
});

const relaunchSession = Effect.fn("relaunchSession")(function* (id: string) {
  const session = yield* findSession(id);
  const [name, shellArgs] = yield* Effect.all([displayName(session), claudeArgs(session)]);

  yield* TerminalService.use((service) => service.open(session, {name, shellArgs}));
});

const confirmRemove = Effect.fn("confirmRemove")(function* (session: Session) {
  const {window} = yield* VscService;
  const name = yield* displayName(session);

  return yield* Effect.filterOrFail(
    Effect.promise(async () =>
      window.showWarningMessage(SESSION_MESSAGES.CONFIRM_REMOVE_RUNNING(name), {modal: true}, ACTIONS.REMOVE)
    ),
    (choice) => choice === ACTIONS.REMOVE,
    () => new RemoveCancelled()
  );
});

// Confirm, then forget the session, then stop the agent, so a failed write never kills it for nothing.
const removeAndStop = Effect.fn("removeAndStop")(function* (session: Session) {
  const open = yield* TerminalService.use((service) => service.isOpen(session.id));
  if (open) yield* confirmRemove(session);

  yield* deleteSession(session.id);
  if (open) {
    yield* TerminalService.use((service) => service.close(session.id)).pipe(
      Effect.catchTag("TerminalNotFound", () => Effect.void)
    );
  }
  // ponytail: the dying agent's SessionEnd hook can rewrite the file after this; a few bytes per removed running
  // session. Wait for the process to exit first if the folder ever matters.
  yield* StatusService.use((service) => service.clear(session.id));
});

// A repo row's inline button passes its Repo; the title-bar button and the palette pass nothing, so the user picks one.
export const newSession = Effect.fn("newSession")(function* (repo?: Repo) {
  return yield* startSession(repo).pipe(
    Effect.catchTag("RepoPickCancelled", () => Effect.void),
    Effect.catch((error) =>
      Effect.forkDetach(
        ErrorService.use((service) =>
          service.show(
            Match.valueTags(error, {
              NoRepo: () => SESSION_MESSAGES.REPO_REQUIRED,
              SessionsCorrupt: () => SESSION_MESSAGES.UNREADABLE,
              SessionsSaveFailed: () => SESSION_MESSAGES.SAVE_FAILED,
              TerminalLaunchFailed: () => SESSION_MESSAGES.LAUNCH_FAILED
            })
          )
        )
      )
    )
  );
});

// Focuses the session's tab, or relaunches Claude on the same conversation when the tab is gone.
export const openSession = Effect.fn("openSession")(function* (id: string) {
  return yield* TerminalService.use((service) => service.focus(id)).pipe(
    Effect.catchTag("TerminalNotFound", () => relaunchSession(id)),
    Effect.catch((error) =>
      Effect.forkDetach(
        ErrorService.use((service) =>
          service.show(
            Match.valueTags(error, {
              SessionNotFound: () => SESSION_MESSAGES.NOT_FOUND,
              TerminalLaunchFailed: () => SESSION_MESSAGES.LAUNCH_FAILED
            })
          )
        )
      )
    )
  );
});

// The inline tree button passes the Session itself. Claude's transcript on disk is left alone.
export const removeSession = Effect.fn("removeSession")(function* (session: Session) {
  return yield* removeAndStop(session).pipe(
    Effect.catchTag("RemoveCancelled", () => Effect.void),
    Effect.catch((error) =>
      Effect.forkDetach(
        ErrorService.use((service) =>
          service.show(
            Match.valueTags(error, {
              SessionsCorrupt: () => SESSION_MESSAGES.UNREADABLE,
              SessionsSaveFailed: () => SESSION_MESSAGES.SAVE_FAILED
            })
          )
        )
      )
    )
  );
});
