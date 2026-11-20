import {WorktreeDomainService} from "@domainServices/worktree.domainService.ts";
import {Effect} from "effect";
import {describe, expect, it} from "vitest";

const checkWorktreeName = Effect.fn("checkWorktreeName")(function* () {
  const worktreeDomainService = yield* WorktreeDomainService;

  expect(yield* worktreeDomainService.getWorktreeName("jsTester #3")).toBe("jstester-3");
});

const checkShortTitledBranchName = Effect.fn("checkShortTitledBranchName")(function* () {
  const worktreeDomainService = yield* WorktreeDomainService;

  expect(yield* worktreeDomainService.getTitledBranchName("Fix the login redirect!")).toBe(
    "aggregor/fix-the-login-redirect"
  );
});

const checkLongTitledBranchName = Effect.fn("checkLongTitledBranchName")(function* () {
  const worktreeDomainService = yield* WorktreeDomainService;
  const branchName = yield* worktreeDomainService.getTitledBranchName(
    "Move every session list read into one use case and drop the node ids"
  );

  expect(branchName).toBe("aggregor/move-every-session-list-read-into-one-use-case");
  expect(branchName.length - "aggregor/".length).toBeLessThanOrEqual(50);
});

const checkWorktreeBranchFirstName = Effect.fn("checkWorktreeBranchFirstName")(function* () {
  const worktreeDomainService = yield* WorktreeDomainService;

  expect(yield* worktreeDomainService.hasWorktreeBranchFirstName("aggregor/jstester-8", "jstester-8")).toBe(true);
  expect(yield* worktreeDomainService.hasWorktreeBranchFirstName("aggregor/login-fix", "jstester-8")).toBe(false);
});

describe("worktree names", () => {
  it("names a worktree after its session", () =>
    Effect.runPromise(Effect.provide(checkWorktreeName(), WorktreeDomainService.layer)));

  it("keeps a short title whole", () =>
    Effect.runPromise(Effect.provide(checkShortTitledBranchName(), WorktreeDomainService.layer)));

  it("cuts a long title at a word within 50 characters", () =>
    Effect.runPromise(Effect.provide(checkLongTitledBranchName(), WorktreeDomainService.layer)));

  it("knows a branch still named after its worktree's folder", () =>
    Effect.runPromise(Effect.provide(checkWorktreeBranchFirstName(), WorktreeDomainService.layer)));
});
