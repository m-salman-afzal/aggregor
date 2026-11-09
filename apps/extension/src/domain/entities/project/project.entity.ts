import {BaseEntity} from "@entities/base/base.entity.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {Schema} from "effect";

// `isAdded`: listed in the Sessions view. A workspace folder's project gets a row with its first session without being
// added, so it stays one of the window's own folders.
export class ProjectEntity extends BaseEntity.extend<ProjectEntity>("Project")({
  isAdded: Schema.Boolean,
  path: ProjectPathValueObjectSchema
}) {}
