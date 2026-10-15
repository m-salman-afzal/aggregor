import {TerminalLaunchFailed, TerminalNotFound, UntrackedTerminal} from "@/errors/session.error.ts";
import {VscService} from "@/services/vsc.service.ts";
import {fromEvent, getClaudeIcon} from "@/services/vsc.utils.ts";
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
  }
>()("aggregor/services/session/terminal.service/TerminalService") {
  public static readonly layer = Layer.effect(
    TerminalService,
    Effect.gen(function* () {
      const {ViewColumn, window} = yield* VscService;
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

      const launchTerminal = Effect.fn("launchTerminal")(function* (session: Session, launch: TerminalLaunch) {
        return yield* Effect.try({
          catch: (cause) => new TerminalLaunchFailed({cause}),
          try: () =>
            window.createTerminal({
              cwd: session.cwd,
              iconPath,
              isTransient: true,
              location: {viewColumn: ViewColumn.Active},
              name: launch.name,
              shellArgs: [...launch.shellArgs],
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

      return TerminalService.of({close, focus, isOpen, open, sessionIdOf, terminals});
    })
  );
}
