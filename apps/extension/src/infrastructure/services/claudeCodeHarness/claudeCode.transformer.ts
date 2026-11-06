import {StatusValueObjectSchema} from "@valueObjects/status.valueObject.ts";
import {Schema} from "effect";

// Claude Code's file formats, read into ours.

// The hooks write one word per status file; any other text is no status.
export const decodeStatusFileText = Schema.decodeUnknownResult(StatusValueObjectSchema);
