import {IHarnessInfraService} from "@interfaces/harness.infraService.interface.ts";
import {HARNESS_ICONS} from "@pkg/constants/src/harness.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {Effect, Layer} from "effect";

import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {LaunchPlan} from "@interfaces/harness.infraService.interface.ts";

// Claude's terminal reads "Claude Code" until the conversation has a title, and "claude · resume" in its resume picker.
const PLACEHOLDER_TITLES: ReadonlySet<string> = new Set(["claude · resume", "Claude Code"]);

// Claude keeps a transcript once a turn has started, so a session that has worked resumes it.
const prepareLaunchPlan = Effect.fn("ClaudeCodeHarnessInfraService.prepareLaunchPlan")(function* (
  session: SessionEntity
) {
  const launchPlan: LaunchPlan = {
    command: "claude",
    commandArguments: session.hasWorked ? ["--resume", session.id] : ["--session-id", session.id]
  };

  return launchPlan;
});

const makeClaudeCodeHarnessInfraService = Effect.fn("ClaudeCodeHarnessInfraService.make")(function* () {
  const {extensionUri, Uri} = yield* VsCodeApi;

  return {
    iconPath: Uri.joinPath(extensionUri, HARNESS_ICONS.CLAUDE_CODE).fsPath,
    placeholderTitles: PLACEHOLDER_TITLES,
    prepareLaunchPlan
  };
});

// Claude Code's launch command until harnesses come from settings.
export const ClaudeCodeHarnessInfraService = Layer.effect(IHarnessInfraService, makeClaudeCodeHarnessInfraService());
