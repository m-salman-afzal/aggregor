import {StatusValueObjectSchema} from "@valueObjects/status.valueObject.ts";
import {Result, Schema, String} from "effect";

import type {Titles} from "@infraServices/claudeCodeHarness/claudeCodeHarness.infraService.type.ts";

// Claude Code's file formats, read into ours.

export class TitleNotFoundError extends Schema.TaggedError<TitleNotFoundError, {readonly brand: unique symbol}>()(
  "TitleNotFoundError",
  {}
) {}

// Claude appends one of these every time it (re)names a conversation. The format is undocumented, so anything that
// stops matching just leaves the session with our own name.
const TitleEntry = Schema.Union([
  Schema.Struct({aiTitle: Schema.String, type: Schema.Literal("ai-title")}),
  Schema.Struct({customTitle: Schema.String, type: Schema.Literal("custom-title")})
]);

const decodeTitleEntry = Schema.decodeUnknownResult(Schema.fromJsonString(TitleEntry));

export const NO_TITLES: Titles = {
  aiTitle: Result.fail(TitleNotFoundError.make()),
  customTitle: Result.fail(TitleNotFoundError.make())
};

// One transcript line; most are not titles, so those skip the JSON parse.
export const decodeTitleLine = (transcriptLine: string): Result.Result<typeof TitleEntry.Type, unknown> =>
  String.includes('-title"')(transcriptLine) ? decodeTitleEntry(transcriptLine) : Result.failVoid;

export const addTitleEntry = (currentTitles: Titles, titleEntry: typeof TitleEntry.Type): Titles =>
  titleEntry.type === "ai-title"
    ? {...currentTitles, aiTitle: Result.succeed(titleEntry.aiTitle)}
    : {...currentTitles, customTitle: Result.succeed(titleEntry.customTitle)};

// A custom title (/rename) beats Claude's own; within each kind the latest wins.
export const getPreferredTitle = (titles: Titles) => Result.orElse(titles.customTitle, () => titles.aiTitle);

// The hooks write one word per status file; any other text is no status.
export const decodeStatusFileText = Schema.decodeUnknownResult(StatusValueObjectSchema);
