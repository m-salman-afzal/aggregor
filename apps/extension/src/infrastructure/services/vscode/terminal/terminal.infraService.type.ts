import type {SessionIdValueObject} from "@valueObjects/sessionId.valueObject.ts";
import type {VsCodeApi} from "@vscodeApi/vscode.api.ts";
import type {SubscriptionRef} from "effect";
import type {Terminal} from "vscode";

// Each session's terminal in this window, keyed by session id.
export type SessionTerminalsReference = SubscriptionRef.SubscriptionRef<ReadonlyMap<SessionIdValueObject, Terminal>>;

// What the terminal functions share: the window's session terminals and VS Code's window.
export type TerminalDependencies = {
  readonly sessionTerminals: SessionTerminalsReference;
} & Pick<VsCodeApi["Service"], "commands" | "TabInputTerminal" | "Uri" | "ViewColumn" | "window">;
