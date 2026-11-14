import {
  PROJECT_SETTINGS_FIELDS,
  SESSION_WORKING_TREES,
  USER_INPUT_ICONS
} from "@/modules/sessions/components/userInputDialog/userInputDialog.constant.ts";
import {SESSIONS_LABELS, USER_INPUT_TAGS} from "@/modules/sessions/sessions.constant.ts";

import type {UserInput} from "@/modules/sessions/sessions.type.ts";
import type {ProjectSettingsDto} from "@dtos/project.dto.ts";
import type {SubmitEvent} from "react";

export const isDestructiveUserInput = (userInput: UserInput) =>
  userInput._tag === USER_INPUT_TAGS.QUESTION && userInput.answers.some((answer) => answer.isDestructive);

export const pickUserInputIcon = (userInput: UserInput) => {
  if (userInput._tag === USER_INPUT_TAGS.NEW_SESSION) return USER_INPUT_ICONS.NEW_SESSION;
  if (userInput._tag === USER_INPUT_TAGS.TEXT) return USER_INPUT_ICONS.TEXT;
  if (userInput._tag === USER_INPUT_TAGS.PROJECT_SETTINGS) return USER_INPUT_ICONS.PROJECT_SETTINGS;

  return isDestructiveUserInput(userInput) ? USER_INPUT_ICONS.DESTRUCTIVE_QUESTION : USER_INPUT_ICONS.QUESTION;
};

// Submitting the form is taken over here, so the page doesn't reload.
export const takeProjectSettings = (formEvent: SubmitEvent<HTMLFormElement>): ProjectSettingsDto => {
  formEvent.preventDefault();
  const formData = new FormData(formEvent.currentTarget);
  const readText = (fieldName: string) => {
    const fieldValue = formData.get(fieldName);

    return typeof fieldValue === "string" ? fieldValue.trim() : "";
  };

  return {
    filesToCopy: readText(PROJECT_SETTINGS_FIELDS.FILES_TO_COPY)
      .split(",")
      .map((pattern) => pattern.trim())
      .filter((pattern) => pattern !== ""),
    newSessionWorkingTree:
      readText(PROJECT_SETTINGS_FIELDS.NEW_SESSION_WORKING_TREE) === SESSION_WORKING_TREES.WORKTREE
        ? SESSION_WORKING_TREES.WORKTREE
        : SESSION_WORKING_TREES.PROJECT_ROOT,
    setupScript: readText(PROJECT_SETTINGS_FIELDS.SETUP_SCRIPT),
    worktreeFolder: readText(PROJECT_SETTINGS_FIELDS.WORKTREE_FOLDER)
  };
};

export const takeEnteredText = (formEvent: SubmitEvent<HTMLFormElement>) => {
  formEvent.preventDefault();
  const enteredText = new FormData(formEvent.currentTarget).get(SESSIONS_LABELS.USER_INPUT_TEXT_FIELD);

  return typeof enteredText === "string" ? enteredText : "";
};

export const describeUserInput = (userInput: undefined | UserInput) => ({
  isDestructive: userInput !== undefined && isDestructiveUserInput(userInput),
  UserInputIcon: userInput === undefined ? undefined : pickUserInputIcon(userInput)
});
