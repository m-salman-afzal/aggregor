import {VscService} from "@/services/vsc.service.ts";
import {APP_NAME} from "@pkg/constants/src/extension.constant.ts";
import {Cause, Effect, Exit, Layer, Logger, Option, Predicate, References, Tracer} from "effect";
import {format} from "node:util";

import type {LogLevel} from "effect";
import type {LogOutputChannel} from "vscode";

// "aggregorApp.newSession > TerminalService.open": the span's name after its ancestors' names.
const formatSpanPath = (span: Tracer.AnySpan): string => {
  if (span._tag === "ExternalSpan") return "external";

  return Option.isSome(span.parent) ? `${formatSpanPath(span.parent.value)} > ${span.name}` : span.name;
};

const formatFailureReason = (reason: Cause.Reason<unknown>) => {
  if (reason._tag === "Die") return "defect";
  if (reason._tag === "Interrupt") return "interrupted";

  return Predicate.hasProperty(reason.error, "_tag") ? String(reason.error._tag) : format(reason.error);
};

const formatSpanOutcome = (exit: Exit.Exit<unknown, unknown>) =>
  Exit.isSuccess(exit) ? "ok" : `failed: ${exit.cause.reasons.map(formatFailureReason).join(", ")}`;

// Writes one trace-level line per finished span: its path, how long it took, and how it ended.
const makeSpanLineTracer = (outputChannel: LogOutputChannel) =>
  Tracer.make({
    span(spanOptions) {
      const span = new Tracer.NativeSpan(spanOptions);
      const endNativeSpan = span.end.bind(span);

      span.end = (endTime, exit) => {
        endNativeSpan(endTime, exit);
        if (!span.sampled) return;

        const durationMilliseconds = (Number(endTime - span.startTime) / 1_000_000).toFixed(1);
        outputChannel.trace(`${formatSpanPath(span)} ${durationMilliseconds}ms ${formatSpanOutcome(exit)}`);
      };

      return span;
    }
  });

const OUTPUT_CHANNEL_METHODS = {
  Debug: "debug",
  Error: "error",
  Fatal: "error",
  Info: "info",
  Trace: "trace",
  Warn: "warn"
} as const satisfies Record<LogLevel.Severity, keyof LogOutputChannel>;

// Effect's log calls, at the matching VS Code log level; the channel drops lines below the level the user picked.
const makeOutputChannelLogger = (outputChannel: LogOutputChannel) =>
  Logger.make(({cause, logLevel, message}) => {
    const messageParts: readonly unknown[] = Array.isArray(message) ? message : [message];
    const logLine = [format(...messageParts), ...(cause.reasons.length > 0 ? [Cause.pretty(cause)] : [])].join("\n");

    // "All" and "None" are thresholds for filtering, never the level of a log call.
    if (logLevel === "All" || logLevel === "None") return;

    outputChannel[OUTPUT_CHANNEL_METHODS[logLevel]](logLine);
  });

// Spans and logs go to the "Aggregor App" output channel, which VS Code also writes to a log file on disk.
export const TraceLogLayer = Layer.unwrap(
  Effect.gen(function* () {
    const {window} = yield* VscService;
    const outputChannel = yield* Effect.acquireRelease(
      Effect.sync(() => window.createOutputChannel(APP_NAME, {log: true})),
      (channel) =>
        Effect.sync(() => {
          channel.dispose();
        })
    );

    return Layer.mergeAll(
      Logger.layer([makeOutputChannelLogger(outputChannel)]),
      Layer.succeed(Tracer.Tracer, makeSpanLineTracer(outputChannel)),
      Layer.succeed(References.MinimumLogLevel, "Trace")
    );
  })
);
