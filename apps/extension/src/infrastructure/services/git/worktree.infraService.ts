import {homedir} from "node:os";

import {NodeServices} from "@effect/platform-node";
import {Array, Context, Effect, Layer, Result, Schema, Stream, String} from "effect";
import {FileSystem} from "effect/FileSystem";
import {sumAll} from "effect/Number";
import {Path} from "effect/Path";
import {ChildProcess} from "effect/process";
import {ChildProcessSpawner} from "effect/process/ChildProcessSpawner";

import {AggregorFolderUtils} from "@/infraUtils/aggregorFolder.utils.ts";
import {IWorktreeInfraService, IWorktreeInfraServiceErrors} from "@/interfaces/worktree.infraService.interface.ts";
import {ProjectPathValueObjectSchema} from "@/valueObjects/projectPath.valueObject.ts";
import {GIT_COMMAND, WORKTREES} from "@pkg/constants/src/git.constant.ts";
import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";

import type {
  BranchMergeCheck,
  CopyIncludedFilesRequest,
  CreateWorktreeRequest,
  GitWorktree,
  ProjectBranchNames,
  WorktreeBranch,
  WorktreeDiffStats
} from "@/interfaces/worktree.infraService.interface.ts";
import type {ProjectPathValueObject} from "@/valueObjects/projectPath.valueObject.ts";

class WorktreeInfraServiceErrors extends TaggedErrors({
  GitCommandFailedError: {gitError: Schema.String}
}) {}

export class WorktreeInfraService extends Context.Service<WorktreeInfraService>()(
  "aggregor-app/infrastructure/services/git/worktree.infraService/WorktreeInfraService",
  {
    make: Effect.fn("WorktreeInfraService.make")(function* () {
      const aggregorFolderUtils = yield* AggregorFolderUtils;
      const childProcessSpawner = yield* ChildProcessSpawner;
      const fileSystem = yield* FileSystem;
      const path = yield* Path;
      const aggregorFolderPath = yield* aggregorFolderUtils.getAggregorFolderPath;

      const runGitCommand = Effect.fn("WorktreeInfraService.runGitCommand")(
        function* (repositoryPath: string, gitArguments: readonly string[]) {
          const gitProcess = yield* childProcessSpawner.spawn(
            ChildProcess.make(GIT_COMMAND.COMMAND, ["-C", repositoryPath, ...gitArguments], {
              env: GIT_COMMAND.ENVIRONMENT,
              extendEnv: true
            })
          );
          const [standardOutput, errorOutput, exitCode] = yield* Effect.all(
            [
              Stream.mkString(Stream.decodeText(gitProcess.stdout)),
              Stream.mkString(Stream.decodeText(gitProcess.stderr)),
              gitProcess.exitCode
            ],
            {concurrency: "unbounded"}
          );
          if (Number(exitCode) !== 0)
            return yield* WorktreeInfraServiceErrors.GitCommandFailedError.make({gitError: String.trim(errorOutput)});

          return standardOutput;
        },
        Effect.scoped,
        Effect.catchTag("PlatformError", (platformError) =>
          Effect.fail(WorktreeInfraServiceErrors.GitCommandFailedError.make({gitError: platformError.message}))
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
        function* (projectPath: ProjectPathValueObject) {
          const porcelainOutput = yield* runGitCommand(projectPath, ["worktree", "list", "--porcelain"]);
          const porcelainBlocks = Array.filter(String.split("\n\n")(String.trim(porcelainOutput)), String.isNonEmpty);
          const worktrees = yield* Effect.forEach(porcelainBlocks, (porcelainBlock) =>
            readWorktreeBlock(porcelainBlock)
          );

          return Array.drop(worktrees, 1);
        },
        Effect.mapError(() => IWorktreeInfraServiceErrors.NotGitRepositoryError.make())
      );

      const expandHomeFolder = Effect.fn("WorktreeInfraService.expandHomeFolder")(function* (folderPath: string) {
        if (folderPath === "~" || String.startsWith("~/")(folderPath))
          return path.join(homedir(), String.slice(1)(folderPath));

        return folderPath;
      });

      const findWorktreesFolderPath = Effect.fn("WorktreeInfraService.findWorktreesFolderPath")(function* (
        createWorktreeRequest: CreateWorktreeRequest
      ) {
        if (createWorktreeRequest.worktreesFolderPath !== "")
          return yield* expandHomeFolder(createWorktreeRequest.worktreesFolderPath);

        return path.join(aggregorFolderPath, WORKTREES.FOLDER_NAME, createWorktreeRequest.worktreesFolderName);
      });

      const findWorktreesRootPath = Effect.fn("WorktreeInfraService.findWorktreesRootPath")(function* (
        worktreesFolderPath: string
      ) {
        if (worktreesFolderPath !== "") return yield* expandHomeFolder(worktreesFolderPath);

        return path.join(aggregorFolderPath, WORKTREES.FOLDER_NAME);
      });

      const isBranchTaken = Effect.fn("WorktreeInfraService.isBranchTaken")(function* (
        repositoryPath: string,
        branchName: string
      ) {
        const branchCheck = yield* Effect.result(
          runGitCommand(repositoryPath, [
            "rev-parse",
            "--verify",
            "--quiet",
            `${GIT_COMMAND.BRANCH_REF_PREFIX}${branchName}`
          ])
        );

        return Result.isSuccess(branchCheck);
      });

      const isNameTaken = Effect.fn("WorktreeInfraService.isNameTaken")(function* (
        projectPath: ProjectPathValueObject,
        worktree: GitWorktree
      ) {
        const isFolderTaken = yield* Effect.orElseSucceed(fileSystem.exists(worktree.worktreePath), () => true);
        const isTakenAsBranch = yield* isBranchTaken(projectPath, worktree.branchName);

        return isFolderTaken || isTakenAsBranch;
      });

      const findFreeBranchName = Effect.fn("WorktreeInfraService.findFreeBranchName")(function* (
        worktreePath: ProjectPathValueObject,
        branchName: string
      ) {
        const candidates = Array.map(Array.range(1, WORKTREES.MAX_NAME_SUFFIX), (suffix) =>
          suffix === 1 ? branchName : `${branchName}-${suffix}`
        );
        const freeBranchName = yield* Effect.findFirst(candidates, (candidate) =>
          Effect.map(isBranchTaken(worktreePath, candidate), (isTaken) => !isTaken)
        );

        return yield* Effect.fromResult(
          Result.fromOption(freeBranchName, () =>
            IWorktreeInfraServiceErrors.BranchRenameFailedError.make({
              gitError: `${branchName} and its numbered names are taken`
            })
          )
        );
      });

      const hasUpstream = Effect.fn("WorktreeInfraService.hasUpstream")(function* (
        worktreePath: ProjectPathValueObject
      ) {
        const upstreamCheck = yield* Effect.result(
          runGitCommand(worktreePath, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"])
        );

        return Result.isSuccess(upstreamCheck);
      });

      // Two small reads and no git process, since a session's row reads its branch on every redraw.
      const findGitDirectoryPath = Effect.fn("WorktreeInfraService.findGitDirectoryPath")(function* (
        checkoutPath: ProjectPathValueObject
      ) {
        const gitPath = path.join(checkoutPath, GIT_COMMAND.GIT_PATH_NAME);
        const gitPathInfo = yield* fileSystem.stat(gitPath);
        if (gitPathInfo.type === "Directory") return gitPath;
        const gitFile = yield* fileSystem.readFileString(gitPath);

        return path.resolve(
          checkoutPath,
          String.trim(String.replace(GIT_COMMAND.GITDIR_PREFIX, "")(String.trim(gitFile)))
        );
      });

      const readBranchName = Effect.fn("WorktreeInfraService.readBranchName")(
        function* (worktreePath: ProjectPathValueObject) {
          const gitDirectoryPath = yield* findGitDirectoryPath(worktreePath);
          const headFile = yield* fileSystem.readFileString(path.join(gitDirectoryPath, GIT_COMMAND.HEAD_FILE_NAME));
          const head = String.trim(headFile);

          return String.startsWith(GIT_COMMAND.HEAD_REF_PREFIX)(head)
            ? String.slice(GIT_COMMAND.HEAD_REF_PREFIX.length)(head)
            : String.slice(0, GIT_COMMAND.SHORT_HASH_LENGTH)(head);
        },
        Effect.mapError(() => IWorktreeInfraServiceErrors.NotGitRepositoryError.make())
      );

      const renameBranch = Effect.fn("WorktreeInfraService.renameBranch")(
        function* (worktreePath: ProjectPathValueObject, branchName: string) {
          yield* runGitCommand(worktreePath, ["branch", "-m", branchName]);
        },
        Effect.catchTag("GitCommandFailedError", (gitCommandFailed) =>
          Effect.fail(IWorktreeInfraServiceErrors.BranchRenameFailedError.make({gitError: gitCommandFailed.gitError}))
        )
      );

      const findFreeWorktree = Effect.fn("WorktreeInfraService.findFreeWorktree")(function* (
        createWorktreeRequest: CreateWorktreeRequest,
        worktreesFolderPath: string
      ) {
        const suffixes = Array.range(1, WORKTREES.MAX_NAME_SUFFIX);
        const candidates = Array.map(suffixes, (suffix): GitWorktree => {
          const nameSuffix = suffix === 1 ? "" : `-${suffix}`;

          return {
            branchName: `${createWorktreeRequest.branchName}${nameSuffix}`,
            worktreePath: ProjectPathValueObjectSchema.make(
              path.join(worktreesFolderPath, `${createWorktreeRequest.worktreeName}${nameSuffix}`)
            )
          };
        });

        const freeCandidate = yield* Effect.findFirst(candidates, (candidate) =>
          Effect.map(isNameTaken(createWorktreeRequest.projectPath, candidate), (isTaken) => !isTaken)
        );

        return yield* Effect.fromResult(
          Result.fromOption(freeCandidate, () =>
            WorktreeInfraServiceErrors.GitCommandFailedError.make({
              gitError: `${createWorktreeRequest.branchName} and its numbered names are taken`
            })
          )
        );
      });

      const createWorktree = Effect.fn("WorktreeInfraService.createWorktree")(
        function* (createWorktreeRequest: CreateWorktreeRequest) {
          const worktreesFolderPath = yield* findWorktreesFolderPath(createWorktreeRequest);
          const freeWorktree = yield* findFreeWorktree(createWorktreeRequest, worktreesFolderPath);
          yield* runGitCommand(createWorktreeRequest.projectPath, [
            "worktree",
            "add",
            "-b",
            freeWorktree.branchName,
            freeWorktree.worktreePath,
            createWorktreeRequest.startPoint
          ]);

          return freeWorktree;
        },
        Effect.catchTag("GitCommandFailedError", (gitCommandFailed) =>
          Effect.fail(IWorktreeInfraServiceErrors.WorktreeCreateFailedError.make({gitError: gitCommandFailed.gitError}))
        )
      );

      const copyIncludedFile = Effect.fn("WorktreeInfraService.copyIncludedFile")(function* (
        copyIncludedFilesRequest: CopyIncludedFilesRequest,
        relativeFilePath: string
      ) {
        const copiedFilePath = path.join(copyIncludedFilesRequest.worktreePath, relativeFilePath);
        yield* fileSystem.makeDirectory(path.dirname(copiedFilePath), {
          recursive: true
        });
        yield* fileSystem.copyFile(path.join(copyIncludedFilesRequest.projectPath, relativeFilePath), copiedFilePath);
      });

      // git matches the patterns as .gitignore does, so `.env*` finds every .env file in the project, at any depth.
      const copyIncludedFiles = Effect.fn("WorktreeInfraService.copyIncludedFiles")(
        function* (copyIncludedFilesRequest: CopyIncludedFilesRequest) {
          const includeFilePath = path.join(copyIncludedFilesRequest.projectPath, WORKTREES.INCLUDE_FILE);
          const hasIncludeFile = yield* fileSystem.exists(includeFilePath);
          const excludeArguments = hasIncludeFile
            ? [`--exclude-from=${includeFilePath}`]
            : Array.map(copyIncludedFilesRequest.filePatterns, (filePattern) => `--exclude=${filePattern}`);
          if (excludeArguments.length === 0) return;
          const includedFilesOutput = yield* runGitCommand(copyIncludedFilesRequest.projectPath, [
            "ls-files",
            "--others",
            "--ignored",
            ...excludeArguments
          ]);

          const includedFilePaths = Array.filter(String.split("\n")(includedFilesOutput), String.isNonEmpty);

          yield* Effect.forEach(includedFilePaths, (includedFilePath) =>
            copyIncludedFile(copyIncludedFilesRequest, includedFilePath)
          );
        },
        Effect.catch((copyError) => Effect.logWarning("Could not copy the included files into the worktree", copyError))
      );

      const isMadeByAggregor = Effect.fn("WorktreeInfraService.isMadeByAggregor")(function* (
        worktreePath: ProjectPathValueObject,
        worktreesFolderPath: string
      ) {
        const settingsFolderPath = worktreesFolderPath === "" ? "" : yield* expandHomeFolder(worktreesFolderPath);
        const madeFolderPaths = [
          path.join(aggregorFolderPath, WORKTREES.FOLDER_NAME),
          ...(settingsFolderPath === "" ? [] : [settingsFolderPath])
        ];

        return Array.some(madeFolderPaths, (madeFolderPath) => {
          const relativePath = path.relative(madeFolderPath, worktreePath);

          return relativePath !== "" && !String.startsWith("..")(relativePath) && !path.isAbsolute(relativePath);
        });
      });

      const hasChanges = Effect.fn("WorktreeInfraService.hasChanges")(function* (worktreePath: ProjectPathValueObject) {
        const statusResult = yield* Effect.result(runGitCommand(worktreePath, ["status", "--porcelain"]));

        return Result.match(statusResult, {
          onFailure: () => true,
          onSuccess: (statusOutput) => String.trim(statusOutput) !== ""
        });
      });

      // shortcut: reads, then removes, so a worktree added in between goes too; use rmdir once Effect's FileSystem has one.
      const removeEmptyProjectFolder = Effect.fn("WorktreeInfraService.removeEmptyProjectFolder")(
        function* (worktreePath: ProjectPathValueObject) {
          const projectFolderPath = path.dirname(worktreePath);
          const worktreesRootPath = path.join(aggregorFolderPath, WORKTREES.FOLDER_NAME);
          // A project's own worktree folder setting names the user's folder, which stays.
          if (path.dirname(projectFolderPath) !== worktreesRootPath) return;
          const remainingNames = yield* fileSystem.readDirectory(projectFolderPath);
          if (remainingNames.length > 0) return;

          yield* fileSystem.remove(projectFolderPath, {recursive: true});
        },
        Effect.ignore({log: "Debug", message: "Could not remove the project's empty worktrees folder"})
      );

      const removeWorktree = Effect.fn("WorktreeInfraService.removeWorktree")(
        function* (projectPath: ProjectPathValueObject, worktreePath: ProjectPathValueObject) {
          const isFolderThere = yield* Effect.orElseSucceed(fileSystem.exists(worktreePath), () => true);
          if (isFolderThere && (yield* hasChanges(worktreePath)))
            return yield* IWorktreeInfraServiceErrors.WorktreeHasChangesError.make({worktreePath});
          yield* runGitCommand(
            projectPath,
            isFolderThere ? ["worktree", "remove", worktreePath] : ["worktree", "prune"]
          );

          return yield* removeEmptyProjectFolder(worktreePath);
        },
        Effect.catchTag("GitCommandFailedError", (gitCommandFailed) =>
          Effect.fail(IWorktreeInfraServiceErrors.WorktreeRemoveFailedError.make({gitError: gitCommandFailed.gitError}))
        )
      );

      const parseWorktreeBranch = Effect.fn("WorktreeInfraService.parseWorktreeBranch")(function* (
        referenceLine: string
      ) {
        const [branchName, upstreamTrack = "", worktreePath = ""] = String.split("\t")(referenceLine);
        const worktreeBranch: WorktreeBranch = {
          branchName,
          isUpstreamGone: String.includes("gone")(upstreamTrack),
          worktreePath
        };

        return worktreeBranch;
      });

      const listLocalBranches = Effect.fn("WorktreeInfraService.listLocalBranches")(
        function* (projectPath: ProjectPathValueObject) {
          const referenceOutput = yield* runGitCommand(projectPath, [
            "for-each-ref",
            "--format=%(refname:short)%09%(upstream:track)%09%(worktreepath)",
            GIT_COMMAND.BRANCH_REF_PREFIX
          ]);
          const referenceLines = Array.filter(String.split("\n")(referenceOutput), String.isNonEmpty);

          return yield* Effect.forEach(referenceLines, (referenceLine) => parseWorktreeBranch(referenceLine));
        },
        Effect.mapError(() => IWorktreeInfraServiceErrors.NotGitRepositoryError.make())
      );

      // origin/HEAD is a symbolic ref to origin's default branch, which is listed on its own.
      const listReferenceNames = Effect.fn("WorktreeInfraService.listReferenceNames")(function* (
        projectPath: ProjectPathValueObject,
        referencePrefix: string
      ) {
        const referenceOutput = yield* runGitCommand(projectPath, [
          "for-each-ref",
          "--format=%(refname:short)%09%(symref)",
          referencePrefix
        ]);
        const referenceLines = Array.filter(String.split("\n")(referenceOutput), String.isNonEmpty);
        const branchReferenceLines = Array.filter(referenceLines, (referenceLine) =>
          String.endsWith("\t")(referenceLine)
        );

        return Array.map(branchReferenceLines, (branchReferenceLine) => String.trim(branchReferenceLine));
      });

      const listBranchNames = Effect.fn("WorktreeInfraService.listBranchNames")(
        function* (projectPath: ProjectPathValueObject) {
          const projectBranchNames: ProjectBranchNames = {
            localBranchNames: yield* listReferenceNames(projectPath, GIT_COMMAND.BRANCH_REF_PREFIX),
            remoteBranchNames: yield* listReferenceNames(projectPath, GIT_COMMAND.REMOTE_BRANCH_REF_PREFIX)
          };

          return projectBranchNames;
        },
        Effect.mapError(() => IWorktreeInfraServiceErrors.NotGitRepositoryError.make())
      );

      const isBranchMergedIntoReference = Effect.fn("WorktreeInfraService.isBranchMergedIntoReference")(function* (
        projectPath: ProjectPathValueObject,
        branchName: string,
        baseReferenceName: string
      ) {
        const ancestorCheck = yield* Effect.result(
          runGitCommand(projectPath, ["merge-base", "--is-ancestor", branchName, baseReferenceName])
        );

        return Result.isSuccess(ancestorCheck);
      });

      const isBranchMerged = Effect.fn("WorktreeInfraService.isBranchMerged")(function* (
        branchMergeCheck: BranchMergeCheck
      ) {
        const isInOriginBase = yield* isBranchMergedIntoReference(
          branchMergeCheck.projectPath,
          branchMergeCheck.branchName,
          `${GIT_COMMAND.ORIGIN_BRANCH_PREFIX}${branchMergeCheck.baseBranchName}`
        );
        if (isInOriginBase) return true;

        return yield* isBranchMergedIntoReference(
          branchMergeCheck.projectPath,
          branchMergeCheck.branchName,
          branchMergeCheck.baseBranchName
        );
      });

      const pruneRemote = Effect.fn("WorktreeInfraService.pruneRemote")(
        function* (projectPath: ProjectPathValueObject) {
          yield* runGitCommand(projectPath, ["remote", "prune", "origin"]);
        },
        Effect.timeout(GIT_COMMAND.PRUNE_TIMEOUT),
        Effect.ignore({log: "Debug", message: "Could not prune origin's branches"})
      );

      const fetchRemote = Effect.fn("WorktreeInfraService.fetchRemote")(
        function* (projectPath: ProjectPathValueObject) {
          yield* runGitCommand(projectPath, ["fetch", "--prune", "origin"]);
        },
        Effect.timeout(GIT_COMMAND.FETCH_TIMEOUT),
        Effect.ignore({log: "Debug", message: "Could not fetch origin's branches"})
      );

      // -D, since a squash-merged branch never looks merged to git; the user picked it.
      const deleteBranch = Effect.fn("WorktreeInfraService.deleteBranch")(
        function* (projectPath: ProjectPathValueObject, branchName: string) {
          yield* runGitCommand(projectPath, ["branch", "-D", branchName]);
        },
        Effect.catchTag("GitCommandFailedError", (gitCommandFailed) =>
          Effect.fail(IWorktreeInfraServiceErrors.BranchDeleteFailedError.make({gitError: gitCommandFailed.gitError}))
        )
      );

      const sumNumstatLines = Effect.fn("WorktreeInfraService.sumNumstatLines")(function* (numstatOutput: string) {
        const numstatLines = Array.filter(String.split(numstatOutput, "\n"), (numstatLine) => numstatLine !== "");
        const lineCounts = Array.map(numstatLines, (numstatLine) => String.split(numstatLine, "\t"));

        return {
          changedFileCount: numstatLines.length,
          deletionCount: sumAll(Array.map(lineCounts, (lineCount) => Number(lineCount[1]) || 0)),
          insertionCount: sumAll(Array.map(lineCounts, (lineCount) => Number(lineCount[0]) || 0))
        };
      });

      const readTrackedDiffStats = Effect.fn("WorktreeInfraService.readTrackedDiffStats")(function* (
        worktreePath: ProjectPathValueObject,
        baseBranchName: string
      ) {
        const mergeBase = yield* runGitCommand(worktreePath, ["merge-base", "HEAD", baseBranchName]);
        const numstatOutput = yield* runGitCommand(worktreePath, ["diff", "--numstat", String.trim(mergeBase)]);

        return yield* sumNumstatLines(numstatOutput);
      });

      // Counted as git counts an added file: one line per newline, plus a last line without one.
      const countNewFileLines = Effect.fn("WorktreeInfraService.countNewFileLines")(
        function* (newFilePath: string) {
          const newFileInfo = yield* fileSystem.stat(newFilePath);
          if (Number(newFileInfo.size) > GIT_COMMAND.MAX_COUNTED_FILE_BYTES) return 0;
          const newFileBytes = yield* fileSystem.readFile(newFilePath);
          if (newFileBytes.includes(0)) return 0;
          const newlineCount = newFileBytes.reduce((total, fileByte) => (fileByte === 10 ? total + 1 : total), 0);

          return newFileBytes.length > 0 && newFileBytes.at(-1) !== 10 ? newlineCount + 1 : newlineCount;
        },
        Effect.orElseSucceed(() => 0)
      );

      const readNewFileDiffStats = Effect.fn("WorktreeInfraService.readNewFileDiffStats")(function* (
        worktreePath: ProjectPathValueObject
      ) {
        const newFilesOutput = yield* runGitCommand(worktreePath, ["ls-files", "--others", "--exclude-standard", "-z"]);
        const newFilePaths = Array.filter(String.split(newFilesOutput, "\0"), (newFilePath) => newFilePath !== "");
        const newFileLineCounts = yield* Effect.forEach(
          newFilePaths,
          (newFilePath) => countNewFileLines(path.join(worktreePath, newFilePath)),
          {concurrency: GIT_COMMAND.NEW_FILE_READ_CONCURRENCY}
        );

        return {
          changedFileCount: newFilePaths.length,
          insertionCount: sumAll(newFileLineCounts)
        };
      });

      const readDiffStats = Effect.fn("WorktreeInfraService.readDiffStats")(
        function* (worktreePath: ProjectPathValueObject, baseBranchName: string) {
          const trackedDiffStats = yield* readTrackedDiffStats(worktreePath, baseBranchName);
          const newFileDiffStats = yield* readNewFileDiffStats(worktreePath);

          const worktreeDiffStats: WorktreeDiffStats = {
            changedFileCount: trackedDiffStats.changedFileCount + newFileDiffStats.changedFileCount,
            deletionCount: trackedDiffStats.deletionCount,
            insertionCount: trackedDiffStats.insertionCount + newFileDiffStats.insertionCount
          };

          return worktreeDiffStats;
        },
        Effect.mapError(() => IWorktreeInfraServiceErrors.NotGitRepositoryError.make())
      );

      return IWorktreeInfraService.of({
        copyIncludedFiles,
        createWorktree,
        deleteBranch,
        fetchRemote,
        findFreeBranchName,
        findWorktreesRootPath,
        hasChanges,
        hasUpstream,
        isBranchMerged,
        isMadeByAggregor,
        listBranchNames,
        listLocalBranches,
        listWorktrees,
        pruneRemote,
        readBranchName,
        readDiffStats,
        removeWorktree,
        renameBranch
      });
    })
  }
) {
  public static readonly layer = Layer.effect(IWorktreeInfraService, this.make()).pipe(
    Layer.provide([AggregorFolderUtils.layer, NodeServices.layer])
  );
}
