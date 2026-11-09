import {Context, Schema} from "effect";

import type {HarnessListItemDto} from "@dtos/harness.dto.ts";
import type {ProjectListItemDto} from "@dtos/project.dto.ts";
import type {HarnessIdValueObject} from "@valueObjects/harnessId.valueObject.ts";
import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";
import type {Effect} from "effect";

// What the user did in the harness picker: picked a harness to start, or asked for one to become the default.
export type HarnessPick =
  | {readonly _tag: "DefaultHarnessChosen"; readonly harnessId: HarnessIdValueObject}
  | {readonly _tag: "HarnessPicked"; readonly harnessId: HarnessIdValueObject};

export class FolderPickCancelledError extends Schema.TaggedError<
  FolderPickCancelledError,
  {readonly brand: unique symbol}
>()("FolderPickCancelledError", {}) {}
export class HarnessPickCancelledError extends Schema.TaggedError<
  HarnessPickCancelledError,
  {readonly brand: unique symbol}
>()("HarnessPickCancelledError", {}) {}
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
    // Lists the harnesses with the default first and selected; each other one offers to become the default.
    readonly pickHarness: (
      harnessListItems: readonly HarnessListItemDto[],
      placeHolder: string
    ) => Effect.Effect<HarnessPick, HarnessPickCancelledError>;
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
