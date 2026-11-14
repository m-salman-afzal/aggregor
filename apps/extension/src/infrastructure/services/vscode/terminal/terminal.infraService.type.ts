import type {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {SubscriptionRef} from "effect";
import type {Terminal} from "vscode";

export type SessionTerminalsReference = SubscriptionRef.SubscriptionRef<ReadonlyMap<EntityIdValueObject, Terminal>>;

export type TerminalDependencies = {
  readonly sessionTerminals: SessionTerminalsReference;
} & Pick<VsCodeApi["Service"], "commands" | "TabInputTerminal" | "Uri" | "ViewColumn" | "window">;
