/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {SourceControlHistoryItem} from "vscode";

import type {CancellationToken, Command, Disposable, Event, ProviderResult, Uri} from "vscode";
export type {ProviderResult} from "vscode";

export const enum ForcePushMode {
  Force,
  ForceWithLease,
  ForceWithLeaseIfIncludes
}

export const enum GitErrorCodes {
  AuthenticationFailed = "AuthenticationFailed",
  BadConfigFile = "BadConfigFile",
  BadRevision = "BadRevision",
  BranchAlreadyExists = "BranchAlreadyExists",
  BranchFastForwardRejected = "BranchFastForwardRejected",
  BranchNotFullyMerged = "BranchNotFullyMerged",
  BranchNotYetBorn = "BranchNotYetBorn",
  CantAccessRemote = "CantAccessRemote",
  CantCreatePipe = "CantCreatePipe",
  CantLockReference = "CantLockRef",
  CantOpenResource = "CantOpenResource",
  CantRebaseMultipleBranches = "CantRebaseMultipleBranches",
  CherryPickConflict = "CherryPickConflict",
  CherryPickEmpty = "CherryPickEmpty",
  Conflict = "Conflict",
  DirtyWorkTree = "DirtyWorkTree",
  EmptyCommitMessage = "EmptyCommitMessage",
  ForcePushWithLeaseIfIncludesRejected = "ForcePushWithLeaseIfIncludesRejected",
  ForcePushWithLeaseRejected = "ForcePushWithLeaseRejected",
  GitNotFound = "GitNotFound",
  InvalidBranchName = "InvalidBranchName",
  IsInSubmodule = "IsInSubmodule",
  LocalChangesOverwritten = "LocalChangesOverwritten",
  NoLocalChanges = "NoLocalChanges",
  NoPathFound = "NoPathFound",
  NoRemoteReference = "NoRemoteReference",
  NoRemoteRepoSpecified = "NoRemoteRepositorySpecified",
  NoStashFound = "NoStashFound",
  NotAGitRepo = "NotAGitRepository",
  NotASafeGitRepo = "NotASafeGitRepository",
  NotAtRepoRoot = "NotAtRepositoryRoot",
  NoUpstreamBranch = "NoUpstreamBranch",
  NoUserEmailConfigured = "NoUserEmailConfigured",
  NoUserNameConfigured = "NoUserNameConfigured",
  PatchDoesNotApply = "PatchDoesNotApply",
  PermissionDenied = "PermissionDenied",
  PushRejected = "PushRejected",
  RemoteConnectionError = "RemoteConnectionError",
  RepoIsLocked = "RepositoryIsLocked",
  RepoNotFound = "RepositoryNotFound",
  StashConflict = "StashConflict",
  TagConflict = "TagConflict",
  UnknownPath = "UnknownPath",
  UnmergedChanges = "UnmergedChanges",
  WorktreeAlreadyExists = "WorktreeAlreadyExists",
  WorktreeBranchAlreadyUsed = "WorktreeBranchAlreadyUsed",
  WorktreeContainsChanges = "WorktreeContainsChanges",
  WrongCase = "WrongCase"
}

export const enum RefType {
  Head,
  RemoteHead,
  Tag
}

export const enum Status {
  INDEX_MODIFIED,
  INDEX_ADDED,
  INDEX_DELETED,
  INDEX_RENAMED,
  INDEX_COPIED,

  MODIFIED,
  DELETED,
  UNTRACKED,
  IGNORED,
  INTENT_TO_ADD,
  INTENT_TO_RENAME,
  TYPE_CHANGED,

  ADDED_BY_US,
  ADDED_BY_THEM,
  DELETED_BY_US,
  DELETED_BY_THEM,
  BOTH_ADDED,
  BOTH_DELETED,
  BOTH_MODIFIED
}

export interface API {
  /**
  Checks the cache of known cloned repositories, and clones if the repository is not found.
  Make sure to pass `postCloneAction` 'none' if you want to have the URI where you can find the repository returned.
  @returns The URI of a folder or workspace file which, when opened, will open the cloned repository.
  */
  clone: (uri: Uri, options?: CloneOptions) => Promise<null | Uri>;
  getRepository: (uri: Uri) => null | Repository;
  getRepositoryRoot: (uri: Uri) => Promise<null | Uri>;
  getRepositoryWorkspace: (uri: Uri) => Promise<null | Uri[]>;
  readonly git: Git;
  init: (root: Uri, options?: InitOptions) => Promise<null | Repository>;
  readonly onDidChangeState: Event<APIState>;
  readonly onDidCloseRepository: Event<Repository>;

  readonly onDidOpenRepository: Event<Repository>;
  readonly onDidPublish: Event<PublishEvent>;
  openRepository: (root: Uri) => Promise<null | Repository>;
  readonly recentRepositories: Iterable<RepositoryAccessDetails>;
  registerBranchProtectionProvider: (root: Uri, provider: BranchProtectionProvider) => Disposable;
  registerCredentialsProvider: (provider: CredentialsProvider) => Disposable;
  registerPostCommitCommandsProvider: (provider: PostCommitCommandsProvider) => Disposable;

  registerPushErrorHandler: (handler: PushErrorHandler) => Disposable;
  registerRemoteSourceProvider: (provider: RemoteSourceProvider) => Disposable;
  registerRemoteSourcePublisher: (publisher: RemoteSourcePublisher) => Disposable;
  registerSourceControlHistoryItemDetailsProvider: (provider: SourceControlHistoryItemDetailsProvider) => Disposable;
  readonly repositories: Repository[];
  readonly state: APIState;
  toGitUri: (uri: Uri, reference: string) => Uri;
}

export type APIState = "initialized" | "uninitialized";

export interface AvatarQuery {
  readonly commits: AvatarQueryCommit[];
  readonly size: number;
}

export interface AvatarQueryCommit {
  readonly authorEmail?: string;
  readonly authorName?: string;
  readonly hash: string;
}

export interface Branch extends Ref {
  readonly ahead?: number;
  readonly behind?: number;
  readonly upstream?: UpstreamRef;
}

export interface BranchProtection {
  readonly remote: string;
  readonly rules: BranchProtectionRule[];
}

export interface BranchProtectionProvider {
  onDidChangeBranchProtection: Event<Uri>;
  provideBranchProtection: () => BranchProtection[];
}

export interface BranchProtectionRule {
  readonly exclude?: string[];
  readonly include?: string[];
}

export interface BranchQuery extends RefQuery {
  readonly remote?: boolean;
}

export interface Change {
  readonly originalUri: Uri;
  readonly renameUri: undefined | Uri;
  readonly status: Status;
  /**
  Returns either `originalUri` or `renameUri`, depending
  on whether this change is a rename change. When
  in doubt always use `uri` over the other two alternatives.
  */
  readonly uri: Uri;
}

export interface CloneOptions {
  parentPath?: Uri;
  /**
  If no postCloneAction is provided, then the users setting for git.openAfterClone is used.
  */
  postCloneAction?: "none";
  recursive?: boolean;
  /**
  ref is only used if the repository cache is missed.
  */
  ref?: string;
}

export interface Commit {
  readonly authorDate?: Date;
  readonly authorEmail?: string;
  readonly authorName?: string;
  readonly commitDate?: Date;
  readonly hash: string;
  readonly message: string;
  readonly parents: string[];
  readonly shortStat?: CommitShortStat;
}

export interface CommitOptions {
  all?: "tracked" | boolean;
  amend?: boolean;
  empty?: boolean;
  noVerify?: boolean;
  /**
  string    - execute the specified command after the commit operation
  undefined - execute the command specified in git.postCommitCommand
              after the commit operation
  null      - do not execute any command after the commit operation
  */
  postCommitCommand?: null | string;
  requireUserConfig?: boolean;
  /**
  true  - sign the commit
  false - do not sign the commit
  undefined - use the repository/global Git config
  */
  signCommit?: boolean;
  signoff?: boolean;
  useEditor?: boolean;
  verbose?: boolean;
}

export interface CommitShortStat {
  readonly deletions: number;
  readonly files: number;
  readonly insertions: number;
}

export interface Credentials {
  readonly password: string;
  readonly username: string;
}

export interface CredentialsProvider {
  getCredentials: (host: Uri) => ProviderResult<Credentials>;
}

export interface DiffChange extends Change {
  readonly deletions: number;
  readonly insertions: number;
}

export interface FetchOptions {
  all?: boolean;
  depth?: number;
  prune?: boolean;
  ref?: string;
  remote?: string;
}

export interface Git {
  readonly path: string;
}

export interface GitExtension {
  readonly enabled: boolean;
  /**
  Returns a specific API version.
  
  Throws error if Git extension is disabled. You can listen to the
  [GitExtension.onDidChangeEnablement](#GitExtension.onDidChangeEnablement) event
  to know when the extension becomes enabled/disabled.
  
  @param version Version number.
  @returns API instance
  */
  getAPI: (version: 1) => API;

  readonly onDidChangeEnablement: Event<boolean>;
}

export interface InitOptions {
  defaultBranch?: string;
}

export interface InputBox {
  value: string;
}

/**
Log options.
*/
export interface LogOptions {
  readonly author?: string;
  readonly grep?: string;
  /** Max number of log entries to retrieve. If not specified, the default is 32. */
  readonly maxEntries?: number;
  readonly maxParents?: number;
  readonly path?: string;
  /** A commit range, such as "0a47c67f0fb52dd11562af48658bc1dff1d75a38..0bb4bdea78e1db44d728fd6894720071e303304f" */
  readonly range?: string;
  readonly refNames?: string[];
  readonly reverse?: boolean;
  readonly shortStats?: boolean;
  readonly skip?: number;
  readonly sortByAuthorDate?: boolean;
}

export interface PostCommitCommandsProvider {
  getCommands: (repo: Repository) => Command[];
}

export interface PublishEvent {
  branch?: string;
  repository: Repository;
}

export interface PushErrorHandler {
  handlePushError: (
    repo: Repository,
    remote: Remote,
    refspec: string,
    error: {gitErrorCode: GitErrorCodes} & Error
  ) => Promise<boolean>;
}

export interface Ref {
  readonly commit?: string;
  readonly commitDetails?: Commit;
  readonly name?: string;
  readonly remote?: string;
  readonly type: RefType;
}

export interface RefQuery {
  readonly contains?: string;
  readonly count?: number;
  readonly pattern?: string | string[];
  readonly sort?: "alphabetically" | "committerdate" | "creatordate";
}

export interface Remote {
  readonly fetchUrl?: string;
  readonly isReadOnly: boolean;
  readonly name: string;
  readonly pushUrl?: string;
}

export interface RemoteSource {
  readonly description?: string;
  readonly name: string;
  readonly url: string | string[];
}

export interface RemoteSourceProvider {
  getBranches?: (url: string) => ProviderResult<string[]>;
  getRemoteSources: (query?: string) => ProviderResult<RemoteSource[]>;
  readonly icon?: string; // codicon name
  readonly name: string;
  publishRepository?: (repo: Repository) => Promise<void>;
  readonly supportsQuery?: boolean;
}

export interface RemoteSourcePublisher {
  readonly icon?: string; // codicon name
  readonly name: string;
  publishRepository: (repo: Repository) => Promise<void>;
}

export interface Repository {
  add: (paths: string[]) => Promise<void>;
  addRemote: (name: string, url: string) => Promise<void>;
  apply: ((patch: string, options?: {allowEmpty?: boolean; reverse?: boolean; threeWay?: boolean}) => Promise<void>) &
    ((patch: string, reverse?: boolean) => Promise<void>);
  applyStash: (index?: number) => Promise<void>;
  blame: (path: string) => Promise<string>;

  buffer: (reference: string, path: string) => Promise<Buffer>;
  checkIgnore: (paths: string[]) => Promise<Set<string>>;

  checkout: (treeish: string) => Promise<void>;
  clean: (paths: string[]) => Promise<void>;
  commit: (message: string, options?: CommitOptions) => Promise<void>;
  createBranch: (name: string, checkout: boolean, reference?: string) => Promise<void>;
  createStash: (options?: {includeUntracked?: boolean; message?: string; staged?: boolean}) => Promise<void>;

  createWorktree: (options?: {
    branch?: string;
    commitish?: string;
    noTrack?: boolean;
    path?: string;
  }) => Promise<string>;
  deleteBranch: (name: string, force?: boolean) => Promise<void>;
  deleteTag: (name: string) => Promise<void>;
  deleteWorktree: (path: string, options?: {force?: boolean}) => Promise<void>;
  detectObjectType: (object: string) => Promise<{encoding?: string; mimetype: string}>;

  diff: (cached?: boolean) => Promise<string>;
  diffBetween: ((reference1: string, reference2: string, path: string) => Promise<string>) &
    ((reference1: string, reference2: string) => Promise<Change[]>);
  diffBetweenPatch: (reference1: string, reference2: string, path?: string) => Promise<string>;

  diffBetweenWithStats: (reference1: string, reference2: string, path?: string) => Promise<DiffChange[]>;
  diffBetweenWithStats2: (reference: string, path?: string) => Promise<DiffChange[]>;
  diffBlobs: (object1: string, object2: string) => Promise<string>;
  diffIndexWith: ((reference: string, path: string) => Promise<string>) & ((reference: string) => Promise<Change[]>);
  diffIndexWithHEAD: (() => Promise<Change[]>) & ((path: string) => Promise<string>);
  diffIndexWithHEADShortStats: (path?: string) => Promise<CommitShortStat>;
  diffWith: ((reference: string, path: string) => Promise<string>) & ((reference: string) => Promise<Change[]>);
  diffWithHEAD: (() => Promise<Change[]>) & ((path: string) => Promise<string>);
  diffWithHEADShortStats: (path?: string) => Promise<CommitShortStat>;
  dropStash: (index?: number) => Promise<void>;
  fetch: ((options?: FetchOptions) => Promise<void>) &
    ((remote?: string, reference?: string, depth?: number) => Promise<void>);
  generateRandomBranchName: () => Promise<string | undefined>;
  getBranch: (name: string) => Promise<Branch>;
  getBranchBase: (name: string) => Promise<Branch | undefined>;

  getBranches: (query: BranchQuery, cancellationToken?: CancellationToken) => Promise<Ref[]>;

  getCommit: (reference: string) => Promise<Commit>;
  getConfig: (key: string) => Promise<string>;
  getConfigs: () => Promise<{key: string; value: string}[]>;
  getGlobalConfig: (key: string) => Promise<string>;
  getMergeBase: (reference1: string, reference2: string) => Promise<string | undefined>;
  getObjectDetails: (treeish: string, path: string) => Promise<{mode: string; object: string; size: number}>;

  getRefs: (query: RefQuery, cancellationToken?: CancellationToken) => Promise<Ref[]>;

  hashObject: (data: string) => Promise<string>;

  readonly inputBox: InputBox;

  isBranchProtected: (branch?: Branch) => boolean;
  readonly isUsingVirtualFileSystem: boolean;

  readonly kind: RepositoryKind;
  log: (options?: LogOptions) => Promise<Commit[]>;

  merge: (reference: string) => Promise<void>;
  mergeAbort: () => Promise<void>;
  migrateChanges: (
    sourceRepoPath: string,
    options?: {confirmation?: boolean; deleteFromSource?: boolean; untracked?: boolean}
  ) => Promise<void>;

  readonly onDidCheckout: Event<void>;
  readonly onDidCommit: Event<void>;
  popStash: (index?: number) => Promise<void>;
  pull: (unshallow?: boolean) => Promise<void>;

  push: (remoteName?: string, branchName?: string, setUpstream?: boolean, force?: ForcePushMode) => Promise<void>;
  rebase: (branch: string) => Promise<void>;

  removeRemote: (name: string) => Promise<void>;
  renameRemote: (name: string, newName: string) => Promise<void>;
  restore: (paths: string[], options?: {ref?: string; staged?: boolean}) => Promise<void>;
  revert: (paths: string[]) => Promise<void>;

  readonly rootUri: Uri;
  setBranchUpstream: (name: string, upstream: string) => Promise<void>;
  setConfig: (key: string, value: string) => Promise<string>;
  show: (reference: string, path: string) => Promise<string>;

  readonly state: RepositoryState;
  status: () => Promise<void>;

  tag: (name: string, message: string, reference?: string) => Promise<void>;

  readonly ui: RepositoryUIState;

  unsetConfig: (key: string) => Promise<string>;
}

export interface RepositoryAccessDetails {
  readonly lastAccessTime: number;
  readonly rootUri: Uri;
}

export type RepositoryKind = "repository" | "submodule" | "worktree";

export interface RepositoryState {
  readonly HEAD: Branch | undefined;
  readonly indexChanges: Change[];
  readonly mergeChanges: Change[];
  readonly onDidChange: Event<void>;
  readonly rebaseCommit: Commit | undefined;
  readonly refs: Ref[];

  readonly remotes: Remote[];
  readonly submodules: Submodule[];
  readonly untrackedChanges: Change[];
  readonly workingTreeChanges: Change[];

  readonly worktrees: Worktree[];
}

export interface RepositoryUIState {
  readonly onDidChange: Event<void>;
  readonly selected: boolean;
}

export interface SourceControlHistoryItemDetailsProvider {
  provideAvatar: (repo: Repository, query: AvatarQuery) => ProviderResult<Map<string, string | undefined>>;
  provideHoverCommands: (repo: Repository) => ProviderResult<Command[]>;
  provideMessageLinks: (repo: Repository, message: string) => ProviderResult<string>;
}

export interface Submodule {
  readonly name: string;
  readonly path: string;
  readonly url: string;
}

export interface UpstreamRef {
  readonly commit?: string;
  readonly name: string;
  readonly remote: string;
}

export interface Worktree {
  readonly detached: boolean;
  readonly main: boolean;
  readonly name: string;
  readonly path: string;
  readonly ref: string;
}
