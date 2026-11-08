import {BaseEntity} from "@entities/base/base.entity.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";

export class ProjectEntity extends BaseEntity.extend<ProjectEntity>("Project")({
  path: ProjectPathValueObjectSchema
}) {}
