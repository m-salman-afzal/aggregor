import {PROMPT_ICONS} from "@/modules/sessions/components/promptDialog/promptDialog.constant.ts";
import {PROMPT_TAGS} from "@pkg/constants/src/sessionsView.constant.ts";

import type {WebviewPrompt} from "@views/sessions/sessions.view.type.ts";

export const isDestructivePrompt = (prompt: WebviewPrompt) =>
  prompt._tag === PROMPT_TAGS.QUESTION && prompt.answers.some((answer) => answer.isDestructive);

export const pickPromptIcon = (prompt: WebviewPrompt) => {
  if (prompt._tag === PROMPT_TAGS.CHOICE) return PROMPT_ICONS.CHOICE;
  if (prompt._tag === PROMPT_TAGS.TEXT) return PROMPT_ICONS.TEXT;

  return isDestructivePrompt(prompt) ? PROMPT_ICONS.DESTRUCTIVE_QUESTION : PROMPT_ICONS.QUESTION;
};
