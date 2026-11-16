import type {UserInputOption} from "@/modules/sessions/sessions.type.ts";
import type {ProjectBranchesDto} from "@dtos/worktree.dto.ts";
import type {AgentRowData, ProjectRowData} from "@views/sessions/sessions.view.type.ts";

export interface NewSessionChoices {
  readonly agentId: string;
  readonly baseBranchName: string;
  readonly projectPath: string;
  readonly workingTree: string;
}

export interface NewSessionOptionGroup {
  readonly chosenOptionId: string;
  readonly isDropdown: boolean;
  readonly legend: string;
  readonly name: string;
  readonly onChoose: (optionId: string) => void;
  readonly onSecondaryAction?: (optionId: string) => void;
  readonly options: readonly UserInputOption[];
}

export interface NewSessionOptionSources {
  readonly agentRows: readonly AgentRowData[];
  readonly allProjectRows: readonly ProjectRowData[];
  readonly branches: ProjectBranchesDto | undefined;
  readonly choices: NewSessionChoices;
  readonly choose: (chosenParts: Partial<NewSessionChoices>) => void;
  readonly isAgentShown: boolean;
  readonly isProjectShown: boolean;
  readonly projectRows: readonly ProjectRowData[];
}

export type NewSessionRequestChoices = Pick<NewSessionChoices, "baseBranchName" | "projectPath" | "workingTree">;
