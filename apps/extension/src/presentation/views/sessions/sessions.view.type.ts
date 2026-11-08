import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {ListedProjectValueObject} from "@valueObjects/listedProject.valueObject.ts";

// Projects at the top level, each with the sessions started in it.
export type Row = ListedProjectValueObject | SessionEntity;

// What a row shows. "done" is a finished turn the user has not seen yet; once seen, the session shows idle.
export type RowStatus = "blocked" | "done" | "error" | "exited" | "idle" | "working";
