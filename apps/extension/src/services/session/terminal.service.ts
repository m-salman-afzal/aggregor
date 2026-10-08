import {TerminalLaunchFailed, TerminalNotFound, UntrackedTerminal} from "@/errors/session.error.ts";
import {removeSession} from "@/services/session/store.utils.ts";
import {VscService} from "@/services/vsc.service.ts";
import {fromEvent, getProductIcon} from "@/services/vsc.utils.ts";
import {Context, Effect, Layer, Result, Stream} from "effect";

import type {Session} from "@/services/session/store.service.ts";
import type {Terminal} from "vscode";

export class TerminalService extends Context.Service<
  TerminalService,
  {
    readonly focus: (id: string) => Effect.Effect<void, TerminalNotFound>;
    readonly open: (session: Session) => Effect.Effect<void, TerminalLaunchFailed>;
    readonly sessionIdOf: (terminal: Terminal) => Effect.Effect<string, UntrackedTerminal>;
  }
>()("aggregor/services/session/terminal.service/TerminalService") {
  public static readonly layer = Layer.effect(
    TerminalService,
    Effect.gen(function* () {
      const {ViewColumn, window} = yield* VscService;
      const iconPath = yield* getProductIcon();
      const terminals = new Map<string, Terminal>();

      const findTerminal = Effect.fn("findTerminal")(function* (id: string) {
        return yield* Effect.fromResult(Result.fromNullishOr(terminals.get(id), () => new TerminalNotFound({id})));
      });

      // ponytail: linear scan, a window holds a handful of sessions
      const sessionIdOf = Effect.fn("sessionIdOf")(function* (terminal: Terminal) {
        const [id] = yield* Effect.fromResult(
          Result.fromNullishOr(
            [...terminals].find(([, open]) => open === terminal),
            () => new UntrackedTerminal()
          )
        );

        return id;
      });

      const launchTerminal = Effect.fn("launchTerminal")(function* (session: Session) {
        return yield* Effect.try({
          catch: (cause) => new TerminalLaunchFailed({cause}),
          try: () =>
            window.createTerminal({
              cwd: session.cwd,
              iconPath,
              isTransient: true,
              location: {viewColumn: ViewColumn.Active},
              name: session.name,
              shellArgs: ["--session-id", session.id],
              shellPath: "claude"
            })
        });
      });

      const focus = Effect.fn("focus")(function* (id: string) {
        const terminal = yield* findTerminal(id);

        yield* Effect.sync(() => {
          terminal.show();
        });
      });

      const open = Effect.fn("open")(function* (session: Session) {
        const terminal = yield* launchTerminal(session);

        yield* Effect.sync(() => {
          terminals.set(session.id, terminal);
          terminal.show();
        });
      });

      // Closing the tab kills the agent, so the session goes with it (until persistence + resume).
      const forget = Effect.fn("forget")(function* (terminal: Terminal) {
        const id = yield* sessionIdOf(terminal);

        yield* Effect.sync(() => terminals.delete(id));
        yield* removeSession(id);
      });

      yield* Effect.forkScoped(
        Stream.runForEach(fromEvent(window.onDidCloseTerminal), (terminal) =>
          forget(terminal).pipe(Effect.catchTag("UntrackedTerminal", () => Effect.void))
        )
      );

      return TerminalService.of({focus, open, sessionIdOf});
    })
  );
}
