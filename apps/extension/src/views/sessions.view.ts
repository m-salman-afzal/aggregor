import {NoActiveTerminal, RevealFailed} from "@/errors/session.error.ts";
import {StatusService} from "@/services/session/status.service.ts";
import {SessionStore} from "@/services/session/store.service.ts";
import {findSession, listSessions} from "@/services/session/store.utils.ts";
import {TerminalService} from "@/services/session/terminal.service.ts";
import {TranscriptService} from "@/services/session/transcript.service.ts";
import {VscService} from "@/services/vsc.service.ts";
import {fromEvent, getClaudeIcon} from "@/services/vsc.utils.ts";
import {
  COMMANDS,
  CONTEXT_VALUES,
  SESSION_URI_SCHEME,
  SPINNER_INTERVAL_MS,
  STATUS_BADGES,
  VIEWS
} from "@pkg/constants/src/extension.constant.ts";
import {SESSION_LABELS, STATUS_LABELS} from "@pkg/constants/src/message.constant.ts";
import {Clock, Effect, Layer, Option, Ref, Result, Schedule, Stream, SubscriptionRef} from "effect";
import {Path} from "effect/Path";

import type {Status} from "@/services/session/status.service.ts";
import type {Session} from "@/services/session/store.service.ts";
import type {Terminal, TreeView, Uri} from "vscode";

// What a row shows. "unread" is an idle session whose last turn ended while it was out of view; undefined is a
// terminal whose hooks have not fired yet.
type RowStatus = "unread" | Status;

// Without a terminal in this window the agent is gone; with one, the hooks say what it is doing.
const rowStatus = Effect.fn("rowStatus")(function* (id: string, unread: ReadonlySet<string>) {
  const open = yield* TerminalService.use((service) => service.isOpen(id));
  if (!open) return "exited" satisfies RowStatus;

  const {statuses} = yield* StatusService;
  const status = (yield* SubscriptionRef.get(statuses)).get(id);

  return status === "idle" && unread.has(id) ? ("unread" satisfies RowStatus) : status;
});

// The handle the status badge hangs off; the decoration provider reads the session id back from the path.
const sessionUri = Effect.fn("sessionUri")(function* (id: string) {
  const {Uri} = yield* VscService;

  return Uri.from({path: `/${id}`, scheme: SESSION_URI_SCHEME});
});

const toTreeItem = Effect.fn("toTreeItem")(function* (session: Session, status: RowStatus | undefined) {
  const {TreeItem} = yield* VscService;
  const path = yield* Path;
  const statusText = status === undefined ? undefined : STATUS_LABELS[status];
  const title = yield* TranscriptService.use((service) => service.titleOf(session.id));
  const label = Option.getOrElse(title, () => session.name);
  const folder = path.basename(session.cwd);
  const item = new TreeItem(label);
  item.id = session.id;
  item.iconPath = yield* getClaudeIcon();
  item.resourceUri = yield* sessionUri(session.id);
  item.description = folder;
  item.tooltip = SESSION_LABELS.TOOLTIP(session.name, session.cwd, statusText);
  item.accessibilityInformation = {label: SESSION_LABELS.ACCESSIBLE(label, folder, statusText)};
  item.contextValue = CONTEXT_VALUES.SESSION;
  item.command = {arguments: [session.id], command: COMMANDS.OPEN_SESSION, title: SESSION_LABELS.OPEN_SESSION};

  return item;
});

const toDecoration = Effect.fn("toDecoration")(function* (status: RowStatus | undefined) {
  if (status === undefined || status === "idle") return undefined;

  const {FileDecoration, ThemeColor} = yield* VscService;
  const {color, frames} = STATUS_BADGES[status];
  const frame = Math.floor((yield* Clock.currentTimeMillis) / SPINNER_INTERVAL_MS) % frames.length;

  return new FileDecoration(frames[frame], STATUS_LABELS[status], new ThemeColor(color));
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
    const {terminals, viewed} = yield* TerminalService;
    const {titles} = yield* TranscriptService;
    const {statuses} = yield* StatusService;
    const run = Effect.runSyncWith(
      yield* Effect.context<Path | SessionStore | StatusService | TerminalService | TranscriptService | VscService>()
    );

    // What each row was last drawn with; the tree and the badges both render from it. Only rows whose status moved are
    // named in the badge change event: one without URIs makes VS Code drop every cached badge, and all rows flash
    // plain until it fetches them again.
    const shown = yield* Ref.make<ReadonlyMap<string, RowStatus | undefined>>(new Map());
    const shownStatus = (id: string) => run(Ref.get(shown)).get(id);
    const unread = yield* Ref.make<ReadonlySet<string>>(new Set());
    const lastStatuses = yield* Ref.make<ReadonlyMap<string, Status>>(new Map());

    const changed = yield* Effect.acquireRelease(
      Effect.sync(() => new EventEmitter<void>()),
      (emitter) =>
        Effect.sync(() => {
          emitter.dispose();
        })
    );
    const decorationsChanged = yield* Effect.acquireRelease(
      Effect.sync(() => new EventEmitter<Uri[]>()),
      (emitter) =>
        Effect.sync(() => {
          emitter.dispose();
        })
    );
    yield* Effect.acquireRelease(
      Effect.sync(() =>
        window.registerFileDecorationProvider({
          onDidChangeFileDecorations: decorationsChanged.event,
          // VS Code asks about every file it shows, so anything not ours returns before running an effect.
          provideFileDecoration: (uri) =>
            uri.scheme === SESSION_URI_SCHEME ? run(toDecoration(shownStatus(uri.path.slice(1)))) : undefined
        })
      ),
      (provider) =>
        Effect.sync(() => {
          provider.dispose();
        })
    );
    const view = yield* Effect.acquireRelease(
      Effect.sync(() =>
        window.createTreeView<Session>(VIEWS.SESSIONS, {
          treeDataProvider: {
            getChildren: (element) => (element ? [] : [...run(listSessions())]),
            getParent: () => undefined,
            getTreeItem: (session) => run(toTreeItem(session, shownStatus(session.id))),
            onDidChangeTreeData: changed.event
          }
        })
      ),
      (treeView) =>
        Effect.sync(() => {
          treeView.dispose();
        })
    );

    // A turn that ends while its session is out of view leaves it unread until it comes into view or starts another
    // turn. Ended means idle now, and running or waiting on the user at the previous look.
    const syncUnread = Effect.fn("syncUnread")(function* () {
      const now = yield* SubscriptionRef.get(statuses);
      const before = yield* Ref.getAndSet(lastStatuses, now);
      const inView = Option.getOrUndefined(yield* SubscriptionRef.get(viewed));
      const ended = [...now]
        .filter(([id, status]) => status === "idle" && ["needs-input", "running"].includes(before.get(id) ?? ""))
        .map(([id]) => id);

      return yield* Ref.updateAndGet(
        unread,
        (current) => new Set([...current, ...ended].filter((id) => now.get(id) === "idle" && id !== inView))
      );
    });

    const changedRows = Effect.fn("changedRows")(function* (unreadNow: ReadonlySet<string>) {
      const all = yield* listSessions();
      const now = new Map(
        yield* Effect.forEach(all, (session) =>
          Effect.map(rowStatus(session.id, unreadNow), (status) => [session.id, status] as const)
        )
      );
      const before = yield* Ref.getAndSet(shown, now);
      const moved = [...now].filter(([id, status]) => !before.has(id) || before.get(id) !== status);

      return yield* Effect.forEach(moved, ([id]) => sessionUri(id));
    });

    const refresh = Effect.fn("refreshSessionsTree")(function* () {
      const uris = yield* changedRows(yield* syncUnread());

      yield* Effect.sync(() => {
        changed.fire();
        if (uris.length > 0) decorationsChanged.fire(uris);
      });
    });

    // ponytail: ticks for the view's whole life and returns at once when it is hidden or nothing runs. Start and stop
    // it on status changes if the idle wake-ups ever show up in a profile.
    const tickSpinners = Effect.fn("tickSpinners")(function* () {
      const running = [...(yield* Ref.get(shown))].filter(([, status]) => status === "running");
      if (!view.visible || running.length === 0) return;

      const uris = yield* Effect.forEach(running, ([id]) => sessionUri(id));
      yield* Effect.sync(() => {
        decorationsChanged.fire(uris);
      });
    });

    // Rows change when a session is added or removed, when its tab opens or closes, when Claude renames it, when its
    // status changes, and when it comes into view, which marks it read.
    const rowChanges = Stream.merge(
      Stream.merge(SubscriptionRef.changes(sessions), SubscriptionRef.changes(terminals)),
      Stream.merge(
        SubscriptionRef.changes(titles),
        Stream.merge(SubscriptionRef.changes(statuses), SubscriptionRef.changes(viewed))
      )
    );
    yield* Effect.forkScoped(Stream.runForEach(rowChanges, () => refresh()));
    yield* Effect.forkScoped(Effect.repeat(tickSpinners(), Schedule.spaced(SPINNER_INTERVAL_MS)));
    yield* Effect.forkScoped(
      Stream.runForEach(fromEvent(window.onDidChangeActiveTerminal), (terminal) =>
        Effect.ignore(revealSession(view, terminal))
      )
    );
  })
);
