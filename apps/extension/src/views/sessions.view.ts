import {NoActiveTerminal, RevealFailed} from "@/errors/session.error.ts";
import {SessionStore} from "@/services/session/store.service.ts";
import {findSession, listSessions} from "@/services/session/store.utils.ts";
import {TerminalService} from "@/services/session/terminal.service.ts";
import {TranscriptService} from "@/services/session/transcript.service.ts";
import {VscService} from "@/services/vsc.service.ts";
import {fromEvent, getClaudeIcon} from "@/services/vsc.utils.ts";
import {COMMANDS, CONTEXT_VALUES, VIEWS} from "@pkg/constants/src/extension.constant.ts";
import {SESSION_LABELS} from "@pkg/constants/src/message.constant.ts";
import {Effect, Layer, Option, Result, Stream, SubscriptionRef} from "effect";
import {Path} from "effect/Path";

import type {Session} from "@/services/session/store.service.ts";
import type {Terminal, TreeView} from "vscode";

const toTreeItem = Effect.fn("toTreeItem")(function* (session: Session) {
  const {TreeItem} = yield* VscService;
  const path = yield* Path;
  const open = yield* TerminalService.use((service) => service.isOpen(session.id));
  const title = yield* TranscriptService.use((service) => service.titleOf(session.id));
  const item = new TreeItem(Option.getOrElse(title, () => session.name));
  item.id = session.id;
  item.iconPath = yield* getClaudeIcon();
  item.description = SESSION_LABELS.DESCRIPTION(path.basename(session.cwd), !open);
  item.tooltip = SESSION_LABELS.TOOLTIP(session.name, session.cwd);
  item.contextValue = CONTEXT_VALUES.SESSION;
  item.command = {arguments: [session.id], command: COMMANDS.OPEN_SESSION, title: SESSION_LABELS.OPEN_SESSION};

  return item;
});

// Selects the session whose tab became active. Skipped while the view is hidden, since reveal would open it.
const revealSession = Effect.fn("revealSession")(function* (view: TreeView<Session>, terminal: Terminal | undefined) {
  const active = yield* Effect.fromResult(Result.fromNullishOr(terminal, () => new NoActiveTerminal()));
  const id = yield* TerminalService.use((service) => service.sessionIdOf(active));
  const session = yield* findSession(id);
  if (!view.visible) return;

  yield* Effect.tryPromise({
    catch: (cause) => new RevealFailed({cause}),
    try: async () => view.reveal(session, {focus: false, select: true})
  });
});

// Registers the Sessions tree for the lifetime of the runtime; disposing the runtime unregisters it.
export const SessionsView = Layer.effectDiscard(
  Effect.gen(function* () {
    const {EventEmitter, window} = yield* VscService;
    const {sessions} = yield* SessionStore;
    const {terminals} = yield* TerminalService;
    const {titles} = yield* TranscriptService;
    const run = Effect.runSyncWith(
      yield* Effect.context<Path | SessionStore | TerminalService | TranscriptService | VscService>()
    );

    const changed = yield* Effect.acquireRelease(
      Effect.sync(() => new EventEmitter<void>()),
      (emitter) =>
        Effect.sync(() => {
          emitter.dispose();
        })
    );
    const view = yield* Effect.acquireRelease(
      Effect.sync(() =>
        window.createTreeView<Session>(VIEWS.SESSIONS, {
          treeDataProvider: {
            getChildren: (element) => (element ? [] : [...run(listSessions())]),
            getParent: () => undefined,
            getTreeItem: (session) => run(toTreeItem(session)),
            onDidChangeTreeData: changed.event
          }
        })
      ),
      (treeView) =>
        Effect.sync(() => {
          treeView.dispose();
        })
    );

    const refresh = Effect.fn("refreshSessionsTree")(function* () {
      yield* Effect.sync(() => {
        changed.fire();
      });
    });

    // Rows change when a session is added or removed, when its tab opens or closes, and when Claude renames it.
    const rowChanges = Stream.merge(
      Stream.merge(SubscriptionRef.changes(sessions), SubscriptionRef.changes(terminals)),
      SubscriptionRef.changes(titles)
    );
    yield* Effect.forkScoped(Stream.runForEach(rowChanges, () => refresh()));
    yield* Effect.forkScoped(
      Stream.runForEach(fromEvent(window.onDidChangeActiveTerminal), (terminal) =>
        Effect.ignore(revealSession(view, terminal))
      )
    );
  })
);
