export interface FileSlice {
  readonly byteCount: number;
  readonly filePath: string;
  readonly position: bigint;
}
