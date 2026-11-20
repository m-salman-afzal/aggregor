import {NodeServices} from "@effect/platform-node";
import {FolderShellTerminalUtils} from "@infraServices/vscode/terminal/folderShellTerminal.utils.ts";
import {TerminalUtils} from "@infraServices/vscode/terminal/terminal.utils.ts";
import {ITerminalInfraService, ITerminalInfraServiceErrors} from "@interfaces/terminal.infraService.interface.ts";
import {AGENT_ICON} from "@pkg/constants/src/agent.constant.ts";
import {SETUP_TERMINAL} from "@pkg/constants/src/requiredTools.constant.ts";
import {SESSION_ID_ENV, VIEWED_SESSION_SETTLE_INTERVAL} from "@pkg/constants/src/terminal.constant.ts";
import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {VscodeUtils} from "@pkg/vscode/src/vscode.utils.ts";
import {Array, Context, Effect, Layer, Result, Stream, SubscriptionRef} from "effect";

import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {SessionTabRequest} from "@interfaces/terminal.infraService.interface.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {Terminal} from "vscode";

class TerminalInfraServiceErrors extends TaggedErrors({
  NoActiveTerminalError: {},
  NotATerminalTabError: {},
  WindowUnfocusedError: {}
}) {}

export class TerminalInfraService extends Context.Service<TerminalInfraService>()(
  "aggregor-app/infrastructure/services/vscode/terminal/terminal.infraService/TerminalInfraService",
  {
    make: Effect.fn("TerminalInfraService.make")(function* () {
      const vsCodeApi = yield* VsCodeApi;
      const vscodeUtils = yield* VscodeUtils;
      const terminalUtils = yield* TerminalUtils;
      const folderShellTerminalUtils = yield* FolderShellTerminalUtils;
      const sessionTerminals = terminalUtils.sessionTerminals;

      const findSessionTerminal = Effect.fn("TerminalInfraService.findSessionTerminal")(function* (
        sessionId: EntityIdValueObject
      ) {
        const openTerminals = yield* SubscriptionRef.get(sessionTerminals);

        return yield* Effect.fromResult(
          Result.fromNullishOr(openTerminals.get(sessionId), () =>
            ITerminalInfraServiceErrors.TerminalNotFoundError.make({sessionId})
          )
        );
      });

      // The tab is transient: VS Code drops a reattached tab's file icon, so it isn't kept over a reload or restored.
      const launchSessionTerminal = Effect.fn("TerminalInfraService.launchSessionTerminal")(function* (
        session: SessionEntity,
        sessionTabRequest: SessionTabRequest
      ) {
        return yield* Effect.try({
          catch: (cause) => ITerminalInfraServiceErrors.TerminalLaunchFailedError.make({cause}),
          try: () =>
            vsCodeApi.window.createTerminal({
              cwd: session.workingFolderPath,
              env: {[SESSION_ID_ENV]: session.id},
              iconPath: sessionTabRequest.isShared
                ? vsCodeApi.Uri.joinPath(vsCodeApi.extensionUri, AGENT_ICON.DEFAULT)
                : vsCodeApi.Uri.file(sessionTabRequest.icon),
              isTransient: true,
              location: {viewColumn: vsCodeApi.ViewColumn.Active},
              name: sessionTabRequest.tabName,
              shellArgs: [...sessionTabRequest.tabCommand.commandArguments],
              shellPath: sessionTabRequest.tabCommand.command
            })
        });
      });

      const showTerminal = Effect.fn("TerminalInfraService.showTerminal")(function* (terminal: Terminal) {
        yield* Effect.sync(() => {
          terminal.show();
        });
      });

      const openSetupTerminal = Effect.fn("TerminalInfraService.openSetupTerminal")(function* (commandLine: string) {
        yield* Effect.annotateCurrentSpan({commandLine});

        yield* Effect.sync(() => {
          vsCodeApi.window
            .createTerminal({
              name: SETUP_TERMINAL.NAME,
              shellArgs: ["-c", `${commandLine}${SETUP_TERMINAL.CLOSE_PROMPT}`],
              shellPath: SETUP_TERMINAL.SHELL
            })
            .show();
        });
      });

      const focusSessionTerminal = Effect.fn("TerminalInfraService.focusSessionTerminal")(function* (
        sessionId: EntityIdValueObject
      ) {
        const sessionTerminal = yield* findSessionTerminal(sessionId);
        yield* showTerminal(sessionTerminal);
      });

      // tmux can attach any open session tab to another session, so the first one is taken.
      const findOpenSessionTerminalProcessId = Effect.fn("TerminalInfraService.findOpenSessionTerminalProcessId")(
        function* () {
          const openTerminals = yield* SubscriptionRef.get(sessionTerminals);
          const openTerminal = yield* Effect.fromResult(
            Result.fromOption(Array.head([...openTerminals.values()]), () =>
              ITerminalInfraServiceErrors.NoSessionTabOpenError.make()
            )
          );
          const terminalProcessId = yield* terminalUtils.readTerminalProcessId(openTerminal);

          return yield* Effect.fromResult(
            Result.fromNullishOr(terminalProcessId, () => ITerminalInfraServiceErrors.NoSessionTabOpenError.make())
          );
        }
      );

      const findShownSessionTerminal = Effect.fn("TerminalInfraService.findShownSessionTerminal")(function* (
        shownSessionIdsByTabProcessId: ReadonlyMap<number, EntityIdValueObject>,
        assignedSessionId: EntityIdValueObject,
        sessionTerminal: Terminal
      ) {
        const terminalProcessId = yield* terminalUtils.readTerminalProcessId(sessionTerminal);
        const shownSessionId =
          terminalProcessId === undefined ? undefined : shownSessionIdsByTabProcessId.get(terminalProcessId);

        return [shownSessionId === undefined ? assignedSessionId : shownSessionId, sessionTerminal] as const;
      });

      // Serialized on the map's permit, so a double-click shows the terminal the first click launched.
      const openSessionTerminal = Effect.fn("TerminalInfraService.openSessionTerminal")(function* (
        session: SessionEntity,
        sessionTabRequest: SessionTabRequest
      ) {
        const sessionTerminal = yield* SubscriptionRef.modifyEffect(sessionTerminals, (currentTerminals) => {
          const existingTerminal = currentTerminals.get(session.id);
          if (existingTerminal !== undefined) return Effect.succeed([existingTerminal, currentTerminals] as const);

          return Effect.map(
            launchSessionTerminal(session, sessionTabRequest),
            (launchedTerminal) =>
              [launchedTerminal, new Map(currentTerminals).set(session.id, launchedTerminal)] as const
          );
        });

        yield* showTerminal(sessionTerminal);
        if (sessionTabRequest.isPinned) yield* terminalUtils.pinSessionTab(sessionTerminal);
      });

      const closeOtherSessionTerminals = Effect.fn("TerminalInfraService.closeOtherSessionTerminals")(function* (
        shownSessionId: EntityIdValueObject
      ) {
        const openTerminals = yield* SubscriptionRef.get(sessionTerminals);

        yield* Effect.sync(() => {
          for (const [sessionId, sessionTerminal] of openTerminals) {
            if (sessionId !== shownSessionId) sessionTerminal.dispose();
          }
        });
      });

      const forgetClosedTerminal = Effect.fn("TerminalInfraService.forgetClosedTerminal")(
        function* (closedTerminal: Terminal) {
          const sessionId = yield* terminalUtils.findTrackedSessionId(closedTerminal);

          yield* SubscriptionRef.update(sessionTerminals, (currentTerminals) => {
            const remainingTerminals = new Map(currentTerminals);
            remainingTerminals.delete(sessionId);

            return remainingTerminals;
          });
        },
        Effect.catchTag("UntrackedTerminalError", () => Effect.void)
      );

      // onDidCloseTerminal fires later, so the entry goes now, or a tab opened at once for the session would reuse the disposed one.
      const closeSessionTerminal = Effect.fn("TerminalInfraService.closeSessionTerminal")(function* (
        sessionId: EntityIdValueObject
      ) {
        const sessionTerminal = yield* findSessionTerminal(sessionId);
        yield* forgetClosedTerminal(sessionTerminal);

        yield* Effect.sync(() => {
          sessionTerminal.dispose();
        });
      });

      const findActiveTerminalSessionId = Effect.fn("TerminalInfraService.findActiveTerminalSessionId")(function* (
        activeTerminal: Terminal | undefined
      ) {
        const terminal = yield* Effect.fromResult(
          Result.fromNullishOr(activeTerminal, () => TerminalInfraServiceErrors.NoActiveTerminalError.make())
        );

        return yield* terminalUtils.findTrackedSessionId(terminal);
      });

      const watchActivatedSessionIds = Effect.fn("TerminalInfraService.watchActivatedSessionIds")(function* () {
        const activeTerminalChanges = yield* vscodeUtils.streamVsCodeEvent(vsCodeApi.window.onDidChangeActiveTerminal);

        return Stream.filterMapEffect(activeTerminalChanges, (activeTerminal) =>
          Effect.result(findActiveTerminalSessionId(activeTerminal))
        );
      });

      const forgetClosedTerminals = Effect.fn("TerminalInfraService.forgetClosedTerminals")(function* () {
        const closedTerminals = yield* vscodeUtils.streamVsCodeEvent(vsCodeApi.window.onDidCloseTerminal);
        yield* Effect.forkScoped(
          Stream.runForEach(closedTerminals, (closedTerminal) => forgetClosedTerminal(closedTerminal))
        );
      });

      // A tab does not say which terminal it holds, so the active terminal fills that in.
      const readViewedSessionId = Effect.fn("TerminalInfraService.readViewedSessionId")(function* () {
        if (!vsCodeApi.window.state.focused) return yield* TerminalInfraServiceErrors.WindowUnfocusedError.make();
        if (
          vsCodeApi.window.tabGroups.activeTabGroup.activeTab === undefined ||
          !(vsCodeApi.window.tabGroups.activeTabGroup.activeTab.input instanceof vsCodeApi.TabInputTerminal)
        )
          return yield* TerminalInfraServiceErrors.NotATerminalTabError.make();
        if (vsCodeApi.window.activeTerminal === undefined)
          return yield* TerminalInfraServiceErrors.NoActiveTerminalError.make();

        return yield* terminalUtils.findTrackedSessionId(vsCodeApi.window.activeTerminal);
      });

      const findViewedSessionId = Effect.fn("TerminalInfraService.findViewedSessionId")(
        function* () {
          return yield* readViewedSessionId();
        },
        Effect.mapError(() => ITerminalInfraServiceErrors.NoViewedSessionError.make())
      );

      const initialViewedSessionId = yield* Effect.result(findViewedSessionId());
      const viewedSessionId = yield* SubscriptionRef.make(initialViewedSessionId);

      const updateViewedSessionId = Effect.fn("TerminalInfraService.updateViewedSessionId")(function* () {
        const nextViewedSessionId = yield* Effect.result(findViewedSessionId());
        const currentViewedSessionId = yield* SubscriptionRef.get(viewedSessionId);
        if (Result.getOrUndefined(nextViewedSessionId) === Result.getOrUndefined(currentViewedSessionId)) return;

        yield* SubscriptionRef.set(viewedSessionId, nextViewedSessionId);
      });

      // The session in view is read at once, since the jobs that start next read it before the focus changes settle.
      const assignShownSessions = Effect.fn("TerminalInfraService.assignShownSessions")(function* (
        shownSessionIdsByTabProcessId: ReadonlyMap<number, EntityIdValueObject>
      ) {
        yield* SubscriptionRef.updateEffect(sessionTerminals, (currentTerminals) =>
          Effect.map(
            Effect.forEach([...currentTerminals], ([assignedSessionId, sessionTerminal]) =>
              findShownSessionTerminal(shownSessionIdsByTabProcessId, assignedSessionId, sessionTerminal)
            ),
            (shownSessionTerminals): ReadonlyMap<EntityIdValueObject, Terminal> => new Map(shownSessionTerminals)
          )
        );
        yield* updateViewedSessionId();
      });

      // Reading between the events of one tab switch could credit the tab being left.
      const watchFocusChanges = Effect.fn("TerminalInfraService.watchFocusChanges")(function* () {
        const focusChangeSources: readonly Stream.Stream<unknown>[] = [
          yield* vscodeUtils.streamVsCodeEvent(vsCodeApi.window.onDidChangeActiveTerminal),
          yield* vscodeUtils.streamVsCodeEvent(vsCodeApi.window.onDidChangeWindowState),
          yield* vscodeUtils.streamVsCodeEvent(vsCodeApi.window.tabGroups.onDidChangeTabs),
          yield* vscodeUtils.streamVsCodeEvent(vsCodeApi.window.tabGroups.onDidChangeTabGroups),
          SubscriptionRef.changes(sessionTerminals)
        ];

        return Stream.debounce(
          Stream.mergeAll(focusChangeSources, {concurrency: "unbounded"}),
          VIEWED_SESSION_SETTLE_INTERVAL
        );
      });

      const trackViewedSessionId = Effect.fn("TerminalInfraService.trackViewedSessionId")(function* () {
        const focusChanges = yield* watchFocusChanges();
        yield* Effect.forkScoped(Stream.runForEach(focusChanges, () => updateViewedSessionId()));
      });

      const watchClosedSetupTerminals = Effect.fn("TerminalInfraService.watchClosedSetupTerminals")(function* () {
        const closedTerminals = yield* vscodeUtils.streamVsCodeEvent(vsCodeApi.window.onDidCloseTerminal);

        return Stream.as(
          Stream.filter(closedTerminals, (closedTerminal) => closedTerminal.name === SETUP_TERMINAL.NAME),
          undefined
        );
      });

      yield* forgetClosedTerminals();
      yield* trackViewedSessionId();

      return ITerminalInfraService.of({
        activatedSessionIds: yield* watchActivatedSessionIds(),
        assignShownFolderShellPath: folderShellTerminalUtils.assignShownFolderShellPath,
        assignShownSessions,
        closedSetupTerminals: yield* watchClosedSetupTerminals(),
        closeOtherSessionTerminals,
        closeSessionTerminal,
        findFolderShellTerminalProcessId: folderShellTerminalUtils.findFolderShellTerminalProcessId,
        findOpenSessionTerminalProcessId: findOpenSessionTerminalProcessId(),
        focusSessionTerminal,
        folderShellPathsClosedByUser: yield* folderShellTerminalUtils.watchFolderShellPathsClosedByUser,
        nameActiveSessionTab: terminalUtils.nameActiveSessionTab,
        openFolderShellTerminal: folderShellTerminalUtils.openFolderShellTerminal,
        openSessionTerminal,
        openSetupTerminal,
        prepareFolderShellTerminalOptions: folderShellTerminalUtils.prepareFolderShellTerminalOptions,
        viewedSessionId
      });
    })
  }
) {
  public static readonly layer = Layer.effect(ITerminalInfraService, this.make()).pipe(
    Layer.provide([TerminalUtils.layer, FolderShellTerminalUtils.layer, NodeServices.layer])
  );
}
