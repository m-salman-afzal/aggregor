import type {ChecklistRowData} from "@/modules/sessions/components/userInputDialog/components/checklistSection/checklistSection.type.ts";

export interface ImportChecklistSection {
  readonly checklistRows: readonly ChecklistRowData[];
  readonly legend: string;
}
