import type {LaunchPlanValueObject} from "@/domain/valueObjects/launchPlan.valueObject.ts";

// The tab is named once, when it opens: VS Code's stable API cannot rename a terminal afterwards.
export interface TerminalLaunchRequest {
  readonly iconPath: string;
  readonly launchPlan: LaunchPlanValueObject;
  readonly tabName: string;
}
