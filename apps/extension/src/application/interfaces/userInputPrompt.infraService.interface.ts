import {Context, Schema} from "effect";

import type {AgentListItemDto} from "@dtos/agent.dto.ts";
import type {ProjectListItemDto} from "@dtos/project.dto.ts";
import type {AgentIdValueObject} from "@valueObjects/agentId.valueObject.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {Effect} from "effect";

// What the user did in the agent picker: picked an agent to start, or asked for one to become the default.
export type AgentPick =
  | {readonly _tag: "AgentPicked"; readonly agentId: AgentIdValueObject}
  | {readonly _tag: "DefaultAgentChosen"; readonly agentId: AgentIdValueObject};

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

// What the extension asks the user mid-task: a name, a project, folders, a confirmation, or an offer to act.
export class IUserInputPromptInfraService extends Context.Service<
  IUserInputPromptInfraService,
  {
    // A one-line input box filled with `value`; resolves with what the user enters.
    readonly askForText: (question: string, value: string) => Effect.Effect<string, InputCancelledError>;
    // A modal warning; true when the user picks `confirmAction`.
    readonly confirm: (message: string, confirmAction: string) => Effect.Effect<boolean>;
    // Lists the agents with the default first and selected; each other one offers to become the default.
    readonly pickAgent: (
      agentListItems: readonly AgentListItemDto[],
      placeHolder: string
    ) => Effect.Effect<AgentPick, AgentPickCancelledError>;
    readonly pickProject: (
      projects: readonly ProjectListItemDto[],
      placeHolder: string
    ) => Effect.Effect<ProjectListItemDto, ProjectPickCancelledError>;
    readonly pickProjectFolderPaths: Effect.Effect<readonly ProjectPathValueObject[], FolderPickCancelledError>;
    // Resolves with the action the user picked, or undefined when they dismiss the message.
    readonly showErrorMessage: (message: string, ...actions: string[]) => Effect.Effect<string | undefined>;
    // Resolves with the action the user picked, or undefined when they dismiss the message.
    readonly showInformationMessage: (message: string, ...actions: string[]) => Effect.Effect<string | undefined>;
  }
>()("aggregor-app/application/interfaces/userInputPrompt.infraService.interface/IUserInputPromptInfraService") {}
