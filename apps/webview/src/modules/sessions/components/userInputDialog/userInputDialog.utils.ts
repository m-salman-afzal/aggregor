import {USER_INPUT_ICONS} from "@/modules/sessions/components/userInputDialog/userInputDialog.constant.ts";
import {USER_INPUT_TAGS} from "@/modules/sessions/sessions.constant.ts";

import type {UserInput} from "@/modules/sessions/sessions.type.ts";

export const isDestructiveUserInput = (userInput: UserInput) =>
  userInput._tag === USER_INPUT_TAGS.QUESTION && userInput.answers.some((answer) => answer.isDestructive);

export const pickUserInputIcon = (userInput: UserInput) => {
  if (userInput._tag === USER_INPUT_TAGS.CHOICE) return USER_INPUT_ICONS.CHOICE;
  if (userInput._tag === USER_INPUT_TAGS.TEXT) return USER_INPUT_ICONS.TEXT;

  return isDestructiveUserInput(userInput) ? USER_INPUT_ICONS.DESTRUCTIVE_QUESTION : USER_INPUT_ICONS.QUESTION;
};
