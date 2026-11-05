import {SessionTitleNotFoundError} from "@interfaces/harness.infraService.interface.ts";
import {StatusValueObjectSchema} from "@valueObjects/status.valueObject.ts";
import {Effect, Schema, String} from "effect";

// Claude Code's file formats, read into ours.

// Claude Code's terminal title: a status glyph (✳ idle, ◐ or ◑ busy), a space and the session's title. Before the
// conversation has a title it reads "Claude Code", its resume picker shows "claude · resume", the process name "claude"
// comes first, and it is empty once Claude exits.
const STATUS_GLYPH_PREFIX = /^[✳◐◑]\s+/u;
const PLACEHOLDER_TITLES: ReadonlySet<string> = new Set(["", "claude", "claude · resume", "Claude Code"]);

export const decodeTerminalTitle = Effect.fn("ClaudeCodeHarnessInfraService.decodeTerminalTitle")(function* (
  terminalTitle: string
) {
  const sessionTitle = String.trim(String.replace(STATUS_GLYPH_PREFIX, "")(terminalTitle));
  if (PLACEHOLDER_TITLES.has(sessionTitle)) return yield* SessionTitleNotFoundError.make();

  return sessionTitle;
});

// The hooks write one word per status file; any other text is no status.
export const decodeStatusFileText = Schema.decodeUnknownResult(StatusValueObjectSchema);
