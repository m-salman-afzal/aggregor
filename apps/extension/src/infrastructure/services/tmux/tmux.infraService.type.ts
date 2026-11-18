import type {PtyBinaryNotFoundError} from "@interfaces/tmux.infraService.interface.ts";
import type {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import type {EntityIdValueObject} from "@valueObjects/entityId.valueObject.ts";
import type {Result, SubscriptionRef} from "effect";
import type {Path} from "effect/Path";
import type {ChildProcessSpawner} from "effect/process/ChildProcessSpawner";

// A terminal runs tmux in place, so its process id is its tmux client's.
export interface TmuxClient {
  readonly clientName: string;
  readonly sessionName: string;
  readonly sessionPath: string;
  readonly terminalProcessId: number;
}

export interface TmuxServer {
  readonly canRunInOwnScope: boolean;
  readonly childProcessSpawner: ChildProcessSpawner["Service"];
  readonly path: Path;
  readonly tmuxConfigPath: string;
  readonly tmuxSocketPath: string;
}

export interface TmuxDependencies extends TmuxServer {
  readonly databaseFilePath: string;
  readonly ptyBinaryPath: Result.Result<string, PtyBinaryNotFoundError>;
  readonly runningSessionIds: SubscriptionRef.SubscriptionRef<ReadonlySet<EntityIdValueObject>>;
  readonly window: VsCodeApi["Service"]["window"];
}
