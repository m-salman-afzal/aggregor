import {Context, Schema} from "effect";

import type {AgentListItemDto} from "@dtos/agent.dto.ts";
import type {ProjectListItemDto} from "@dtos/project.dto.ts";
import type {AGENT_PICK_TAGS} from "@pkg/constants/src/agent.constant.ts";
import type {AgentIdValueObject} from "@valueObjects/agentId.valueObject.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {Effect} from "effect";

export type AgentPick =
  | {readonly _tag: typeof AGENT_PICK_TAGS.AGENT_PICKED; readonly agentId: AgentIdValueObject}
  | {readonly _tag: typeof AGENT_PICK_TAGS.DEFAULT_AGENT_CHOSEN; readonly agentId: AgentIdValueObject};

export interface QuestionRequest {
  readonly answers: readonly {
    readonly consequence: string;
    readonly isDestructive: boolean;
    readonly label: string;
  }[];
  readonly question: string;
}

export class AgentPickCancelledError extends Schema.TaggedError<
  AgentPickCancelledError,
  {readonly brand: unique symbol}
>()("AgentPickCancelledError", {}) {}
export class FolderPickCancelledError extends Schema.TaggedError<
  FolderPickCancelledError,
  {readonly brand: unique symbol}
>()("FolderPickCancelledError", {}) {}
export class InputCancelledError extends Schema.TaggedError<InputCancelledError, {readonly brand: unique symbol}>()(
  "InputCancelledError",
  {}
) {}
export class ProjectPickCancelledError extends Schema.TaggedError<
  ProjectPickCancelledError,
  {readonly brand: unique symbol}
>()("ProjectPickCancelledError", {}) {}
export class QuestionCancelledError extends Schema.TaggedError<
  QuestionCancelledError,
  {readonly brand: unique symbol}
>()("QuestionCancelledError", {}) {}

export class IUserInputPromptInfraService extends Context.Service<
  IUserInputPromptInfraService,
  {
    readonly askForText: (question: string, value: string) => Effect.Effect<string, InputCancelledError>;
    readonly askQuestion: (questionRequest: QuestionRequest) => Effect.Effect<string, QuestionCancelledError>;
    readonly pickAgent: (
      agentListItems: readonly AgentListItemDto[],
      placeHolder: string
    ) => Effect.Effect<AgentPick, AgentPickCancelledError>;
    readonly pickProject: (
      projects: readonly ProjectListItemDto[],
      placeHolder: string
    ) => Effect.Effect<ProjectListItemDto, ProjectPickCancelledError>;
    readonly pickProjectFolderPaths: Effect.Effect<readonly ProjectPathValueObject[], FolderPickCancelledError>;
    readonly showErrorMessage: (message: string, ...actions: string[]) => Effect.Effect<string | undefined>;
    readonly showInformationMessage: (message: string, ...actions: string[]) => Effect.Effect<string | undefined>;
  }
>()("aggregor-app/application/interfaces/userInputPrompt.infraService.interface/IUserInputPromptInfraService") {}
