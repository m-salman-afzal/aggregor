import {NodeServices} from "@effect/platform-node";
import {FolderShellUtils} from "@infraServices/tmux/folderShell.utils.ts";
import {SessionAgentUtils} from "@infraServices/tmux/sessionAgent.utils.ts";
import {TmuxServerUtils} from "@infraServices/tmux/tmuxServer.utils.ts";
import {ITmuxInfraService} from "@interfaces/tmux.infraService.interface.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {VscodeUtils} from "@pkg/vscode/src/vscode.utils.ts";
import {Context, Effect, Layer, Stream} from "effect";

// A server already running keeps the config it started with, so this window's tmux.conf is read into it again.
export class TmuxInfraService extends Context.Service<TmuxInfraService>()(
  "aggregor-app/infrastructure/services/tmux/tmux.infraService/TmuxInfraService",
  {
    make: Effect.fn("TmuxInfraService.make")(function* () {
      const vsCodeApi = yield* VsCodeApi;
      const vscodeUtils = yield* VscodeUtils;
      const folderShellUtils = yield* FolderShellUtils;
      const sessionAgentUtils = yield* SessionAgentUtils;
      const tmuxServerUtils = yield* TmuxServerUtils;

      // An agent can end, or tmux be killed, while the window is away; a tab whose tmux session ended closes with it.
      const watchTmuxChangeHints = Effect.fn("TmuxInfraService.watchTmuxChangeHints")(function* () {
        const windowStateChanges = yield* vscodeUtils.streamVsCodeEvent(vsCodeApi.window.onDidChangeWindowState);
        const closedTerminals = yield* vscodeUtils.streamVsCodeEvent(vsCodeApi.window.onDidCloseTerminal);
        const tmuxChangeHints = Stream.merge(
          Stream.filter(windowStateChanges, (windowState) => windowState.focused),
          closedTerminals
        );

        yield* Stream.runForEach(tmuxChangeHints, () =>
          Effect.withTracerEnabled(sessionAgentUtils.refreshRunningSessionIds, false)
        );
      });

      const runningSessionNames = yield* tmuxServerUtils.listTmuxSessionNames;
      if (runningSessionNames.length > 0)
        yield* Effect.ignore(tmuxServerUtils.runTmuxCommand(["source-file", tmuxServerUtils.tmuxConfigPath]), {
          log: "Warn",
          message: "Could not read this window's tmux.conf into the running tmux server"
        });
      yield* Effect.forkScoped(watchTmuxChangeHints());

      return ITmuxInfraService.of({
        checkTmuxVersion: tmuxServerUtils.checkTmuxVersion,
        endFolderShell: folderShellUtils.endFolderShell,
        pasteTextIntoSessionAgent: sessionAgentUtils.pasteTextIntoSessionAgent,
        prepareFolderShellTerminalCommand: folderShellUtils.prepareFolderShellTerminalCommand,
        prepareSessionTabCommand: sessionAgentUtils.prepareSessionTabCommand,
        readFolderShellPanes: folderShellUtils.readFolderShellPanes,
        readFolderShellPathShownInTerminal: folderShellUtils.readFolderShellPathShownInTerminal,
        readSessionAgentPanes: tmuxServerUtils.readTmuxSessionPanes,
        readShownSessionIdsByTabProcessId: sessionAgentUtils.readShownSessionIdsByTabProcessId,
        refreshRunningSessionIds: sessionAgentUtils.refreshRunningSessionIds,
        runningSessionIds: sessionAgentUtils.runningSessionIds,
        showFolderShellInTerminal: folderShellUtils.showFolderShellInTerminal,
        showSessionInTab: sessionAgentUtils.showSessionInTab,
        startedOrStoppedSessionIds: yield* sessionAgentUtils.watchStartedOrStoppedSessionIds,
        stopSessionAgent: sessionAgentUtils.stopSessionAgent,
        waitForSessionAgentStart: sessionAgentUtils.waitForSessionAgentStart
      });
    })
  }
) {
  public static readonly layer = Layer.effect(ITmuxInfraService, this.make()).pipe(
    Layer.provide([FolderShellUtils.layer, SessionAgentUtils.layer, TmuxServerUtils.layer, NodeServices.layer])
  );
}
