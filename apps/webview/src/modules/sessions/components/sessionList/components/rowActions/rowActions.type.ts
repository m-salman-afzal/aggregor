import type {RowAction, UserInput} from "@/modules/sessions/sessions.type.ts";
import type {AgentRowData, ProjectRowData, RowCommandArgument} from "@views/sessions/sessions.view.type.ts";

export type AskingAction = (
  askingContext: AskingContext,
  rowAction: RowAction,
  commandArgument: RowCommandArgument
) => void;

export interface AskingContext {
  readonly agentRows: readonly AgentRowData[];
  readonly archiveProjectRows: readonly ProjectRowData[];
  readonly projectRows: readonly ProjectRowData[];
  readonly showUserInput: (userInput: UserInput) => void;
  readonly skipAgentPicker: boolean;
}

export interface MenuGroup {
  readonly groupKey: string;
  readonly rowActions: readonly RowAction[];
  readonly sharedRowLabel: string | undefined;
}
