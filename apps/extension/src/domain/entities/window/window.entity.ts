import {BaseEntity} from "@entities/base/base.entity.ts";
import {Schema} from "effect";

export class WindowEntity extends BaseEntity.extend<WindowEntity>("Window")({
  key: Schema.String
}) {}
