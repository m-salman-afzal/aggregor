import {getAggregorFolderPath} from "@infraUtils/aggregorFolder.utils.ts";
import {
  IWorktreeInfraService,
  NotGitRepositoryError,
  WorktreeCreateFailedError
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
  CopyIncludedFilesRequest,
  CreateWorktreeRequest,
  GitWorktree
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

const isNameTaken = Effect.fn("WorktreeInfraService.isNameTaken")(function* (
  worktreeDependencies: WorktreeDependencies,
  projectPath: ProjectPathValueObject,
  worktree: GitWorktree
) {
  const isFolderTaken = yield* Effect.orElseSucceed(
    worktreeDependencies.fileSystem.exists(worktree.worktreePath),
    () => true
  );
  const branchCheck = yield* Effect.result(
    runGitCommand(worktreeDependencies, projectPath, [
      "rev-parse",
      "--verify",
      "--quiet",
      `refs/heads/${worktree.branchName}`
    ])
  );

  return isFolderTaken || Result.isSuccess(branchCheck);
});

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

const makeWorktreeInfraService = Effect.fn("WorktreeInfraService.make")(function* () {
  const worktreeDependencies: WorktreeDependencies = {
    aggregorFolderPath: yield* getAggregorFolderPath(),
    childProcessSpawner: yield* ChildProcessSpawner,
    fileSystem: yield* FileSystem,
    path: yield* Path
  };

  return {
    copyIncludedFiles: (copyIncludedFilesRequest: CopyIncludedFilesRequest) =>
      copyIncludedFiles(worktreeDependencies, copyIncludedFilesRequest),
    createWorktree: (createWorktreeRequest: CreateWorktreeRequest) =>
      createWorktree(worktreeDependencies, createWorktreeRequest),
    listWorktrees: (projectPath: ProjectPathValueObject) => listWorktrees(worktreeDependencies, projectPath)
  };
});

export const WorktreeInfraService = Layer.effect(IWorktreeInfraService, makeWorktreeInfraService());
