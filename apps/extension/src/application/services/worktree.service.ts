import {ProjectBranchesDtoSchema, ProjectLeftoversDtoSchema} from "@dtos/worktree.dto.ts";
import {IProjectRepository} from "@entities/project/project.repository.interface.ts";
import {ISessionRepository} from "@entities/session/session.repository.interface.ts";
import {ITmuxInfraService} from "@interfaces/tmux.infraService.interface.ts";
import {IWorkspaceInfraService} from "@interfaces/workspace.infraService.interface.ts";
import {IWorktreeInfraService} from "@interfaces/worktree.infraService.interface.ts";
import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {BaseService} from "@services/base.service.ts";
import {ProjectService} from "@services/project.service.ts";
import {SESSION_LIFECYCLES} from "@valueObjects/sessionLifecycle.valueObject.ts";
import {Array, Context, Effect, Layer, Result, Schema, Stream, SubscriptionRef} from "effect";
import {Path} from "effect/Path";

import type {ProjectListItemDto} from "@dtos/project.dto.ts";
import type {
  CleanUpProjectLeftoversRequestDto,
  ListProjectBranchesRequestDto,
  ListProjectLeftoversRequestDto
} from "@dtos/worktree.dto.ts";
import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {GitWorktree, WorktreeBranch} from "@interfaces/worktree.infraService.interface.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";

interface ProjectLeftovers {
  readonly leftoverBranches: readonly WorktreeBranch[];
  readonly leftoverWorktrees: readonly GitWorktree[];
}

export class WorktreeServiceErrors extends TaggedErrors({
  LeftoversKeptError: {keptNames: Schema.Array(Schema.String)}
}) {}

export class WorktreeService extends Context.Service<WorktreeService>()(
  "aggregor-app/application/services/worktree.service/WorktreeService",
  {
    make: Effect.fn("make")(function* () {
      const projectRepository = yield* IProjectRepository;
      const sessionRepository = yield* ISessionRepository;
      const tmuxInfraService = yield* ITmuxInfraService;
      const workspaceInfraService = yield* IWorkspaceInfraService;
      const worktreeInfraService = yield* IWorktreeInfraService;
      const path = yield* Path;
      const projectService = yield* ProjectService;
      const baseService = yield* BaseService;
      const projectBaseService = yield* baseService.makeFor(projectRepository);
      const sessionBaseService = yield* baseService.makeFor(sessionRepository);

      const findUsedWorktreePaths = Effect.fn("findUsedWorktreePaths")(function* (
        runningSessionIds: ReadonlySet<EntityIdValueObject>
      ) {
        const storedSessions = yield* sessionBaseService.findEntities({});
        const usingSessions = Array.filter(
          storedSessions,
          (storedSession) =>
            storedSession.lifecycle === SESSION_LIFECYCLES.ONGOING || runningSessionIds.has(storedSession.id)
        );

        return new Set<string | undefined>(Array.map(usingSessions, (usingSession) => usingSession.worktreePath));
      });

      const findLeftoverWorktrees = Effect.fn("findLeftoverWorktrees")(function* (
        projectListItem: ProjectListItemDto,
        runningSessionIds: ReadonlySet<EntityIdValueObject>
      ) {
        const usedWorktreePaths = yield* findUsedWorktreePaths(runningSessionIds);
        const projectWorktrees = yield* worktreeInfraService.listWorktrees(projectListItem.path);
        const unusedWorktrees = Array.filter(
          projectWorktrees,
          (projectWorktree) => !usedWorktreePaths.has(projectWorktree.worktreePath)
        );

        return yield* Effect.filter(unusedWorktrees, (unusedWorktree) =>
          worktreeInfraService.isMadeByAggregor(unusedWorktree.worktreePath, projectListItem.settings.worktreeFolder)
        );
      });

      const findProjectLeftovers = Effect.fn("findProjectLeftovers")(function* (
        projectListItem: ProjectListItemDto,
        runningSessionIds: ReadonlySet<EntityIdValueObject>
      ) {
        const leftoverWorktrees = yield* findLeftoverWorktrees(projectListItem, runningSessionIds);
        const leftoverWorktreePaths = new Set<string>(
          Array.map(leftoverWorktrees, (leftoverWorktree) => leftoverWorktree.worktreePath)
        );
        const aggregorBranches = yield* worktreeInfraService.listAggregorBranches(projectListItem.path);
        const projectLeftovers: ProjectLeftovers = {
          leftoverBranches: Array.filter(
            aggregorBranches,
            (aggregorBranch) =>
              aggregorBranch.worktreePath === "" || leftoverWorktreePaths.has(aggregorBranch.worktreePath)
          ),
          leftoverWorktrees
        };

        return projectLeftovers;
      });

      // Reads local refs only, so drawing a project never waits on the network.
      const hasProjectLeftovers = Effect.fn("hasProjectLeftovers")(function* (projectListItem: ProjectListItemDto) {
        const runningSessionIds = yield* SubscriptionRef.get(tmuxInfraService.runningSessionIds);
        const projectLeftoversResult = yield* Effect.result(findProjectLeftovers(projectListItem, runningSessionIds));

        return Result.match(projectLeftoversResult, {
          onFailure: () => false,
          onSuccess: (projectLeftovers) =>
            projectLeftovers.leftoverWorktrees.length + projectLeftovers.leftoverBranches.length > 0
        });
      });

      const makeLeftoverWorktree = Effect.fn("makeLeftoverWorktree")(function* (leftoverWorktree: GitWorktree) {
        return {
          branchName: leftoverWorktree.branchName,
          hasChanges: yield* worktreeInfraService.hasChanges(leftoverWorktree.worktreePath),
          worktreeName: path.basename(leftoverWorktree.worktreePath),
          worktreePath: leftoverWorktree.worktreePath
        };
      });

      const makeLeftoverBranch = Effect.fn("makeLeftoverBranch")(function* (
        projectPath: ProjectPathValueObject,
        leftoverBranch: WorktreeBranch,
        baseBranchName: string
      ) {
        const isInBaseBranch = yield* worktreeInfraService.isBranchMerged({
          baseBranchName,
          branchName: leftoverBranch.branchName,
          projectPath
        });

        return {branchName: leftoverBranch.branchName, isMerged: leftoverBranch.isUpstreamGone || isInBaseBranch};
      });

      // Pruning first marks the branches whose pull request merged and whose remote branch was deleted.
      const listProjectLeftovers = Effect.fn("listProjectLeftovers")(function* (
        request: ListProjectLeftoversRequestDto
      ) {
        const projectListItem = yield* projectService.findProjectListItem(request.projectPath);
        yield* worktreeInfraService.pruneRemote(projectListItem.path);
        const runningSessionIds = yield* tmuxInfraService.refreshRunningSessionIds;
        const projectLeftovers = yield* findProjectLeftovers(projectListItem, runningSessionIds);
        const baseBranchName = yield* worktreeInfraService.findBaseBranch(projectListItem.path);

        return ProjectLeftoversDtoSchema.make({
          baseBranchName,
          branches: yield* Effect.forEach(projectLeftovers.leftoverBranches, (leftoverBranch) =>
            makeLeftoverBranch(projectListItem.path, leftoverBranch, baseBranchName)
          ),
          projectPath: projectListItem.path,
          worktrees: yield* Effect.forEach(projectLeftovers.leftoverWorktrees, (leftoverWorktree) =>
            makeLeftoverWorktree(leftoverWorktree)
          )
        });
      });

      // A deleted worktree still shown would be listed as a project of its own, and saved as one on the next switch.
      const showProjectInPlaceOfWorktree = Effect.fn("showProjectInPlaceOfWorktree")(function* (
        projectPath: ProjectPathValueObject,
        worktreePath: ProjectPathValueObject
      ) {
        const workspaceFolderProjects = yield* workspaceInfraService.listWorkspaceFolderProjects;
        const isWorktreeShown = Array.some(
          workspaceFolderProjects,
          (workspaceFolderProject) => workspaceFolderProject.path === worktreePath
        );
        yield* Effect.annotateCurrentSpan({isWorktreeShown});
        if (isWorktreeShown) yield* workspaceInfraService.showOnlyProjectFolder(projectPath, undefined);
      });

      const removeLeftoverWorktree = Effect.fn("removeLeftoverWorktree")(function* (
        projectPath: ProjectPathValueObject,
        leftoverWorktree: GitWorktree
      ) {
        const worktreeName = path.basename(leftoverWorktree.worktreePath);
        const removeResult = yield* Effect.result(
          worktreeInfraService.removeWorktree(projectPath, leftoverWorktree.worktreePath)
        );
        if (Result.isFailure(removeResult)) return [worktreeName];
        yield* tmuxInfraService.endFolderShell(leftoverWorktree.worktreePath);
        yield* showProjectInPlaceOfWorktree(projectPath, leftoverWorktree.worktreePath);
        const worktreeSessions = yield* sessionBaseService.findEntities({worktreePath: leftoverWorktree.worktreePath});
        yield* Effect.forEach(worktreeSessions, (worktreeSession) =>
          sessionBaseService.removeEntity(worktreeSession.id)
        );
        const keptNames: readonly string[] = [];

        return keptNames;
      });

      const deleteLeftoverBranch = Effect.fn("deleteLeftoverBranch")(
        function* (projectPath: ProjectPathValueObject, leftoverBranch: WorktreeBranch) {
          yield* worktreeInfraService.deleteBranch(projectPath, leftoverBranch.branchName);
          const keptNames: readonly string[] = [];

          return keptNames;
        },
        (effect, _projectPath, leftoverBranch) =>
          Effect.catchTag(effect, "BranchDeleteFailedError", () => Effect.succeed([leftoverBranch.branchName]))
      );

      // Git changes reach no change feed, so touching the project redraws its row and its dot.
      const redrawProject = Effect.fn("redrawProject")(
        function* (projectPath: ProjectPathValueObject) {
          const storedProjects = yield* projectBaseService.findEntities({path: projectPath});
          yield* Effect.forEach(storedProjects, (storedProject) =>
            projectBaseService.updateEntity(storedProject.id, {})
          );
        },
        Effect.catchTag("EntityNotFoundError", () => Effect.void)
      );

      // Worktrees go first, freeing their branches.
      const cleanUpProjectLeftovers = Effect.fn("cleanUpProjectLeftovers")(
        function* (request: CleanUpProjectLeftoversRequestDto) {
          const projectListItem = yield* projectService.findProjectListItem(request.projectPath);
          const runningSessionIds = yield* tmuxInfraService.refreshRunningSessionIds;
          const projectLeftovers = yield* findProjectLeftovers(projectListItem, runningSessionIds);
          const chosenWorktrees = Array.filter(projectLeftovers.leftoverWorktrees, (leftoverWorktree) =>
            request.worktreePaths.includes(leftoverWorktree.worktreePath)
          );
          const chosenBranches = Array.filter(projectLeftovers.leftoverBranches, (leftoverBranch) =>
            request.branchNames.includes(leftoverBranch.branchName)
          );
          const keptWorktreeNames = yield* Effect.forEach(chosenWorktrees, (chosenWorktree) =>
            removeLeftoverWorktree(projectListItem.path, chosenWorktree)
          );
          const keptBranchNames = yield* Effect.forEach(chosenBranches, (chosenBranch) =>
            deleteLeftoverBranch(projectListItem.path, chosenBranch)
          );
          yield* redrawProject(projectListItem.path);
          const keptNames = [...Array.flatten(keptWorktreeNames), ...Array.flatten(keptBranchNames)];

          return yield* keptNames.length > 0
            ? Effect.fail(WorktreeServiceErrors.LeftoversKeptError.make({keptNames}))
            : Effect.void;
        },
        Effect.catchTag("ProjectNotListedError", () => Effect.void)
      );

      const removeSessionWorktree = Effect.fn("removeSessionWorktree")(
        function* (session: SessionEntity) {
          const worktreePath = session.worktreePath;
          if (worktreePath === undefined) return;
          const worktreeSessions = yield* sessionBaseService.findEntities({worktreePath});
          if (Array.some(worktreeSessions, (worktreeSession) => worktreeSession.id !== session.id)) return;
          const sessionProject = yield* projectBaseService.findEntityById(session.projectId);
          if (!(yield* worktreeInfraService.isMadeByAggregor(worktreePath, sessionProject.settings.worktreeFolder)))
            return;

          yield* worktreeInfraService.removeWorktree(sessionProject.path, worktreePath);
          yield* tmuxInfraService.endFolderShell(worktreePath);
          yield* showProjectInPlaceOfWorktree(sessionProject.path, worktreePath);
        },
        Effect.catchTag("EntityNotFoundError", () => Effect.void)
      );

      const readProjectBranches = Effect.fn("readProjectBranches")(function* (
        projectPath: ProjectPathValueObject,
        isFetchingRemote: boolean
      ) {
        const currentBranchNameResult = yield* Effect.result(worktreeInfraService.readBranchName(projectPath));
        const projectBranchNames = yield* worktreeInfraService.listBranchNames(projectPath);

        return ProjectBranchesDtoSchema.make({
          currentBranchName: Result.getOrUndefined(currentBranchNameResult),
          isFetchingRemote,
          localBranchNames: projectBranchNames.localBranchNames,
          projectPath,
          remoteBranchNames: projectBranchNames.remoteBranchNames
        });
      });

      const fetchProjectBranches = Effect.fn("fetchProjectBranches")(function* (projectPath: ProjectPathValueObject) {
        yield* worktreeInfraService.fetchRemote(projectPath);

        return yield* readProjectBranches(projectPath, false);
      });

      const listProjectBranches = Effect.fn("listProjectBranches")(function* (request: ListProjectBranchesRequestDto) {
        const projectListItem = yield* projectService.findProjectListItem(request.projectPath);

        return Stream.concat(
          Stream.fromEffect(readProjectBranches(projectListItem.path, true)),
          Stream.fromEffect(fetchProjectBranches(projectListItem.path))
        );
      });

      return {
        cleanUpProjectLeftovers,
        hasProjectLeftovers,
        listProjectBranches,
        listProjectLeftovers,
        removeSessionWorktree
      };
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("WorktreeService", this.make())).pipe(
    Layer.provide([BaseService.layer, ProjectService.layer])
  );
}
