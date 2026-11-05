import {ProjectPathSchema} from "@/domain/value-objects/project-path.value-object.ts";
import {Schema} from "effect";

// A top-level row of the Sessions tree. A workspace folder is always listed and `added` is false; one added with Add
// Project is `added` and can be removed again.
export class Project extends Schema.Class<Project, {readonly brand: unique symbol}>("Project")({
  added: Schema.Boolean,
  name: Schema.String,
  path: ProjectPathSchema
}) {}
