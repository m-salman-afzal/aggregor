import type {FileSystem} from "effect/FileSystem";
import type {Path} from "effect/Path";

export interface AgentHistoryDependencies {
  readonly fileSystem: FileSystem;
  readonly homeFolderPath: string;
  readonly path: Path;
}

export interface FileSlice {
  readonly byteCount: number;
  readonly filePath: string;
  readonly position: bigint;
}
