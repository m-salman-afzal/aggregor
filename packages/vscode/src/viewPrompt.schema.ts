import {PROMPT_ACTION_ICONS, PROMPT_ANSWER_TAGS, PROMPT_TAGS} from "@pkg/constants/src/sessionsView.constant.ts";
import {Schema} from "effect";

export const ViewPromptChoiceSchema = Schema.Struct({
  badge: Schema.optional(Schema.String),
  choiceId: Schema.String,
  description: Schema.optional(Schema.String),
  detail: Schema.optional(Schema.String),
  iconPath: Schema.optional(Schema.String),
  label: Schema.String,
  secondaryActionIcon: Schema.optional(Schema.Literals([PROMPT_ACTION_ICONS.STAR])),
  secondaryActionLabel: Schema.optional(Schema.String)
});

const ViewPromptQuestionAnswerSchema = Schema.Struct({
  answerId: Schema.String,
  consequence: Schema.String,
  isDestructive: Schema.Boolean,
  label: Schema.String
});

export const ViewPromptSchema = Schema.TaggedUnion({
  [PROMPT_TAGS.CHOICE]: {choices: Schema.Array(ViewPromptChoiceSchema), title: Schema.String},
  [PROMPT_TAGS.QUESTION]: {answers: Schema.Array(ViewPromptQuestionAnswerSchema), title: Schema.String},
  [PROMPT_TAGS.TEXT]: {title: Schema.String, value: Schema.String}
});

export const ViewPromptAnswerSchema = Schema.TaggedUnion({
  [PROMPT_ANSWER_TAGS.CANCELLED]: {},
  // A choice's id, or a question's answer's.
  [PROMPT_ANSWER_TAGS.CHOSEN]: {choiceId: Schema.String, isSecondaryAction: Schema.Boolean},
  [PROMPT_ANSWER_TAGS.TEXT_ENTERED]: {text: Schema.String}
});
