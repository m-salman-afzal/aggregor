import {
  MoveProjectDownRequestDtoSchema,
  MoveProjectUpRequestDtoSchema,
  NewProjectTerminalRequestDtoSchema,
  RemoveProjectRequestDtoSchema
} from "@dtos/project.dto.ts";
import {decodeVsCodeArgument} from "@pkg/vscode/src/vsCodeArgument.utils.ts";
import {
  addProject,
  moveProjectDown,
  moveProjectUp,
  newProjectTerminal,
  removeProject
} from "@services/project.service.ts";
import {Effect} from "effect";

export const addProjectsAskingForFolders = Effect.fn("ProjectController.addProjectsAskingForFolders")(function* () {
  yield* addProject();
});

export const removeChosenProject = Effect.fn("ProjectController.removeChosenProject")(function* (
  chosenProject: unknown
) {
  const request = yield* decodeVsCodeArgument(RemoveProjectRequestDtoSchema, chosenProject);
  yield* removeProject(request);
});

export const moveChosenProjectUp = Effect.fn("ProjectController.moveChosenProjectUp")(function* (
  chosenProject: unknown
) {
  const request = yield* decodeVsCodeArgument(MoveProjectUpRequestDtoSchema, chosenProject);
  yield* moveProjectUp(request);
});

export const moveChosenProjectDown = Effect.fn("ProjectController.moveChosenProjectDown")(function* (
  chosenProject: unknown
) {
  const request = yield* decodeVsCodeArgument(MoveProjectDownRequestDtoSchema, chosenProject);
  yield* moveProjectDown(request);
});

export const newTerminalInChosenProject = Effect.fn("ProjectController.newTerminalInChosenProject")(function* (
  chosenProject: unknown
) {
  const request = yield* decodeVsCodeArgument(NewProjectTerminalRequestDtoSchema, chosenProject);
  yield* newProjectTerminal(request);
});
