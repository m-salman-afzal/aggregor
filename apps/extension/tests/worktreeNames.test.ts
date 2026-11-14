import {
  getTitledBranchName,
  getWorktreeName,
  hasWorktreeBranchFirstName
} from "@domainServices/worktree.domainService.ts";
import {Effect} from "effect";
import {describe, expect, it} from "vitest";

describe("worktree names", () => {
  it("names a worktree after its session", () => {
    expect(Effect.runSync(getWorktreeName("jsTester #3"))).toBe("jstester-3");
  });

  it("keeps a short title whole", () => {
    expect(Effect.runSync(getTitledBranchName("Fix the login redirect!"))).toBe("aggregor/fix-the-login-redirect");
  });

  it("cuts a long title at a word within 50 characters", () => {
    const branchName = Effect.runSync(
      getTitledBranchName("Move every session list read into one use case and drop the node ids")
    );

    expect(branchName).toBe("aggregor/move-every-session-list-read-into-one-use-case");
    expect(branchName.length - "aggregor/".length).toBeLessThanOrEqual(50);
  });

  it("knows a branch still named after its worktree's folder", () => {
    expect(Effect.runSync(hasWorktreeBranchFirstName("aggregor/jstester-8", "jstester-8"))).toBe(true);
    expect(Effect.runSync(hasWorktreeBranchFirstName("aggregor/login-fix", "jstester-8"))).toBe(false);
  });
});
