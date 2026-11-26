import {Context, Effect, Layer, Schema, Stream, String} from "effect";
import {HttpRouter, HttpServer, HttpServerRequest, HttpServerResponse} from "effect/http";

import {AgentController} from "@/controllers/agent.controller.ts";
import {PullRequestController} from "@/controllers/pullRequest.controller.ts";
import {ReviewCommentController} from "@/controllers/reviewComment.controller.ts";
import {SessionController} from "@/controllers/session.controller.ts";
import {SessionImportController} from "@/controllers/sessionImport.controller.ts";
import {SessionProcessController} from "@/controllers/sessionProcess.controller.ts";
import {SettingsController} from "@/controllers/settings.controller.ts";
import {WorktreeController} from "@/controllers/worktree.controller.ts";
import {RegisterCommandMiddleware} from "@/middlewares/registerCommand.middleware.ts";
import {
  AGENT_API,
  AGENT_API_ERRORS,
  AGENT_API_ROUTES,
  AGENT_API_STATUSES
} from "@pkg/constants/src/agentApi.constant.ts";

const CommandPathSchema = Schema.Struct({commandId: Schema.String});

const ProjectPathQuerySchema = Schema.Struct({projectPath: Schema.String});

const ProjectSessionsQuerySchema = Schema.Struct({projectPath: Schema.String, shownPageCount: Schema.FiniteFromString});

const SessionIdQuerySchema = Schema.Struct({sessionId: Schema.String});

export class AgentApiView extends Context.Service<AgentApiView>()(
  "aggregor-app/presentation/views/agentApi/agentApi.view/AgentApiView",
  {
    make: Effect.fn("AgentApiView.make")(function* () {
      const agentController = yield* AgentController;
      const pullRequestController = yield* PullRequestController;
      const reviewCommentController = yield* ReviewCommentController;
      const registerCommandMiddleware = yield* RegisterCommandMiddleware;
      const sessionController = yield* SessionController;
      const sessionImportController = yield* SessionImportController;
      const sessionProcessController = yield* SessionProcessController;
      const settingsController = yield* SettingsController;
      const worktreeController = yield* WorktreeController;
      const httpServer = yield* HttpServer.HttpServer;
      const httpRouter = yield* HttpRouter.make;

      const respondWithError = Effect.fn("AgentApiView.respondWithError")(function* (
        status: number,
        errorName: string,
        errorMessage: string
      ) {
        return HttpServerResponse.jsonUnsafe({error: errorName, message: errorMessage}, {status});
      });

      const respondWithInvalidArguments = Effect.fn("AgentApiView.respondWithInvalidArguments")(
        function* (invalidArguments: {readonly message: string}) {
          return yield* respondWithError(
            AGENT_API_STATUSES.BAD_REQUEST,
            AGENT_API_ERRORS.INVALID_ARGUMENTS,
            invalidArguments.message
          );
        }
      );

      const respondWithReadFailure = Effect.fn("AgentApiView.respondWithReadFailure")(function* (readError: {
        readonly _tag: string;
      }) {
        return yield* respondWithError(
          AGENT_API_STATUSES.UNPROCESSABLE_CONTENT,
          AGENT_API_ERRORS.READ_FAILED,
          readError._tag
        );
      });

      const listCommands = Effect.fn("AgentApiView.listCommands", {root: true})(function* () {
        const registeredCommands = yield* registerCommandMiddleware.listRegisteredCommands;

        return HttpServerResponse.jsonUnsafe(registeredCommands);
      });

      // An empty body is a command without a request.
      const readCommandRequest = Effect.fn("AgentApiView.readCommandRequest")(function* (
        httpRequest: HttpServerRequest.HttpServerRequest
      ) {
        const requestText = yield* httpRequest.text;
        if (String.isEmpty(String.trim(requestText))) return undefined;

        return yield* Schema.decodeEffect(Schema.fromJsonString(Schema.Unknown))(requestText);
      });

      const runCommand = Effect.fn("AgentApiView.runCommand", {root: true})(
        function* (httpRequest: HttpServerRequest.HttpServerRequest) {
          const commandPath = yield* HttpRouter.schemaPathParams(CommandPathSchema);
          const commandRequest = yield* readCommandRequest(httpRequest);
          const commandResult = yield* registerCommandMiddleware.runCommandWithoutNotification(
            commandPath.commandId,
            commandRequest
          );

          return HttpServerResponse.jsonUnsafe({result: commandResult === undefined ? null : commandResult});
        },
        Effect.catchTags({
          CommandFailedError: (commandFailed) =>
            respondWithError(
              AGENT_API_STATUSES.UNPROCESSABLE_CONTENT,
              AGENT_API_ERRORS.COMMAND_FAILED,
              commandFailed.message
            ),
          CommandNotRegisteredError: (commandNotRegistered) =>
            respondWithError(
              AGENT_API_STATUSES.NOT_FOUND,
              AGENT_API_ERRORS.COMMAND_NOT_FOUND,
              AGENT_API_ERRORS.NO_SUCH_COMMAND(commandNotRegistered.commandId)
            ),
          HttpServerError: respondWithInvalidArguments,
          InvalidCommandRequestError: respondWithInvalidArguments,
          SchemaError: respondWithInvalidArguments
        })
      );

      const listProjects = Effect.fn("AgentApiView.listProjects", {root: true})(function* () {
        const projectsWithSessions = yield* sessionController.listProjectsWithSessionsForSessionsView({});

        return HttpServerResponse.jsonUnsafe(projectsWithSessions);
      }, Effect.catch(respondWithReadFailure));

      const listArchive = Effect.fn("AgentApiView.listArchive", {root: true})(function* () {
        const projectsWithArchivedSessions = yield* sessionController.listProjectsWithArchivedSessionsForSessionsView(
          {}
        );

        return HttpServerResponse.jsonUnsafe(projectsWithArchivedSessions);
      }, Effect.catch(respondWithReadFailure));

      const listProjectSessions = Effect.fn("AgentApiView.listProjectSessions", {root: true})(
        function* () {
          const projectSessionsQuery = yield* HttpServerRequest.schemaSearchParams(ProjectSessionsQuerySchema);
          const projectSessions = yield* sessionController.getProjectSessionsForSessionsView(
            projectSessionsQuery.projectPath,
            projectSessionsQuery.shownPageCount
          );

          return HttpServerResponse.jsonUnsafe(projectSessions);
        },
        Effect.catchTag(
          AGENT_API.INVALID_ARGUMENT_ERROR_TAGS,
          (invalidArguments) => respondWithInvalidArguments(invalidArguments),
          (readError) => respondWithReadFailure(readError)
        )
      );

      const listAgents = Effect.fn("AgentApiView.listAgents", {root: true})(function* () {
        const agentListItems = yield* agentController.listAgentsForSessionsView;

        return HttpServerResponse.jsonUnsafe(agentListItems);
      }, Effect.catch(respondWithReadFailure));

      const listSettings = Effect.fn("AgentApiView.listSettings", {root: true})(function* () {
        const aggregorSettings = yield* settingsController.getSettingsForAgentApi;

        return HttpServerResponse.jsonUnsafe(aggregorSettings);
      }, Effect.catch(respondWithReadFailure));

      const listImportableSessions = Effect.fn("AgentApiView.listImportableSessions", {root: true})(
        function* () {
          const projectQuery = yield* HttpServerRequest.schemaSearchParams(ProjectPathQuerySchema);
          const importableSessions = yield* sessionImportController.listImportableSessionsForSessionsView(
            projectQuery.projectPath
          );

          return HttpServerResponse.jsonUnsafe(importableSessions);
        },
        Effect.catchTag(
          AGENT_API.INVALID_ARGUMENT_ERROR_TAGS,
          (invalidArguments) => respondWithInvalidArguments(invalidArguments),
          (readError) => respondWithReadFailure(readError)
        )
      );

      // The branches come twice, before and after fetching origin; the agent gets the fetched ones.
      const listProjectBranches = Effect.fn("AgentApiView.listProjectBranches", {root: true})(
        function* () {
          const projectQuery = yield* HttpServerRequest.schemaSearchParams(ProjectPathQuerySchema);
          const projectBranches = yield* worktreeController.listProjectBranchesForSessionsView(
            projectQuery.projectPath
          );
          const projectBranchLists = yield* Stream.runCollect(projectBranches);

          return HttpServerResponse.jsonUnsafe(projectBranchLists.at(-1));
        },
        Effect.catchTag(
          AGENT_API.INVALID_ARGUMENT_ERROR_TAGS,
          (invalidArguments) => respondWithInvalidArguments(invalidArguments),
          (readError) => respondWithReadFailure(readError)
        )
      );

      const listProjectLeftovers = Effect.fn("AgentApiView.listProjectLeftovers", {root: true})(
        function* () {
          const projectQuery = yield* HttpServerRequest.schemaSearchParams(ProjectPathQuerySchema);
          const projectLeftovers = yield* worktreeController.listProjectLeftoversForSessionsView(
            projectQuery.projectPath
          );

          return HttpServerResponse.jsonUnsafe(projectLeftovers);
        },
        Effect.catchTag(
          AGENT_API.INVALID_ARGUMENT_ERROR_TAGS,
          (invalidArguments) => respondWithInvalidArguments(invalidArguments),
          (readError) => respondWithReadFailure(readError)
        )
      );

      const listSessionPullRequests = Effect.fn("AgentApiView.listSessionPullRequests", {root: true})(
        function* () {
          const sessionQuery = yield* HttpServerRequest.schemaSearchParams(SessionIdQuerySchema);
          const sessionPullRequests = yield* pullRequestController.listSessionPullRequestsForSessionsView(
            sessionQuery.sessionId
          );

          return HttpServerResponse.jsonUnsafe(sessionPullRequests);
        },
        Effect.catchTag(
          AGENT_API.INVALID_ARGUMENT_ERROR_TAGS,
          (invalidArguments) => respondWithInvalidArguments(invalidArguments),
          (readError) => respondWithReadFailure(readError)
        )
      );

      const listSessionProcesses = Effect.fn("AgentApiView.listSessionProcesses", {root: true})(
        function* () {
          const sessionQuery = yield* HttpServerRequest.schemaSearchParams(SessionIdQuerySchema);
          const sessionProcesses = yield* sessionProcessController.getSessionProcessesForAgentApi(
            sessionQuery.sessionId
          );

          return HttpServerResponse.jsonUnsafe(sessionProcesses);
        },
        Effect.catchTag(
          AGENT_API.INVALID_ARGUMENT_ERROR_TAGS,
          (invalidArguments) => respondWithInvalidArguments(invalidArguments),
          (readError) => respondWithReadFailure(readError)
        )
      );

      const listReviewComments = Effect.fn("AgentApiView.listReviewComments", {root: true})(function* () {
        const reviewComments = yield* reviewCommentController.listReviewCommentsForReviewCommentsView;

        return HttpServerResponse.jsonUnsafe(reviewComments);
      }, Effect.catch(respondWithReadFailure));

      yield* httpRouter.addAll([
        HttpRouter.route("GET", AGENT_API_ROUTES.COMMANDS, listCommands()),
        HttpRouter.route("POST", AGENT_API_ROUTES.COMMAND, runCommand),
        HttpRouter.route("GET", AGENT_API_ROUTES.PROJECTS, listProjects()),
        HttpRouter.route("GET", AGENT_API_ROUTES.ARCHIVE, listArchive()),
        HttpRouter.route("GET", AGENT_API_ROUTES.AGENTS, listAgents()),
        HttpRouter.route("GET", AGENT_API_ROUTES.SETTINGS, listSettings()),
        HttpRouter.route("GET", AGENT_API_ROUTES.PROJECT_IMPORTABLE_SESSIONS, listImportableSessions()),
        HttpRouter.route("GET", AGENT_API_ROUTES.PROJECT_BRANCHES, listProjectBranches()),
        HttpRouter.route("GET", AGENT_API_ROUTES.PROJECT_LEFTOVERS, listProjectLeftovers()),
        HttpRouter.route("GET", AGENT_API_ROUTES.PROJECT_SESSIONS, listProjectSessions()),
        HttpRouter.route("GET", AGENT_API_ROUTES.REVIEW_COMMENTS, listReviewComments()),
        HttpRouter.route("GET", AGENT_API_ROUTES.SESSION_PROCESSES, listSessionProcesses()),
        HttpRouter.route("GET", AGENT_API_ROUTES.SESSION_PULL_REQUESTS, listSessionPullRequests())
      ]);
      // @effect-diagnostics-next-line anyUnknownInErrorContext:off -- the router types the errors no route handled as unknown
      yield* httpServer.serve(httpRouter.asHttpEffect());

      return {};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(
    Layer.provide([
      AgentController.layer,
      PullRequestController.layer,
      ReviewCommentController.layer,
      SessionController.layer,
      SessionImportController.layer,
      SessionProcessController.layer,
      SettingsController.layer,
      WorktreeController.layer,
      RegisterCommandMiddleware.layer
    ])
  );
}
