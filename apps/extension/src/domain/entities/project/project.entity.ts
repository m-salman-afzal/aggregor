import {BaseEntity} from "@entities/base/base.entity.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {ProjectSettingsValueObjectSchema} from "@valueObjects/projectSettings.valueObject.ts";
import {Schema} from "effect";

export class ProjectEntity extends BaseEntity.extend<ProjectEntity>("Project")({
  isAdded: Schema.Boolean,
  path: ProjectPathValueObjectSchema,
  settings: Schema.fromJsonString(ProjectSettingsValueObjectSchema)
}) {}
