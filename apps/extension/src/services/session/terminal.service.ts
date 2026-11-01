import {TerminalLaunchFailed, TerminalNotFound, UntrackedTerminal} from "@/errors/session.error.ts";
import {StatusService} from "@/services/session/status.service.ts";
import {VsCodeService} from "@/services/vscode.service.ts";
import {fromEvent, getClaudeIcon} from "@/services/vscode.utils.ts";
import {STATUS_ENV} from "@pkg/constants/src/extension.constant.ts";
import {Context, Effect, Layer, Option, Result, Stream, SubscriptionRef} from "effect";

import type {Session} from "@/services/session/store.service.ts";
import type {Terminal} from "vscode";

// The tab is named once, when it opens: VS Code's stable API cannot rename a terminal afterwards.
interface TerminalLaunch {
  readonly claudeArguments: readonly string[];
  readonly tabName: string;
}

export class TerminalService extends Context.Service<
  TerminalService,
  {
    readonly closeSessionTerminal: (sessionId: string) => Effect.Effect<void, TerminalNotFound>;
    readonly findTerminalSessionId: (terminal: Terminal) => Effect.Effect<string, UntrackedTerminal>;
    readonly focusSessionTerminal: (sessionId: string) => Effect.Effect<void, TerminalNotFound>;
    readonly isSessionTerminalOpen: (sessionId: string) => Effect.Effect<boolean>;
    readonly openSessionTerminal: (
      session: Session,
      terminalLaunch: TerminalLaunch
    ) => Effect.Effect<void, TerminalLaunchFailed>;
    readonly sessionTerminals: SubscriptionRef.SubscriptionRef<ReadonlyMap<string, Terminal>>;
    readonly viewedSessionId: SubscriptionRef.SubscriptionRef<Option.Option<string>>;
  }
>()("aggregor/services/session/terminal.service/TerminalService") {
  public static readonly layer = Layer.effect(
    TerminalService,
    Effect.gen(function* () {
      const {TabInputTerminal, ViewColumn, window} = yield* VsCodeService;
      const {clearStatusFile, getStatusFilePath, hooksFilePath} = yield* StatusService;
      const claudeIconPath = yield* getClaudeIcon();
      const sessionTerminals = yield* SubscriptionRef.make<ReadonlyMap<string, Terminal>>(new Map());

      const findSessionTerminal = Effect.fn("TerminalService.findSessionTerminal")(function* (sessionId: string) {
        const openTerminals = yield* SubscriptionRef.get(sessionTerminals);

        return yield* Effect.fromResult(
          Result.fromNullishOr(openTerminals.get(sessionId), () => new TerminalNotFound({sessionId}))
        );
      });

      const isSessionTerminalOpen = Effect.fn("TerminalService.isSessionTerminalOpen")(function* (sessionId: string) {
        const openTerminals = yield* SubscriptionRef.get(sessionTerminals);

        return openTerminals.has(sessionId);
      });

      // ponytail: linear scan, a window holds a handful of sessions
      const findTerminalSessionId = Effect.fn("TerminalService.findTerminalSessionId")(function* (terminal: Terminal) {
        const openTerminals = yield* SubscriptionRef.get(sessionTerminals);
        const [sessionId] = yield* Effect.fromResult(
          Result.fromNullishOr(
            [...openTerminals].find(([, openTerminal]) => openTerminal === terminal),
            () => new UntrackedTerminal()
          )
        );

        return sessionId;
      });

      // Every launch carries the status hooks; the env var tells them which file to write.
      const launchSessionTerminal = Effect.fn("TerminalService.launchSessionTerminal")(function* (
        session: Session,
        terminalLaunch: TerminalLaunch
      ) {
        yield* clearStatusFile(session.id);

        return yield* Effect.try({
          catch: (cause) => new TerminalLaunchFailed({cause}),
          try: () =>
            window.createTerminal({
              cwd: session.cwd,
              env: {[STATUS_ENV]: getStatusFilePath(session.id)},
              iconPath: claudeIconPath,
              isTransient: true,
              location: {viewColumn: ViewColumn.Active},
              name: terminalLaunch.tabName,
              shellArgs: [...terminalLaunch.claudeArguments, "--settings", hooksFilePath],
              shellPath: "claude"
            })
        });
      });

      const showTerminal = Effect.fn("TerminalService.showTerminal")(function* (terminal: Terminal) {
        yield* Effect.sync(() => {
          terminal.show();
        });
      });

      const focusSessionTerminal = Effect.fn("TerminalService.focusSessionTerminal")(function* (sessionId: string) {
        yield* showTerminal(yield* findSessionTerminal(sessionId));
      });

      // The session's terminal if this window already has one, otherwise a newly launched one.
      const reuseOrLaunchSessionTerminal = Effect.fn("TerminalService.reuseOrLaunchSessionTerminal")(function* (
        currentTerminals: ReadonlyMap<string, Terminal>,
        session: Session,
        terminalLaunch: TerminalLaunch
      ) {
        const existingTerminal = Option.fromNullishOr(currentTerminals.get(session.id));
        if (Option.isSome(existingTerminal)) return [existingTerminal.value, currentTerminals] as const;

        const launchedTerminal = yield* launchSessionTerminal(session, terminalLaunch);

        return [launchedTerminal, new Map(currentTerminals).set(session.id, launchedTerminal)] as const;
      });

      // Serialized on the map's permit, so a double-click shows the terminal the first click launched.
      const openSessionTerminal = Effect.fn("TerminalService.openSessionTerminal")(function* (
        session: Session,
        terminalLaunch: TerminalLaunch
      ) {
        const sessionTerminal = yield* SubscriptionRef.modifyEffect(sessionTerminals, (currentTerminals) =>
          reuseOrLaunchSessionTerminal(currentTerminals, session, terminalLaunch)
        );

        yield* showTerminal(sessionTerminal);
      });

      // Disposing fires onDidCloseTerminal, which drops the map entry.
      const closeSessionTerminal = Effect.fn("TerminalService.closeSessionTerminal")(function* (sessionId: string) {
        const sessionTerminal = yield* findSessionTerminal(sessionId);

        yield* Effect.sync(() => {
          sessionTerminal.dispose();
        });
      });

      // A closed tab ends the agent but keeps the session listed, so clicking it can resume.
      const forgetClosedTerminal = Effect.fn("TerminalService.forgetClosedTerminal")(function* (
        closedTerminal: Terminal
      ) {
        const sessionId = yield* findTerminalSessionId(closedTerminal);

        yield* SubscriptionRef.update(sessionTerminals, (currentTerminals) => {
          const remainingTerminals = new Map(currentTerminals);
          remainingTerminals.delete(sessionId);

          return remainingTerminals;
        });
      });

      yield* Effect.forkScoped(
        Stream.runForEach(fromEvent(window.onDidCloseTerminal), (closedTerminal) =>
          forgetClosedTerminal(closedTerminal).pipe(Effect.catchTag("UntrackedTerminal", () => Effect.void))
        )
      );

      // The session in front of the user: the window has focus, the active tab is a terminal, and that terminal is
      // ours. A tab does not say which terminal it holds, so the active terminal fills that in.
      const viewedSessionId = yield* SubscriptionRef.make<Option.Option<string>>(Option.none());

      const readViewedSessionId = Effect.fn("TerminalService.readViewedSessionId")(function* () {
        const {activeTab} = window.tabGroups.activeTabGroup;
        const {activeTerminal} = window;
        if (!window.state.focused || !(activeTab?.input instanceof TabInputTerminal) || activeTerminal === undefined) {
          return Option.none<string>();
        }

        return yield* Effect.option(findTerminalSessionId(activeTerminal));
      });

      const updateViewedSessionId = Effect.fn("TerminalService.updateViewedSessionId")(function* () {
        const nextViewedSessionId = yield* readViewedSessionId();
        const currentViewedSessionId = yield* SubscriptionRef.get(viewedSessionId);
        if (Option.getOrUndefined(nextViewedSessionId) === Option.getOrUndefined(currentViewedSessionId)) return;

        yield* SubscriptionRef.set(viewedSessionId, nextViewedSessionId);
      });

      // Switching tabs fires the tab and active-terminal events separately and in either order, so wait for them to
      // settle; reading in between could credit the tab being left.
      const focusChanges = Stream.debounce(
        Stream.merge(
          Stream.merge(fromEvent(window.onDidChangeActiveTerminal), fromEvent(window.onDidChangeWindowState)),
          Stream.merge(
            Stream.merge(fromEvent(window.tabGroups.onDidChangeTabs), fromEvent(window.tabGroups.onDidChangeTabGroups)),
            SubscriptionRef.changes(sessionTerminals)
          )
        ),
        "100 millis"
      );
      yield* Effect.forkScoped(Stream.runForEach(focusChanges, () => updateViewedSessionId()));

      return TerminalService.of({
        closeSessionTerminal,
        findTerminalSessionId,
        focusSessionTerminal,
        isSessionTerminalOpen,
        openSessionTerminal,
        sessionTerminals,
        viewedSessionId
      });
    })
  );
}
