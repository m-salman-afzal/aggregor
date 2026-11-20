import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {FolderShellService} from "@services/folderShell.service.ts";
import {PullRequestService} from "@services/pullRequest.service.ts";
import {SessionService} from "@services/session.service.ts";
import {WorkspaceService} from "@services/workspace.service.ts";
import {Context, Effect, Layer} from "effect";

export class BackgroundJobs extends Context.Service<BackgroundJobs>()(
  "aggregor-app/infrastructure/di/backgroundJobs.layer/BackgroundJobs",
  {
    make: Effect.fn("make")(function* () {
      const sessionService = yield* SessionService;
      const folderShellService = yield* FolderShellService;
      const pullRequestService = yield* PullRequestService;
      const workspaceService = yield* WorkspaceService;

      // Before the other jobs, which read the session in view as they start.
      yield* sessionService.syncSessionTabsWithTmux;
      yield* Effect.all(
        [
          sessionService.startSessionTitleSync,
          sessionService.startSessionTabNameSync,
          sessionService.startViewedAtSync,
          sessionService.startRunStateSync,
          pullRequestService.startPullRequestRefreshOnTurnEnd,
          workspaceService.startShownProjectSync,
          folderShellService.syncFolderShellTerminalWithTmux,
          folderShellService.startFolderShellFollow,
          folderShellService.startFolderShellEndOnTerminalClose,
          workspaceService.startSessionReopenAfterReload
        ],
        {concurrency: "unbounded", discard: true}
      );

      return {};
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("BackgroundJobs", this.make())).pipe(
    Layer.provide([SessionService.layer, FolderShellService.layer, PullRequestService.layer, WorkspaceService.layer])
  );
}
