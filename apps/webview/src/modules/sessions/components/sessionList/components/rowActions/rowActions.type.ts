import type {RowAction} from "@/modules/sessions/sessions.type.ts";

export interface MenuGroup {
  readonly groupKey: string;
  readonly rowActions: readonly RowAction[];
  readonly sharedRowLabel: string | undefined;
}
