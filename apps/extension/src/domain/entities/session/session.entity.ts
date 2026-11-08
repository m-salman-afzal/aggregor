import {BaseEntity} from "@entities/base/base.entity.ts";
import {EntityIdValueObjectSchema} from "@valueObjects/entityId.valueObject.ts";
import {HarnessIdValueObjectSchema} from "@valueObjects/harnessId.valueObject.ts";
import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {Schema} from "effect";

export class SessionEntity extends BaseEntity.extend<SessionEntity>("Session")({
  customName: Schema.optional(Schema.String),
  harnessId: HarnessIdValueObjectSchema,
  name: Schema.String,
  projectId: EntityIdValueObjectSchema,
  projectPath: ProjectPathValueObjectSchema
}) {
  public get displayName(): string {
    return this.customName === undefined ? this.name : this.customName;
  }
}
