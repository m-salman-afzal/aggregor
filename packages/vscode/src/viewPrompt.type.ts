import type {
  ViewPromptAnswerSchema,
  ViewPromptChoiceSchema,
  ViewPromptSchema
} from "@pkg/vscode/src/viewPrompt.schema.ts";

export type ViewPrompt = typeof ViewPromptSchema.Type;

export type ViewPromptAnswer = typeof ViewPromptAnswerSchema.Type;

export type ViewPromptChoice = typeof ViewPromptChoiceSchema.Type;
