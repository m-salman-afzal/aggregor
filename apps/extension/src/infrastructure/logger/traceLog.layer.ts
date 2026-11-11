import {APP_NAME, OUTPUT_CHANNEL_LOG_METHODS} from "@pkg/constants/src/app.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {acquireScopedDisposable} from "@pkg/vscode/src/vscode.utils.ts";
import {Array, Cause, Effect, Exit, Layer, Logger, Match, Predicate, References, Result, Tracer} from "effect";
import {format} from "node:util";

import type {LogOutputChannel} from "vscode";

// The formatters run while a span ends, so they stay plain functions: a span of their own would end inside the tracer.

// "aggregorApp.openSession > SessionController.openChosenSession > SessionService.openSession": the span's name after
// its ancestors'.
// eslint-disable-next-line no-restricted-syntax -- runs while a span ends
const formatSpanPath = (span: Tracer.AnySpan): string =>
  Match.valueTags(span, {
    ExternalSpan: () => "external",
    Span: (localSpan) =>
      Result.match(
        Result.fromOption(localSpan.parent, () => "root"),
        {
          onFailure: () => localSpan.name,
          onSuccess: (parentSpan) => `${formatSpanPath(parentSpan)} > ${localSpan.name}`
        }
      )
  });

// eslint-disable-next-line no-restricted-syntax -- runs while a span ends
const formatFailureReason = (reason: Cause.Reason<unknown>) =>
  Match.valueTags(reason, {
    Die: () => "defect",
    Fail: ({error}) => (Predicate.hasProperty(error, "_tag") ? String(error._tag) : format(error)),
    Interrupt: () => "interrupted"
  });

// eslint-disable-next-line no-restricted-syntax -- runs while a span ends
const formatSpanOutcome = (exit: Exit.Exit<unknown, unknown>) =>
  Exit.isSuccess(exit) ? "ok" : `failed: ${Array.join(Array.map(exit.cause.reasons, formatFailureReason), ", ")}`;

// Writes one trace-level line per finished span: its path, how long it took, and how it ended.
const makeSpanLineTracer = Effect.fn("TraceLog.makeSpanLineTracer")(function* (outputChannel: LogOutputChannel) {
  return Tracer.make({
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
});

// Effect's log calls, at the matching VS Code log level; the channel drops lines below the level the user picked.
const makeOutputChannelLogger = Effect.fn("TraceLog.makeOutputChannelLogger")(function* (
  outputChannel: LogOutputChannel
) {
  return Logger.make(({cause, logLevel, message}) => {
    const messageParts: readonly unknown[] = Array.isArray(message) ? message : [message];
    const logLine = Array.join(
      [format(...messageParts), ...(cause.reasons.length > 0 ? [Cause.pretty(cause)] : [])],
      "\n"
    );

    // "All" and "None" are thresholds for filtering, never the level of a log call.
    if (logLevel === "All" || logLevel === "None") return;

    outputChannel[OUTPUT_CHANNEL_LOG_METHODS[logLevel]](logLine);
  });
});

const makeTraceLog = Effect.fn("TraceLog.make")(function* () {
  const {window} = yield* VsCodeApi;
  const outputChannel = yield* acquireScopedDisposable(() => window.createOutputChannel(APP_NAME, {log: true}));
  const outputChannelLogger = yield* makeOutputChannelLogger(outputChannel);
  const spanLineTracer = yield* makeSpanLineTracer(outputChannel);

  return Layer.mergeAll(
    Logger.layer([outputChannelLogger]),
    Layer.succeed(Tracer.Tracer, spanLineTracer),
    Layer.succeed(References.MinimumLogLevel, "Trace")
  );
});

// Spans and logs go to the "Aggregor App" output channel, which VS Code also writes to a log file on disk.
export const TraceLogLayer = Layer.unwrap(makeTraceLog());
