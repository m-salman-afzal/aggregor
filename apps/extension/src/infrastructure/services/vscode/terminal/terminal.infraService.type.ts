import type {PtyBinaryNotFoundError} from "@interfaces/terminal.infraService.interface.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {VsCodeApi} from "@vscodeApi/vscode.api.ts";
import type {Result, SubscriptionRef} from "effect";
import type {Terminal} from "vscode";

// Each session's terminal in this window, keyed by session id.
export type SessionTerminalsReference = SubscriptionRef.SubscriptionRef<ReadonlyMap<EntityIdValueObject, Terminal>>;

// What the terminal functions share: the window's session terminals, VS Code's window, and what a session's agent runs
// under: aggregor-pty, when this build has it, and the database it writes to.
export type TerminalDependencies = {
  readonly databaseFilePath: string;
  readonly ptyBinaryPath: Result.Result<string, PtyBinaryNotFoundError>;
  readonly sessionTerminals: SessionTerminalsReference;
} & Pick<VsCodeApi["Service"], "commands" | "TabInputTerminal" | "Uri" | "ViewColumn" | "window">;
