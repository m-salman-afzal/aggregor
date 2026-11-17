import type {ChecklistRowData} from "@/modules/sessions/components/userInputDialog/components/checklistSection/checklistSection.type.ts";

export interface AgentChecklistGroup {
  readonly agentName: string;
  readonly checklistRows: readonly ChecklistRowData[];
}
