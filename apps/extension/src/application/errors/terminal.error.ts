// eslint-disable-next-line max-classes-per-file
import {Data} from "effect";

import type {SessionId} from "@/domain/value-objects/session-id.value-object.ts";

export class NoActiveTerminal extends Data.TaggedError("NoActiveTerminal") {}
export class NotATerminalTab extends Data.TaggedError("NotATerminalTab") {}
export class TerminalLaunchFailed extends Data.TaggedError("TerminalLaunchFailed")<{readonly cause: unknown}> {}
export class TerminalNotFound extends Data.TaggedError("TerminalNotFound")<{readonly sessionId: SessionId}> {}
export class UntrackedTerminal extends Data.TaggedError("UntrackedTerminal") {}
export class WindowUnfocused extends Data.TaggedError("WindowUnfocused") {}
