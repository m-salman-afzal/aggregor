import type {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {SubscriptionRef} from "effect";
import type {Terminal} from "vscode";

export type SessionTerminalsReference = SubscriptionRef.SubscriptionRef<ReadonlyMap<EntityIdValueObject, Terminal>>;

export type TerminalDependencies = {
  readonly aggregorFolderPath: string;
  readonly sessionTerminals: SessionTerminalsReference;
  // The folder whose shell the window's Aggregor terminal shows, as tmux last said; no terminal API reports it.
  readonly shownFolderShellPath: SubscriptionRef.SubscriptionRef<ProjectPathValueObject | undefined>;
} & Pick<
  VsCodeApi["Service"],
  "commands" | "extensionUri" | "TabInputTerminal" | "TerminalExitReason" | "Uri" | "ViewColumn" | "window"
>;
