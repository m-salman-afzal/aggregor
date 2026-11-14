import {getAggregorFolderPath} from "@infraUtils/aggregorFolder.utils.ts";
import {
  BranchDeleteFailedError,
  BranchRenameFailedError,
  IWorktreeInfraService,
  NotGitRepositoryError,
  WorktreeCreateFailedError,
  WorktreeHasChangesError,
  WorktreeRemoveFailedError
} from "@interfaces/worktree.infraService.interface.ts";
import {GIT_COMMAND, WORKTREES} from "@pkg/constants/src/git.constant.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {Array, Effect, Layer, Result, Schema, Stream, String} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";
import {ChildProcess} from "effect/process";
import {ChildProcessSpawner} from "effect/process/ChildProcessSpawner";
import {homedir} from "node:os";

import type {
  BranchMergeCheck,
  CopyIncludedFilesRequest,
  CreateWorktreeRequest,
  GitWorktree,
  WorktreeBranch
} from "@interfaces/worktree.infraService.interface.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";

interface WorktreeDependencies {
  readonly aggregorFolderPath: string;
  readonly childProcessSpawner: ChildProcessSpawner["Service"];
  readonly fileSystem: FileSystem;
  readonly path: Path;
}

class GitCommandFailedError extends Schema.TaggedError<GitCommandFailedError, {readonly brand: unique symbol}>()(
  "GitCommandFailedError",
  {gitError: Schema.String}
) {}

const runGitCommand = Effect.fn("WorktreeInfraService.runGitCommand")(
  function* (worktreeDependencies: WorktreeDependencies, repositoryPath: string, gitArguments: readonly string[]) {
    const gitProcess = yield* worktreeDependencies.childProcessSpawner.spawn(
      ChildProcess.make(GIT_COMMAND.COMMAND, ["-C", repositoryPath, ...gitArguments])
    );
    const [standardOutput, errorOutput, exitCode] = yield* Effect.all(
      [
        Stream.mkString(Stream.decodeText(gitProcess.stdout)),
        Stream.mkString(Stream.decodeText(gitProcess.stderr)),
        gitProcess.exitCode
      ],
      {concurrency: "unbounded"}
    );
    if (Number(exitCode) !== 0) return yield* GitCommandFailedError.make({gitError: String.trim(errorOutput)});

    return standardOutput;
  },
  Effect.scoped,
  Effect.catchTag("PlatformError", (platformError) =>
    Effect.fail(GitCommandFailedError.make({gitError: platformError.message}))
  )
);

const findLineValue = Effect.fn("WorktreeInfraService.findLineValue")(function* (
  blockLines: readonly string[],
  linePrefix: string
) {
  return Result.map(
    Result.fromOption(Array.findFirst(blockLines, String.startsWith(linePrefix)), () => undefined),
    (blockLine) => String.slice(linePrefix.length)(blockLine)
  );
});

// `git worktree list --porcelain` gives a block per worktree, apart by a blank line; a detached one has no branch.
const readWorktreeBlock = Effect.fn("WorktreeInfraService.readWorktreeBlock")(function* (porcelainBlock: string) {
  const blockLines = String.split("\n")(porcelainBlock);
  const worktreeLine = yield* findLineValue(blockLines, GIT_COMMAND.PORCELAIN_WORKTREE_PREFIX);
  const branchLine = yield* findLineValue(blockLines, GIT_COMMAND.PORCELAIN_BRANCH_PREFIX);
  const worktreePath = yield* Effect.fromResult(worktreeLine);
  const worktree: GitWorktree = {
    branchName: Result.getOrElse(branchLine, () => ""),
    worktreePath: ProjectPathValueObjectSchema.make(worktreePath)
  };

  return worktree;
});

const listWorktrees = Effect.fn("WorktreeInfraService.listWorktrees")(
  function* (worktreeDependencies: WorktreeDependencies, projectPath: ProjectPathValueObject) {
    const porcelainOutput = yield* runGitCommand(worktreeDependencies, projectPath, [
      "worktree",
      "list",
      "--porcelain"
    ]);
    const porcelainBlocks = Array.filter(String.split("\n\n")(String.trim(porcelainOutput)), String.isNonEmpty);
    const worktrees = yield* Effect.forEach(porcelainBlocks, (porcelainBlock) => readWorktreeBlock(porcelainBlock));

    return Array.drop(worktrees, 1);
  },
  Effect.mapError(() => NotGitRepositoryError.make())
);

const expandHomeFolder = Effect.fn("WorktreeInfraService.expandHomeFolder")(function* (
  worktreeDependencies: WorktreeDependencies,
  folderPath: string
) {
  if (folderPath === "~" || String.startsWith("~/")(folderPath))
    return worktreeDependencies.path.join(homedir(), String.slice(1)(folderPath));

  return folderPath;
});

const findWorktreesFolderPath = Effect.fn("WorktreeInfraService.findWorktreesFolderPath")(function* (
  worktreeDependencies: WorktreeDependencies,
  createWorktreeRequest: CreateWorktreeRequest
) {
  if (createWorktreeRequest.worktreesFolderPath !== "")
    return yield* expandHomeFolder(worktreeDependencies, createWorktreeRequest.worktreesFolderPath);

  return worktreeDependencies.path.join(
    worktreeDependencies.aggregorFolderPath,
    WORKTREES.FOLDER_NAME,
    createWorktreeRequest.worktreesFolderName
  );
});

const isBranchTaken = Effect.fn("WorktreeInfraService.isBranchTaken")(function* (
  worktreeDependencies: WorktreeDependencies,
  repositoryPath: string,
  branchName: string
) {
  const branchCheck = yield* Effect.result(
    runGitCommand(worktreeDependencies, repositoryPath, [
      "rev-parse",
      "--verify",
      "--quiet",
      `${GIT_COMMAND.BRANCH_REF_PREFIX}${branchName}`
    ])
  );

  return Result.isSuccess(branchCheck);
});

const isNameTaken = Effect.fn("WorktreeInfraService.isNameTaken")(function* (
  worktreeDependencies: WorktreeDependencies,
  projectPath: ProjectPathValueObject,
  worktree: GitWorktree
) {
  const isFolderTaken = yield* Effect.orElseSucceed(
    worktreeDependencies.fileSystem.exists(worktree.worktreePath),
    () => true
  );
  const isTakenAsBranch = yield* isBranchTaken(worktreeDependencies, projectPath, worktree.branchName);

  return isFolderTaken || isTakenAsBranch;
});

const findFreeBranchName = Effect.fn("WorktreeInfraService.findFreeBranchName")(function* (
  worktreeDependencies: WorktreeDependencies,
  worktreePath: ProjectPathValueObject,
  branchName: string
) {
  const candidates = Array.map(Array.range(1, WORKTREES.MAX_NAME_SUFFIX), (suffix) =>
    suffix === 1 ? branchName : `${branchName}-${suffix}`
  );
  const freeBranchName = yield* Effect.findFirst(candidates, (candidate) =>
    Effect.map(isBranchTaken(worktreeDependencies, worktreePath, candidate), (isTaken) => !isTaken)
  );

  return yield* Effect.fromResult(
    Result.fromOption(freeBranchName, () =>
      BranchRenameFailedError.make({gitError: `${branchName} and its numbered names are taken`})
    )
  );
});

const hasUpstream = Effect.fn("WorktreeInfraService.hasUpstream")(function* (
  worktreeDependencies: WorktreeDependencies,
  worktreePath: ProjectPathValueObject
) {
  const upstreamCheck = yield* Effect.result(
    runGitCommand(worktreeDependencies, worktreePath, [
      "rev-parse",
      "--abbrev-ref",
      "--symbolic-full-name",
      "@{upstream}"
    ])
  );

  return Result.isSuccess(upstreamCheck);
});

// Two small reads and no git process, since a session's row reads its branch on every redraw.
const readBranchName = Effect.fn("WorktreeInfraService.readBranchName")(
  function* (worktreeDependencies: WorktreeDependencies, worktreePath: ProjectPathValueObject) {
    const gitFile = yield* worktreeDependencies.fileSystem.readFileString(
      worktreeDependencies.path.join(worktreePath, ".git")
    );
    const gitDirectoryPath = String.trim(String.replace(GIT_COMMAND.GITDIR_PREFIX, "")(String.trim(gitFile)));
    const headFile = yield* worktreeDependencies.fileSystem.readFileString(
      worktreeDependencies.path.resolve(worktreePath, gitDirectoryPath, GIT_COMMAND.HEAD_FILE_NAME)
    );
    const head = String.trim(headFile);

    return String.startsWith(GIT_COMMAND.HEAD_REF_PREFIX)(head)
      ? String.slice(GIT_COMMAND.HEAD_REF_PREFIX.length)(head)
      : String.slice(0, GIT_COMMAND.SHORT_HASH_LENGTH)(head);
  },
  Effect.mapError(() => NotGitRepositoryError.make())
);

const renameBranch = Effect.fn("WorktreeInfraService.renameBranch")(
  function* (worktreeDependencies: WorktreeDependencies, worktreePath: ProjectPathValueObject, branchName: string) {
    yield* runGitCommand(worktreeDependencies, worktreePath, ["branch", "-m", branchName]);
  },
  Effect.catchTag("GitCommandFailedError", (gitCommandFailed) =>
    Effect.fail(BranchRenameFailedError.make({gitError: gitCommandFailed.gitError}))
  )
);

const findFreeWorktree = Effect.fn("WorktreeInfraService.findFreeWorktree")(function* (
  worktreeDependencies: WorktreeDependencies,
  createWorktreeRequest: CreateWorktreeRequest,
  worktreesFolderPath: string
) {
  const suffixes = Array.range(1, WORKTREES.MAX_NAME_SUFFIX);
  const candidates = Array.map(suffixes, (suffix): GitWorktree => {
    const nameSuffix = suffix === 1 ? "" : `-${suffix}`;

    return {
      branchName: `${createWorktreeRequest.branchName}${nameSuffix}`,
      worktreePath: ProjectPathValueObjectSchema.make(
        worktreeDependencies.path.join(worktreesFolderPath, `${createWorktreeRequest.worktreeName}${nameSuffix}`)
      )
    };
  });

  const freeCandidate = yield* Effect.findFirst(candidates, (candidate) =>
    Effect.map(isNameTaken(worktreeDependencies, createWorktreeRequest.projectPath, candidate), (isTaken) => !isTaken)
  );

  return yield* Effect.fromResult(
    Result.fromOption(freeCandidate, () =>
      GitCommandFailedError.make({gitError: `${createWorktreeRequest.branchName} and its numbered names are taken`})
    )
  );
});

const createWorktree = Effect.fn("WorktreeInfraService.createWorktree")(
  function* (worktreeDependencies: WorktreeDependencies, createWorktreeRequest: CreateWorktreeRequest) {
    const worktreesFolderPath = yield* findWorktreesFolderPath(worktreeDependencies, createWorktreeRequest);
    const freeWorktree = yield* findFreeWorktree(worktreeDependencies, createWorktreeRequest, worktreesFolderPath);
    yield* runGitCommand(worktreeDependencies, createWorktreeRequest.projectPath, [
      "worktree",
      "add",
      "-b",
      freeWorktree.branchName,
      freeWorktree.worktreePath,
      "HEAD"
    ]);

    return freeWorktree;
  },
  Effect.catchTag("GitCommandFailedError", (gitCommandFailed) =>
    Effect.fail(WorktreeCreateFailedError.make({gitError: gitCommandFailed.gitError}))
  )
);

const copyIncludedFile = Effect.fn("WorktreeInfraService.copyIncludedFile")(function* (
  worktreeDependencies: WorktreeDependencies,
  copyIncludedFilesRequest: CopyIncludedFilesRequest,
  relativeFilePath: string
) {
  const copiedFilePath = worktreeDependencies.path.join(copyIncludedFilesRequest.worktreePath, relativeFilePath);
  yield* worktreeDependencies.fileSystem.makeDirectory(worktreeDependencies.path.dirname(copiedFilePath), {
    recursive: true
  });
  yield* worktreeDependencies.fileSystem.copyFile(
    worktreeDependencies.path.join(copyIncludedFilesRequest.projectPath, relativeFilePath),
    copiedFilePath
  );
});

// git matches the patterns as .gitignore does, so `.env*` finds every .env file in the project, at any depth.
const copyIncludedFiles = Effect.fn("WorktreeInfraService.copyIncludedFiles")(
  function* (worktreeDependencies: WorktreeDependencies, copyIncludedFilesRequest: CopyIncludedFilesRequest) {
    const includeFilePath = worktreeDependencies.path.join(
      copyIncludedFilesRequest.projectPath,
      WORKTREES.INCLUDE_FILE
    );
    const hasIncludeFile = yield* worktreeDependencies.fileSystem.exists(includeFilePath);
    const excludeArguments = hasIncludeFile
      ? [`--exclude-from=${includeFilePath}`]
      : Array.map(copyIncludedFilesRequest.filePatterns, (filePattern) => `--exclude=${filePattern}`);
    if (excludeArguments.length === 0) return;
    const includedFilesOutput = yield* runGitCommand(worktreeDependencies, copyIncludedFilesRequest.projectPath, [
      "ls-files",
      "--others",
      "--ignored",
      ...excludeArguments
    ]);

    const includedFilePaths = Array.filter(String.split("\n")(includedFilesOutput), String.isNonEmpty);

    yield* Effect.forEach(includedFilePaths, (includedFilePath) =>
      copyIncludedFile(worktreeDependencies, copyIncludedFilesRequest, includedFilePath)
    );
  },
  Effect.catch((copyError) => Effect.logWarning("Could not copy the included files into the worktree", copyError))
);

const isMadeByAggregor = Effect.fn("WorktreeInfraService.isMadeByAggregor")(function* (
  worktreeDependencies: WorktreeDependencies,
  worktreePath: ProjectPathValueObject,
  worktreesFolderPath: string
) {
  const settingsFolderPath =
    worktreesFolderPath === "" ? "" : yield* expandHomeFolder(worktreeDependencies, worktreesFolderPath);
  const madeFolderPaths = [
    worktreeDependencies.path.join(worktreeDependencies.aggregorFolderPath, WORKTREES.FOLDER_NAME),
    ...(settingsFolderPath === "" ? [] : [settingsFolderPath])
  ];

  return Array.some(madeFolderPaths, (madeFolderPath) => {
    const relativePath = worktreeDependencies.path.relative(madeFolderPath, worktreePath);

    return (
      relativePath !== "" &&
      !String.startsWith("..")(relativePath) &&
      !worktreeDependencies.path.isAbsolute(relativePath)
    );
  });
});

const hasChanges = Effect.fn("WorktreeInfraService.hasChanges")(function* (
  worktreeDependencies: WorktreeDependencies,
  worktreePath: ProjectPathValueObject
) {
  const statusResult = yield* Effect.result(
    runGitCommand(worktreeDependencies, worktreePath, ["status", "--porcelain"])
  );

  return Result.match(statusResult, {
    onFailure: () => true,
    onSuccess: (statusOutput) => String.trim(statusOutput) !== ""
  });
});

const removeWorktree = Effect.fn("WorktreeInfraService.removeWorktree")(
  function* (
    worktreeDependencies: WorktreeDependencies,
    projectPath: ProjectPathValueObject,
    worktreePath: ProjectPathValueObject
  ) {
    const isFolderThere = yield* Effect.orElseSucceed(worktreeDependencies.fileSystem.exists(worktreePath), () => true);
    if (!isFolderThere) return yield* runGitCommand(worktreeDependencies, projectPath, ["worktree", "prune"]);
    if (yield* hasChanges(worktreeDependencies, worktreePath))
      return yield* WorktreeHasChangesError.make({worktreePath});

    return yield* runGitCommand(worktreeDependencies, projectPath, ["worktree", "remove", worktreePath]);
  },
  Effect.catchTag("GitCommandFailedError", (gitCommandFailed) =>
    Effect.fail(WorktreeRemoveFailedError.make({gitError: gitCommandFailed.gitError}))
  )
);

const toWorktreeBranch = Effect.fn("WorktreeInfraService.toWorktreeBranch")(function* (referenceLine: string) {
  const [branchName, upstreamTrack = "", worktreePath = ""] = String.split("\t")(referenceLine);
  const worktreeBranch: WorktreeBranch = {
    branchName,
    isUpstreamGone: String.includes("gone")(upstreamTrack),
    worktreePath
  };

  return worktreeBranch;
});

const listAggregorBranches = Effect.fn("WorktreeInfraService.listAggregorBranches")(
  function* (worktreeDependencies: WorktreeDependencies, projectPath: ProjectPathValueObject) {
    const referenceOutput = yield* runGitCommand(worktreeDependencies, projectPath, [
      "for-each-ref",
      "--format=%(refname:short)%09%(upstream:track)%09%(worktreepath)",
      `${GIT_COMMAND.BRANCH_REF_PREFIX}${WORKTREES.BRANCH_PREFIX}`
    ]);
    const referenceLines = Array.filter(String.split("\n")(referenceOutput), String.isNonEmpty);

    return yield* Effect.forEach(referenceLines, (referenceLine) => toWorktreeBranch(referenceLine));
  },
  Effect.mapError(() => NotGitRepositoryError.make())
);

const findBaseBranch = Effect.fn("WorktreeInfraService.findBaseBranch")(
  function* (worktreeDependencies: WorktreeDependencies, projectPath: ProjectPathValueObject) {
    const originHead = yield* Effect.result(
      runGitCommand(worktreeDependencies, projectPath, [
        "symbolic-ref",
        "--quiet",
        "--short",
        "refs/remotes/origin/HEAD"
      ])
    );
    if (Result.isSuccess(originHead)) return String.trim(originHead.success);
    const projectHead = yield* runGitCommand(worktreeDependencies, projectPath, ["rev-parse", "--abbrev-ref", "HEAD"]);

    return String.trim(projectHead);
  },
  Effect.mapError(() => NotGitRepositoryError.make())
);

const isBranchMerged = Effect.fn("WorktreeInfraService.isBranchMerged")(function* (
  worktreeDependencies: WorktreeDependencies,
  branchMergeCheck: BranchMergeCheck
) {
  const ancestorCheck = yield* Effect.result(
    runGitCommand(worktreeDependencies, branchMergeCheck.projectPath, [
      "merge-base",
      "--is-ancestor",
      branchMergeCheck.branchName,
      branchMergeCheck.baseBranchName
    ])
  );

  return Result.isSuccess(ancestorCheck);
});

const pruneRemote = Effect.fn("WorktreeInfraService.pruneRemote")(
  function* (worktreeDependencies: WorktreeDependencies, projectPath: ProjectPathValueObject) {
    yield* runGitCommand(worktreeDependencies, projectPath, ["remote", "prune", "origin"]);
  },
  Effect.timeout(GIT_COMMAND.PRUNE_TIMEOUT),
  Effect.ignore({log: "Debug", message: "Could not prune origin's branches"})
);

// -D, since a squash-merged branch never looks merged to git; the user picked it.
const deleteBranch = Effect.fn("WorktreeInfraService.deleteBranch")(
  function* (worktreeDependencies: WorktreeDependencies, projectPath: ProjectPathValueObject, branchName: string) {
    yield* runGitCommand(worktreeDependencies, projectPath, ["branch", "-D", branchName]);
  },
  Effect.catchTag("GitCommandFailedError", (gitCommandFailed) =>
    Effect.fail(BranchDeleteFailedError.make({gitError: gitCommandFailed.gitError}))
  )
);

const wireBranchMembers = Effect.fn("WorktreeInfraService.wireBranchMembers")(function* (
  worktreeDependencies: WorktreeDependencies
) {
  return {
    deleteBranch: (projectPath: ProjectPathValueObject, branchName: string) =>
      deleteBranch(worktreeDependencies, projectPath, branchName),
    findBaseBranch: (projectPath: ProjectPathValueObject) => findBaseBranch(worktreeDependencies, projectPath),
    findFreeBranchName: (worktreePath: ProjectPathValueObject, branchName: string) =>
      findFreeBranchName(worktreeDependencies, worktreePath, branchName),
    hasUpstream: (worktreePath: ProjectPathValueObject) => hasUpstream(worktreeDependencies, worktreePath),
    isBranchMerged: (branchMergeCheck: BranchMergeCheck) => isBranchMerged(worktreeDependencies, branchMergeCheck),
    listAggregorBranches: (projectPath: ProjectPathValueObject) =>
      listAggregorBranches(worktreeDependencies, projectPath),
    pruneRemote: (projectPath: ProjectPathValueObject) => pruneRemote(worktreeDependencies, projectPath),
    readBranchName: (worktreePath: ProjectPathValueObject) => readBranchName(worktreeDependencies, worktreePath),
    renameBranch: (worktreePath: ProjectPathValueObject, branchName: string) =>
      renameBranch(worktreeDependencies, worktreePath, branchName)
  };
});

const wireWorktreeMembers = Effect.fn("WorktreeInfraService.wireWorktreeMembers")(function* (
  worktreeDependencies: WorktreeDependencies
) {
  return {
    copyIncludedFiles: (copyIncludedFilesRequest: CopyIncludedFilesRequest) =>
      copyIncludedFiles(worktreeDependencies, copyIncludedFilesRequest),
    createWorktree: (createWorktreeRequest: CreateWorktreeRequest) =>
      createWorktree(worktreeDependencies, createWorktreeRequest),
    hasChanges: (worktreePath: ProjectPathValueObject) => hasChanges(worktreeDependencies, worktreePath),
    isMadeByAggregor: (worktreePath: ProjectPathValueObject, worktreesFolderPath: string) =>
      isMadeByAggregor(worktreeDependencies, worktreePath, worktreesFolderPath),
    listWorktrees: (projectPath: ProjectPathValueObject) => listWorktrees(worktreeDependencies, projectPath),
    removeWorktree: (projectPath: ProjectPathValueObject, worktreePath: ProjectPathValueObject) =>
      removeWorktree(worktreeDependencies, projectPath, worktreePath)
  };
});

const makeWorktreeInfraService = Effect.fn("WorktreeInfraService.make")(function* () {
  const worktreeDependencies: WorktreeDependencies = {
    aggregorFolderPath: yield* getAggregorFolderPath(),
    childProcessSpawner: yield* ChildProcessSpawner,
    fileSystem: yield* FileSystem,
    path: yield* Path
  };

  return {...(yield* wireBranchMembers(worktreeDependencies)), ...(yield* wireWorktreeMembers(worktreeDependencies))};
});

export const WorktreeInfraService = Layer.effect(IWorktreeInfraService, makeWorktreeInfraService());
