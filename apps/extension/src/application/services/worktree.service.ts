import {ProjectLeftoversDtoSchema} from "@dtos/worktree.dto.ts";
import {IProjectRepository} from "@entities/project/project.repository.interface.ts";
import {ISessionRepository} from "@entities/session/session.repository.interface.ts";
import {ITmuxInfraService} from "@interfaces/tmux.infraService.interface.ts";
import {IWorktreeInfraService} from "@interfaces/worktree.infraService.interface.ts";
import {findEntities, findEntityById, removeEntity, updateEntity} from "@services/base.service.ts";
import {findProjectListItem} from "@services/project.service.ts";
import {SESSION_LIFECYCLES} from "@valueObjects/sessionLifecycle.valueObject.ts";
import {Array, Effect, Result, Schema, SubscriptionRef} from "effect";
import {Path} from "effect/Path";

import type {ProjectListItemDto} from "@dtos/project.dto.ts";
import type {CleanUpProjectLeftoversRequestDto, ListProjectLeftoversRequestDto} from "@dtos/worktree.dto.ts";
import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {GitWorktree, WorktreeBranch} from "@interfaces/worktree.infraService.interface.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";

interface ProjectLeftovers {
  readonly leftoverBranches: readonly WorktreeBranch[];
  readonly leftoverWorktrees: readonly GitWorktree[];
}

export class LeftoversKeptError extends Schema.TaggedError<LeftoversKeptError, {readonly brand: unique symbol}>()(
  "LeftoversKeptError",
  {keptNames: Schema.Array(Schema.String)}
) {}

const findUsedWorktreePaths = Effect.fn("WorktreeService.findUsedWorktreePaths")(function* (
  runningSessionIds: ReadonlySet<EntityIdValueObject>
) {
  const storedSessions = yield* findEntities(ISessionRepository, {});
  const usingSessions = Array.filter(
    storedSessions,
    (storedSession) => storedSession.lifecycle === SESSION_LIFECYCLES.ONGOING || runningSessionIds.has(storedSession.id)
  );

  return new Set<string | undefined>(Array.map(usingSessions, (usingSession) => usingSession.worktreePath));
});

// A worktree is left over once no ongoing session works in it and no archived session's agent still runs there.
const findLeftoverWorktrees = Effect.fn("WorktreeService.findLeftoverWorktrees")(function* (
  projectListItem: ProjectListItemDto,
  runningSessionIds: ReadonlySet<EntityIdValueObject>
) {
  const worktreeInfraService = yield* IWorktreeInfraService;
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

// A branch is left over with no worktree, or with a worktree that is.
const findProjectLeftovers = Effect.fn("WorktreeService.findProjectLeftovers")(function* (
  projectListItem: ProjectListItemDto,
  runningSessionIds: ReadonlySet<EntityIdValueObject>
) {
  const leftoverWorktrees = yield* findLeftoverWorktrees(projectListItem, runningSessionIds);
  const leftoverWorktreePaths = new Set<string>(
    Array.map(leftoverWorktrees, (leftoverWorktree) => leftoverWorktree.worktreePath)
  );
  const aggregorBranches = yield* IWorktreeInfraService.use((worktreeInfraService) =>
    worktreeInfraService.listAggregorBranches(projectListItem.path)
  );
  const projectLeftovers: ProjectLeftovers = {
    leftoverBranches: Array.filter(
      aggregorBranches,
      (aggregorBranch) => aggregorBranch.worktreePath === "" || leftoverWorktreePaths.has(aggregorBranch.worktreePath)
    ),
    leftoverWorktrees
  };

  return projectLeftovers;
});

// Reads local refs only, so drawing a project never waits on the network.
export const hasProjectLeftovers = Effect.fn("WorktreeService.hasProjectLeftovers")(function* (
  projectListItem: ProjectListItemDto
) {
  const runningSessionIds = yield* ITmuxInfraService.use((tmuxInfraService) =>
    SubscriptionRef.get(tmuxInfraService.runningSessionIds)
  );
  const projectLeftoversResult = yield* Effect.result(findProjectLeftovers(projectListItem, runningSessionIds));

  return Result.match(projectLeftoversResult, {
    onFailure: () => false,
    onSuccess: (projectLeftovers) =>
      projectLeftovers.leftoverWorktrees.length + projectLeftovers.leftoverBranches.length > 0
  });
});

const toLeftoverWorktree = Effect.fn("WorktreeService.toLeftoverWorktree")(function* (leftoverWorktree: GitWorktree) {
  const path = yield* Path;

  return {
    branchName: leftoverWorktree.branchName,
    hasChanges: yield* IWorktreeInfraService.use((worktreeInfraService) =>
      worktreeInfraService.hasChanges(leftoverWorktree.worktreePath)
    ),
    worktreeName: path.basename(leftoverWorktree.worktreePath),
    worktreePath: leftoverWorktree.worktreePath
  };
});

const toLeftoverBranch = Effect.fn("WorktreeService.toLeftoverBranch")(function* (
  projectPath: ProjectPathValueObject,
  leftoverBranch: WorktreeBranch,
  baseBranchName: string
) {
  const isInBaseBranch = yield* IWorktreeInfraService.use((worktreeInfraService) =>
    worktreeInfraService.isBranchMerged({baseBranchName, branchName: leftoverBranch.branchName, projectPath})
  );

  return {branchName: leftoverBranch.branchName, isMerged: leftoverBranch.isUpstreamGone || isInBaseBranch};
});

// Pruning first marks the branches whose pull request merged and whose remote branch was deleted.
export const listProjectLeftovers = Effect.fn("WorktreeService.listProjectLeftovers")(function* (
  request: ListProjectLeftoversRequestDto
) {
  const worktreeInfraService = yield* IWorktreeInfraService;
  const projectListItem = yield* findProjectListItem(request.projectPath);
  yield* worktreeInfraService.pruneRemote(projectListItem.path);
  const runningSessionIds = yield* ITmuxInfraService.use(
    (tmuxInfraService) => tmuxInfraService.refreshRunningSessionIds
  );
  const projectLeftovers = yield* findProjectLeftovers(projectListItem, runningSessionIds);
  const baseBranchName = yield* worktreeInfraService.findBaseBranch(projectListItem.path);

  return ProjectLeftoversDtoSchema.make({
    baseBranchName,
    branches: yield* Effect.forEach(projectLeftovers.leftoverBranches, (leftoverBranch) =>
      toLeftoverBranch(projectListItem.path, leftoverBranch, baseBranchName)
    ),
    projectPath: projectListItem.path,
    worktrees: yield* Effect.forEach(projectLeftovers.leftoverWorktrees, (leftoverWorktree) =>
      toLeftoverWorktree(leftoverWorktree)
    )
  });
});

// The archived sessions that worked there have no folder left to reopen in.
const removeLeftoverWorktree = Effect.fn("WorktreeService.removeLeftoverWorktree")(function* (
  projectPath: ProjectPathValueObject,
  leftoverWorktree: GitWorktree
) {
  const path = yield* Path;
  const worktreeName = path.basename(leftoverWorktree.worktreePath);
  const removeResult = yield* Effect.result(
    IWorktreeInfraService.use((worktreeInfraService) =>
      worktreeInfraService.removeWorktree(projectPath, leftoverWorktree.worktreePath)
    )
  );
  if (Result.isFailure(removeResult)) return [worktreeName];
  const worktreeSessions = yield* findEntities(ISessionRepository, {worktreePath: leftoverWorktree.worktreePath});
  yield* Effect.forEach(worktreeSessions, (worktreeSession) => removeEntity(ISessionRepository, worktreeSession.id));
  const keptNames: readonly string[] = [];

  return keptNames;
});

// A branch still checked out in a kept worktree stays.
const deleteLeftoverBranch = Effect.fn("WorktreeService.deleteLeftoverBranch")(
  function* (projectPath: ProjectPathValueObject, leftoverBranch: WorktreeBranch) {
    yield* IWorktreeInfraService.use((worktreeInfraService) =>
      worktreeInfraService.deleteBranch(projectPath, leftoverBranch.branchName)
    );
    const keptNames: readonly string[] = [];

    return keptNames;
  },
  (effect, _projectPath, leftoverBranch) =>
    Effect.catchTag(effect, "BranchDeleteFailedError", () => Effect.succeed([leftoverBranch.branchName]))
);

// Git changes reach no change feed, so touching the project redraws its row and its dot.
const redrawProject = Effect.fn("WorktreeService.redrawProject")(
  function* (projectPath: ProjectPathValueObject) {
    const storedProjects = yield* findEntities(IProjectRepository, {path: projectPath});
    yield* Effect.forEach(storedProjects, (storedProject) => updateEntity(IProjectRepository, storedProject.id, {}));
  },
  Effect.catchTag("EntityNotFoundError", () => Effect.void)
);

// Only what is still left over goes, whatever the request names; worktrees go first, freeing their branches.
export const cleanUpProjectLeftovers = Effect.fn("WorktreeService.cleanUpProjectLeftovers")(
  function* (request: CleanUpProjectLeftoversRequestDto) {
    const projectListItem = yield* findProjectListItem(request.projectPath);
    const runningSessionIds = yield* ITmuxInfraService.use(
      (tmuxInfraService) => tmuxInfraService.refreshRunningSessionIds
    );
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

    return yield* keptNames.length > 0 ? Effect.fail(LeftoversKeptError.make({keptNames})) : Effect.void;
  },
  Effect.catchTag("ProjectNotListedError", () => Effect.void)
);

// Only a worktree Aggregor made, and no other session works in, is deleted; git refuses one with changes.
export const removeSessionWorktree = Effect.fn("WorktreeService.removeSessionWorktree")(
  function* (session: SessionEntity) {
    const worktreePath = session.worktreePath;
    if (worktreePath === undefined) return;
    const worktreeInfraService = yield* IWorktreeInfraService;
    const worktreeSessions = yield* findEntities(ISessionRepository, {worktreePath});
    if (Array.some(worktreeSessions, (worktreeSession) => worktreeSession.id !== session.id)) return;
    const sessionProject = yield* findEntityById(IProjectRepository, session.projectId);
    if (!(yield* worktreeInfraService.isMadeByAggregor(worktreePath, sessionProject.settings.worktreeFolder))) return;

    yield* worktreeInfraService.removeWorktree(sessionProject.path, worktreePath);
  },
  Effect.catchTag("EntityNotFoundError", () => Effect.void)
);
