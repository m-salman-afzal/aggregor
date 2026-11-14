import {BaseEntity} from "@entities/base/base.entity.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {ProjectSettingsValueObjectSchema} from "@valueObjects/projectSettings.valueObject.ts";
import {Schema} from "effect";

// A workspace folder's project gets a row with its first session without being added, so it stays the window's own.
export class ProjectEntity extends BaseEntity.extend<ProjectEntity>("Project")({
  isAdded: Schema.Boolean,
  path: ProjectPathValueObjectSchema,
  settings: Schema.fromJsonString(ProjectSettingsValueObjectSchema)
}) {}
