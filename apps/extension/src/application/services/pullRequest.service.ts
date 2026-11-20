import {ListedPullRequestDtoSchema, SessionPullRequestsDtoSchema} from "@dtos/pullRequest.dto.ts";
import {ISessionRepository} from "@entities/session/session.repository.interface.ts";
import {IGitHubCliInfraService} from "@interfaces/gitHubCli.infraService.interface.ts";
import {ISettingsConfig} from "@interfaces/settings.config.interface.ts";
import {ITerminalInfraService} from "@interfaces/terminal.infraService.interface.ts";
import {
  GITHUB_CLI,
  PULL_REQUEST_LIST_PROBLEMS,
  PULL_REQUEST_OPEN_PLACES
} from "@pkg/constants/src/gitHubCli.constant.ts";
import {BaseService} from "@services/base.service.ts";
import {SessionService} from "@services/session.service.ts";
import {AGENT_STATUSES} from "@valueObjects/agentStatus.valueObject.ts";
import {ENTITY_CHANGE_KINDS} from "@valueObjects/entityChangeKind.valueObject.ts";
import {Array, Context, DateTime, Effect, Layer, Match, Ref, Result, Stream} from "effect";

import type {
  LinkSessionPullRequestRequestDto,
  ListSessionPullRequestsRequestDto,
  OpenSessionPullRequestRequestDto,
  UnlinkSessionPullRequestRequestDto
} from "@dtos/pullRequest.dto.ts";
import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";

export class PullRequestService extends Context.Service<PullRequestService>()(
  "aggregor-app/application/services/pullRequest.service/PullRequestService",
  {
    make: Effect.fn("PullRequestService.make")(function* () {
      const sessionRepository = yield* ISessionRepository;
      const gitHubCliInfraService = yield* IGitHubCliInfraService;
      const settingsConfig = yield* ISettingsConfig;
      const terminalInfraService = yield* ITerminalInfraService;
      const sessionService = yield* SessionService;
      const baseService = yield* BaseService;
      const sessionBaseService = yield* baseService.makeFor(sessionRepository);

      const openSessionPullRequest = Effect.fn("PullRequestService.openSessionPullRequest")(function* (
        request: OpenSessionPullRequestRequestDto
      ) {
        const session = yield* sessionService.findSession(request.sessionId);
        const pullRequestLookup = yield* sessionService.findSessionPullRequestLookup(session);
        const pullRequest = yield* gitHubCliInfraService.findPullRequest(pullRequestLookup);
        const pullRequestSettings = yield* settingsConfig.readPullRequestSettings;
        yield* Effect.annotateCurrentSpan({openPullRequestIn: pullRequestSettings.openPullRequestIn});

        yield* pullRequestSettings.openPullRequestIn === PULL_REQUEST_OPEN_PLACES.VS_CODE
          ? gitHubCliInfraService.openPullRequestInVsCode(pullRequest)
          : gitHubCliInfraService.openPullRequestInBrowser(pullRequest);
      });

      const linkSessionPullRequest = Effect.fn("PullRequestService.linkSessionPullRequest")(
        function* (request: LinkSessionPullRequestRequestDto) {
          yield* sessionBaseService.updateEntity(request.sessionId, {pullRequestNumber: request.pullRequestNumber});
        },
        Effect.catchTag("EntityNotFoundError", () => Effect.void)
      );

      const unlinkSessionPullRequest = Effect.fn("PullRequestService.unlinkSessionPullRequest")(
        function* (request: UnlinkSessionPullRequestRequestDto) {
          yield* sessionBaseService.updateEntity(request.sessionId, {pullRequestNumber: undefined});
        },
        Effect.catchTag("EntityNotFoundError", () => Effect.void)
      );

      const listSessionPullRequests = Effect.fn("PullRequestService.listSessionPullRequests")(function* (
        request: ListSessionPullRequestsRequestDto
      ) {
        const session = yield* sessionService.findSession(request.sessionId);
        const listedPullRequestsResult = yield* Effect.result(
          gitHubCliInfraService.listPullRequests(session.workingFolderPath)
        );

        return Result.match(listedPullRequestsResult, {
          onFailure: (listError) =>
            SessionPullRequestsDtoSchema.make({
              listProblem: Match.valueTags(listError, {
                GitHubCliSignedOutError: () => PULL_REQUEST_LIST_PROBLEMS.SIGNED_OUT,
                PullRequestListFailedError: () => PULL_REQUEST_LIST_PROBLEMS.FAILED
              }),
              pullRequests: [],
              sessionId: session.id
            }),
          onSuccess: (listedPullRequests) =>
            SessionPullRequestsDtoSchema.make({
              pullRequests: Array.map(listedPullRequests, (listedPullRequest) =>
                ListedPullRequestDtoSchema.make({...listedPullRequest})
              ),
              sessionId: session.id
            })
        });
      });

      const signInToGitHubCli = Effect.fn("PullRequestService.signInToGitHubCli")(function* () {
        yield* terminalInfraService.openSetupTerminal(GITHUB_CLI.SIGN_IN_COMMAND_LINE);
      });

      const watchGitHubCliSignedOut = Effect.fn("PullRequestService.watchGitHubCliSignedOut")(function* () {
        return Stream.as(gitHubCliInfraService.gitHubCliSignedOutProblems, undefined);
      });

      const refreshSessionPullRequest = Effect.fn("PullRequestService.refreshSessionPullRequest")(
        function* (session: SessionEntity) {
          const pullRequestLookup = yield* sessionService.findSessionPullRequestLookup(session);

          yield* gitHubCliInfraService.refreshPullRequest(pullRequestLookup);
        },
        Effect.catchTags({NotGitRepositoryError: () => Effect.void, SessionNotInWorktreeError: () => Effect.void})
      );

      // A row is written for many reasons, so a turn's end is a new status change to finished or idle.
      const isNewTurnEnd = Effect.fn("PullRequestService.isNewTurnEnd")(function* (
        lastStatusChangeTimes: ReadonlyMap<EntityIdValueObject, number>,
        updatedSession: SessionEntity
      ) {
        const statusChangedAt =
          updatedSession.statusChangedAt === undefined ? 0 : DateTime.toEpochMillis(updatedSession.statusChangedAt);

        return (
          lastStatusChangeTimes.get(updatedSession.id) !== statusChangedAt &&
          (updatedSession.status === AGENT_STATUSES.DONE || updatedSession.status === AGENT_STATUSES.IDLE)
        );
      });

      const refreshAfterTurnEnd = Effect.fn("PullRequestService.refreshAfterTurnEnd")(function* (
        lastStatusChangeTimes: Ref.Ref<ReadonlyMap<EntityIdValueObject, number>>,
        updatedSession: SessionEntity
      ) {
        const statusChangeTimes = yield* Ref.get(lastStatusChangeTimes);
        const isTurnEnd = yield* isNewTurnEnd(statusChangeTimes, updatedSession);
        const statusChangedAt =
          updatedSession.statusChangedAt === undefined ? 0 : DateTime.toEpochMillis(updatedSession.statusChangedAt);
        yield* Ref.set(lastStatusChangeTimes, new Map(statusChangeTimes).set(updatedSession.id, statusChangedAt));
        if (isTurnEnd) yield* Effect.withTracerEnabled(refreshSessionPullRequest(updatedSession), true);
      });

      const startPullRequestRefreshOnTurnEnd = Effect.fn("PullRequestService.startPullRequestRefreshOnTurnEnd")(
        function* () {
          const lastStatusChangeTimes = yield* Ref.make<ReadonlyMap<EntityIdValueObject, number>>(new Map());
          const updatedSessions = Stream.filterMap(sessionRepository.entityChanges, (sessionChange) =>
            sessionChange.kind === ENTITY_CHANGE_KINDS.UPDATED ? Result.succeed(sessionChange.entity) : Result.failVoid
          );

          yield* Effect.forkScoped(
            Stream.runForEach(updatedSessions, (updatedSession) =>
              Effect.withTracerEnabled(refreshAfterTurnEnd(lastStatusChangeTimes, updatedSession), false)
            )
          );
        }
      );

      return {
        linkSessionPullRequest,
        listSessionPullRequests,
        openSessionPullRequest,
        signInToGitHubCli: signInToGitHubCli(),
        startPullRequestRefreshOnTurnEnd: startPullRequestRefreshOnTurnEnd(),
        unlinkSessionPullRequest,
        watchGitHubCliSignedOut: watchGitHubCliSignedOut()
      };
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(
    Layer.provide([BaseService.layer, SessionService.layer])
  );
}
