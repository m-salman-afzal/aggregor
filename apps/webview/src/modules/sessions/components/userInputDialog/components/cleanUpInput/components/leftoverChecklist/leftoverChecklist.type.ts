import type {ChecklistRowData} from "@/modules/sessions/components/userInputDialog/components/checklistSection/checklistSection.type.ts";

export interface LeftoverRowData extends ChecklistRowData {
  readonly isMerged: boolean;
}
