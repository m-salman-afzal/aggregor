import type {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {Ref, SubscriptionRef} from "effect";
import type {Terminal} from "vscode";

export type SessionTerminalsReference = SubscriptionRef.SubscriptionRef<ReadonlyMap<EntityIdValueObject, Terminal>>;

export type TerminalDependencies = {
  readonly sessionTerminals: SessionTerminalsReference;
  // The terminal last in front that is no session's tab: the Terminal panel's, since session tabs sit in the editor.
  readonly shellTerminal: Ref.Ref<Terminal | undefined>;
} & Pick<VsCodeApi["Service"], "commands" | "extensionUri" | "TabInputTerminal" | "Uri" | "ViewColumn" | "window">;
