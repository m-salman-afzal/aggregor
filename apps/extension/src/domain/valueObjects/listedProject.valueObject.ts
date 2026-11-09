import {ProjectPathValueObjectSchema} from "@valueObjects/projectPath.valueObject.ts";
import {Schema} from "effect";

// A workspace folder is listed before its project has a row, so a tree row can't be the stored ProjectEntity.
export class ListedProjectValueObject extends Schema.Class<ListedProjectValueObject, {readonly brand: unique symbol}>(
  "ListedProject"
)({
  added: Schema.Boolean,
  name: Schema.String,
  path: ProjectPathValueObjectSchema
}) {}
