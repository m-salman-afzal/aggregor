import type {ProjectPathValueObject} from "@/domain/valueObjects/projectPath.valueObject.ts";

export interface CommitMessageRequest {
  readonly commitCommand: string;
  readonly projectPath: ProjectPathValueObject;
  readonly stagedDiff: string;
}
