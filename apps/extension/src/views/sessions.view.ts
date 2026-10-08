import {NoActiveTerminal, RevealFailed} from "@/errors/session.error.ts";
import {SessionStore} from "@/services/session/store.service.ts";
import {findSession, listSessions} from "@/services/session/store.utils.ts";
import {TerminalService} from "@/services/session/terminal.service.ts";
import {VscService} from "@/services/vsc.service.ts";
import {fromEvent, getProductIcon} from "@/services/vsc.utils.ts";
import {COMMANDS, VIEWS} from "@pkg/constants/src/extension.constant.ts";
import {Effect, Layer, Result, Stream, SubscriptionRef} from "effect";

import type {Session} from "@/services/session/store.service.ts";
import type {Terminal, TreeView} from "vscode";

const toTreeItem = Effect.fn("toTreeItem")(function* (session: Session) {
  const {TreeItem} = yield* VscService;
  const item = new TreeItem(session.name);
  item.id = session.id;
  item.iconPath = yield* getProductIcon();
  item.tooltip = session.cwd;
  item.command = {arguments: [session.id], command: COMMANDS.FOCUS_SESSION, title: "Focus Session"};

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
    const run = Effect.runSyncWith(yield* Effect.context<SessionStore | VscService>());

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

    yield* Effect.forkScoped(
      Stream.runForEach(SubscriptionRef.changes(sessions), () =>
        Effect.sync(() => {
          changed.fire();
        })
      )
    );
    yield* Effect.forkScoped(
      Stream.runForEach(fromEvent(window.onDidChangeActiveTerminal), (terminal) =>
        Effect.ignore(revealSession(view, terminal))
      )
    );
  })
);
