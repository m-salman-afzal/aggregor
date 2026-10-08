import {FolderPickCancelled, NoWorkspaceFolder} from "@/errors/session.error.ts";
import {ErrorService} from "@/services/git/error.service.ts";
import {addSession, removeSession} from "@/services/session/store.utils.ts";
import {TerminalService} from "@/services/session/terminal.service.ts";
import {VscService} from "@/services/vsc.service.ts";
import {Effect, Match, Result} from "effect";

const getWorkspaceFolders = Effect.fn("getWorkspaceFolders")(function* () {
  const {workspace} = yield* VscService;

  return yield* Effect.fromResult(Result.fromNullishOr(workspace.workspaceFolders, () => new NoWorkspaceFolder()));
});

const showFolderPick = Effect.fn("showFolderPick")(function* () {
  const {window} = yield* VscService;
  const picked = yield* Effect.promise(async () => window.showWorkspaceFolderPick());

  return yield* Effect.fromResult(Result.fromNullishOr(picked, () => new FolderPickCancelled()));
});

const pickFolder = Effect.fn("pickFolder")(function* () {
  const folders = yield* getWorkspaceFolders();
  if (folders.length > 1) return yield* showFolderPick();

  return yield* Effect.fromResult(Result.fromNullishOr(folders[0], () => new NoWorkspaceFolder()));
});

const startSession = Effect.fn("startSession")(function* () {
  const folder = yield* pickFolder();
  const session = yield* addSession(folder);

  yield* TerminalService.use((service) => service.open(session)).pipe(Effect.tapError(() => removeSession(session.id)));
});

export const newSession = Effect.fn("newSession")(function* () {
  return yield* startSession().pipe(
    Effect.catchTag("FolderPickCancelled", () => Effect.void),
    Effect.catch((error) =>
      Effect.forkDetach(
        ErrorService.use((service) =>
          service.show(
            Match.valueTags(error, {
              NoWorkspaceFolder: () => "Open a folder to start a session.",
              TerminalLaunchFailed: () => "Could not open a terminal for the session."
            })
          )
        )
      )
    )
  );
});

export const focusSession = Effect.fn("focusSession")(function* (id: string) {
  return yield* TerminalService.use((service) => service.focus(id)).pipe(
    Effect.catchTag("TerminalNotFound", () =>
      Effect.forkDetach(ErrorService.use((service) => service.show("This session's terminal is no longer open.")))
    )
  );
});
