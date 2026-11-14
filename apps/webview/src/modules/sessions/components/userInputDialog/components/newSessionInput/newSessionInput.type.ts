import type {UserInputOption} from "@/modules/sessions/sessions.type.ts";
import type {AgentRowData, ProjectRowData} from "@views/sessions/sessions.view.type.ts";

export interface NewSessionChoices {
  readonly agentId: string;
  readonly projectPath: string;
  readonly workingTree: string;
}

export interface NewSessionOptionGroup {
  readonly chosenOptionId: string;
  readonly legend: string;
  readonly name: string;
  readonly onChoose: (optionId: string) => void;
  readonly onSecondaryAction?: (optionId: string) => void;
  readonly options: readonly UserInputOption[];
}

export interface NewSessionOptionSources {
  readonly agentRows: readonly AgentRowData[];
  readonly allProjectRows: readonly ProjectRowData[];
  readonly choices: NewSessionChoices;
  readonly choose: (chosenParts: Partial<NewSessionChoices>) => void;
  readonly isAgentShown: boolean;
  readonly isProjectShown: boolean;
  readonly projectRows: readonly ProjectRowData[];
}
