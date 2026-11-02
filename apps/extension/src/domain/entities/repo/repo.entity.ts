import {RepoPathSchema} from "@/domain/value-objects/repo-path.value-object.ts";
import {Schema} from "effect";

// A top-level row of the Sessions tree. A workspace folder is always listed and `added` is false; one added with Add
// Repo is `added` and can be removed again.
export class Repo extends Schema.Class<Repo, {readonly brand: unique symbol}>("Repo")({
  added: Schema.Boolean,
  name: Schema.String,
  path: RepoPathSchema
}) {}
