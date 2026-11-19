import type {FileSystem} from "effect/FileSystem";
import type {ChildProcessSpawner} from "effect/process/ChildProcessSpawner";

export interface ProcessDependencies {
  readonly childProcessSpawner: ChildProcessSpawner["Service"];
  readonly fileSystem: FileSystem;
}
