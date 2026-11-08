import {IHarnessInfraService} from "@interfaces/harness.infraService.interface.ts";
import {MODEL_ICONS} from "@pkg/constants/src/extension.constant.ts";
import {VsCodeApi} from "@vscodeApi/vscode.api.ts";
import {Effect, Layer} from "effect";

import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {LaunchPlanValueObject} from "@valueObjects/launchPlan.valueObject.ts";

// Claude's terminal reads "Claude Code" until the conversation has a title, and "claude · resume" in its resume picker.
const PLACEHOLDER_TITLES: ReadonlySet<string> = new Set(["claude · resume", "Claude Code"]);

// Claude keeps a transcript once a turn has started, so a session that has worked resumes it.
const prepareLaunch = Effect.fn("ClaudeCodeHarnessInfraService.prepareLaunch")(function* (session: SessionEntity) {
  const launchPlan: LaunchPlanValueObject = {
    command: "claude",
    commandArguments: session.hasWorked ? ["--resume", session.id] : ["--session-id", session.id]
  };

  return launchPlan;
});

const makeClaudeCodeHarnessInfraService = Effect.fn("ClaudeCodeHarnessInfraService.make")(function* () {
  const {extensionUri, Uri} = yield* VsCodeApi;

  return {
    iconPath: Uri.joinPath(extensionUri, MODEL_ICONS.CLAUDE).fsPath,
    placeholderTitles: PLACEHOLDER_TITLES,
    prepareLaunch
  };
});

// Claude Code's launch command until harnesses come from settings.
export const ClaudeCodeHarnessInfraService = Layer.effect(IHarnessInfraService, makeClaudeCodeHarnessInfraService());
