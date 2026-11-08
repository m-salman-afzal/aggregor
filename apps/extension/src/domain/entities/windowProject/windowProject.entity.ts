import {BaseEntity} from "@entities/base/base.entity.ts";
import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";

export class WindowProjectEntity extends BaseEntity.extend<WindowProjectEntity>("WindowProject")({
  projectId: EntityIdValueObjectSchema,
  projectPath: ProjectPathValueObjectSchema,
  windowId: EntityIdValueObjectSchema
}) {}
