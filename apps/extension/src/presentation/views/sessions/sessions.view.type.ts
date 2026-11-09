import type {SessionEntity} from "@entities/session/session.entity.ts";
import type {ListedProjectValueObject} from "@valueObjects/listedProject.valueObject.ts";
import type {StatusValueObject} from "@valueObjects/status.valueObject.ts";

// Projects at the top level, each with the sessions started in it.
export type Row = ListedProjectValueObject | SessionEntity;

// What a row shows. "unread" is an idle session whose last turn ended while it was out of view; undefined is a
// terminal whose hooks have not fired yet.
export type RowStatus = "unread" | StatusValueObject;
