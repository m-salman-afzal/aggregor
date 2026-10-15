import {TerminalLaunchFailed, TerminalNotFound, UntrackedTerminal} from "@/errors/session.error.ts";
import {StatusService} from "@/services/session/status.service.ts";
import {VscService} from "@/services/vsc.service.ts";
import {fromEvent, getClaudeIcon} from "@/services/vsc.utils.ts";
import {STATUS_ENV} from "@pkg/constants/src/extension.constant.ts";
import {Context, Effect, Layer, Option, Result, Stream, SubscriptionRef} from "effect";

import type {Session} from "@/services/session/store.service.ts";
import type {Terminal} from "vscode";

// The tab is named once, when it opens: VS Code's stable API cannot rename a terminal afterwards.
export interface TerminalLaunch {
  readonly name: string;
  readonly shellArgs: readonly string[];
}

export class TerminalService extends Context.Service<
  TerminalService,
  {
    readonly close: (id: string) => Effect.Effect<void, TerminalNotFound>;
    readonly focus: (id: string) => Effect.Effect<void, TerminalNotFound>;
    readonly isOpen: (id: string) => Effect.Effect<boolean>;
    readonly open: (session: Session, launch: TerminalLaunch) => Effect.Effect<void, TerminalLaunchFailed>;
    readonly sessionIdOf: (terminal: Terminal) => Effect.Effect<string, UntrackedTerminal>;
    readonly terminals: SubscriptionRef.SubscriptionRef<ReadonlyMap<string, Terminal>>;
    readonly viewed: SubscriptionRef.SubscriptionRef<Option.Option<string>>;
  }
>()("aggregor/services/session/terminal.service/TerminalService") {
  public static readonly layer = Layer.effect(
    TerminalService,
    Effect.gen(function* () {
      const {TabInputTerminal, ViewColumn, window} = yield* VscService;
      const {clear, fileOf, hooksFile} = yield* StatusService;
      const iconPath = yield* getClaudeIcon();
      const terminals = yield* SubscriptionRef.make<ReadonlyMap<string, Terminal>>(new Map());

      const findTerminal = Effect.fn("findTerminal")(function* (id: string) {
        const open = yield* SubscriptionRef.get(terminals);

        return yield* Effect.fromResult(Result.fromNullishOr(open.get(id), () => new TerminalNotFound({id})));
      });

      const isOpen = Effect.fn("isOpen")(function* (id: string) {
        const open = yield* SubscriptionRef.get(terminals);

        return open.has(id);
      });

      // ponytail: linear scan, a window holds a handful of sessions
      const sessionIdOf = Effect.fn("sessionIdOf")(function* (terminal: Terminal) {
        const open = yield* SubscriptionRef.get(terminals);
        const [id] = yield* Effect.fromResult(
          Result.fromNullishOr(
            [...open].find(([, candidate]) => candidate === terminal),
            () => new UntrackedTerminal()
          )
        );

        return id;
      });

      // Every launch carries the status hooks; the env var tells them which file to write.
      const launchTerminal = Effect.fn("launchTerminal")(function* (session: Session, launch: TerminalLaunch) {
        yield* clear(session.id);

        return yield* Effect.try({
          catch: (cause) => new TerminalLaunchFailed({cause}),
          try: () =>
            window.createTerminal({
              cwd: session.cwd,
              env: {[STATUS_ENV]: fileOf(session.id)},
              iconPath,
              isTransient: true,
              location: {viewColumn: ViewColumn.Active},
              name: launch.name,
              shellArgs: [...launch.shellArgs, "--settings", hooksFile],
              shellPath: "claude"
            })
        });
      });

      const showTerminal = Effect.fn("showTerminal")(function* (terminal: Terminal) {
        yield* Effect.sync(() => {
          terminal.show();
        });
      });

      const focus = Effect.fn("focus")(function* (id: string) {
        yield* showTerminal(yield* findTerminal(id));
      });

      // The session's terminal if this window already has one, otherwise a newly launched one.
      const reuseOrLaunch = Effect.fn("reuseOrLaunch")(function* (
        current: ReadonlyMap<string, Terminal>,
        session: Session,
        launch: TerminalLaunch
      ) {
        const existing = Option.fromNullishOr(current.get(session.id));
        if (Option.isSome(existing)) return [existing.value, current] as const;

        const launched = yield* launchTerminal(session, launch);

        return [launched, new Map(current).set(session.id, launched)] as const;
      });

      // Serialized on the map's permit, so a double-click shows the terminal the first click launched.
      const open = Effect.fn("open")(function* (session: Session, launch: TerminalLaunch) {
        const terminal = yield* SubscriptionRef.modifyEffect(terminals, (current) =>
          reuseOrLaunch(current, session, launch)
        );

        yield* showTerminal(terminal);
      });

      // Disposing fires onDidCloseTerminal, which drops the map entry.
      const close = Effect.fn("close")(function* (id: string) {
        const terminal = yield* findTerminal(id);

        yield* Effect.sync(() => {
          terminal.dispose();
        });
      });

      // A closed tab ends the agent but keeps the session listed, so clicking it can resume.
      const forget = Effect.fn("forget")(function* (terminal: Terminal) {
        const id = yield* sessionIdOf(terminal);

        yield* SubscriptionRef.update(terminals, (current) => {
          const next = new Map(current);
          next.delete(id);

          return next;
        });
      });

      yield* Effect.forkScoped(
        Stream.runForEach(fromEvent(window.onDidCloseTerminal), (terminal) =>
          forget(terminal).pipe(Effect.catchTag("UntrackedTerminal", () => Effect.void))
        )
      );

      // The session in front of the user: the window has focus, the active tab is a terminal, and that terminal is
      // ours. A tab does not say which terminal it holds, so the active terminal fills that in.
      const viewed = yield* SubscriptionRef.make<Option.Option<string>>(Option.none());

      const inView = Effect.fn("inView")(function* () {
        const tab = window.tabGroups.activeTabGroup.activeTab;
        const terminal = window.activeTerminal;
        if (!window.state.focused || !(tab?.input instanceof TabInputTerminal) || terminal === undefined) {
          return Option.none<string>();
        }

        return yield* Effect.option(sessionIdOf(terminal));
      });

      const updateViewed = Effect.fn("updateViewed")(function* () {
        const next = yield* inView();
        const current = yield* SubscriptionRef.get(viewed);
        if (Option.getOrUndefined(next) === Option.getOrUndefined(current)) return;

        yield* SubscriptionRef.set(viewed, next);
      });

      // Switching tabs fires the tab and active-terminal events separately and in either order, so wait for them to
      // settle; reading in between could credit the tab being left.
      const focusChanges = Stream.debounce(
        Stream.merge(
          Stream.merge(fromEvent(window.onDidChangeActiveTerminal), fromEvent(window.onDidChangeWindowState)),
          Stream.merge(
            Stream.merge(fromEvent(window.tabGroups.onDidChangeTabs), fromEvent(window.tabGroups.onDidChangeTabGroups)),
            SubscriptionRef.changes(terminals)
          )
        ),
        "100 millis"
      );
      yield* Effect.forkScoped(Stream.runForEach(focusChanges, () => updateViewed()));

      return TerminalService.of({close, focus, isOpen, open, sessionIdOf, terminals, viewed});
    })
  );
}
