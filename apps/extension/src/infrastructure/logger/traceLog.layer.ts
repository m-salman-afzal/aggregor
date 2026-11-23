import {format, inspect} from "node:util";

import {
  Array,
  Cause,
  Context,
  Effect,
  Exit,
  Layer,
  Logger,
  Match,
  Predicate,
  Record,
  Ref,
  References,
  Result,
  Stream,
  String,
  Tracer
} from "effect";

import {
  APP_NAME,
  OUTPUT_CHANNEL_LOG_METHODS,
  SETTINGS_SECTION,
  TRACE_LOGGING,
  TRACE_LOGGING_SETTING_ID
} from "@pkg/constants/src/app.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {VscodeUtils} from "@pkg/vscode/src/vscode.utils.ts";

import type {LogLevel} from "vscode";

type OutputChannelLogMethod = (typeof OUTPUT_CHANNEL_LOG_METHODS)[keyof typeof OUTPUT_CHANNEL_LOG_METHODS];

export class TraceLog extends Context.Service<TraceLog>()(
  "aggregor-app/infrastructure/logger/traceLog.layer/TraceLog",
  {
    make: Effect.fn("TraceLog.make")(function* () {
      const vsCodeApi = yield* VsCodeApi;
      const vscodeUtils = yield* VscodeUtils;

      const readTraceLoggingSetting = Effect.fn("TraceLog.readTraceLoggingSetting")(function* () {
        const configuredSettings = yield* vsCodeApi.getConfiguration(SETTINGS_SECTION);

        return configuredSettings.get(TRACE_LOGGING.SETTING) === true;
      });

      const outputChannel = yield* vscodeUtils.acquireScopedDisposable(() =>
        vsCodeApi.window.createOutputChannel(APP_NAME, {log: true})
      );
      const isTraceLoggingOnAtStart = yield* readTraceLoggingSetting();
      const isTraceLoggingOn = yield* Ref.make(isTraceLoggingOnAtStart);
      const logMethodLevels: Readonly<Record<OutputChannelLogMethod, LogLevel>> = {
        debug: vsCodeApi.LogLevel.Debug,
        error: vsCodeApi.LogLevel.Error,
        info: vsCodeApi.LogLevel.Info,
        trace: vsCodeApi.LogLevel.Trace,
        warn: vsCodeApi.LogLevel.Warning
      };

      // The formatters run while a span ends, so they stay plain functions: a span of their own would end inside the tracer.

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

      const formatTraceValue = (traceValue: unknown) =>
        traceValue instanceof Error
          ? `${traceValue.name}: ${traceValue.message}`
          : String.replace(
              TRACE_LOGGING.LINE_BREAK_PATTERN,
              " "
            )(inspect(traceValue, {depth: TRACE_LOGGING.VALUE_DEPTH}));

      // An error keeps its cause out of its own keys.
      const formatFailedError = (failedError: unknown) => {
        if (!Predicate.hasProperty(failedError, "_tag")) return formatTraceValue(failedError);
        // Effect's own errors carry a type marker key, such as "~effect/Cause/TimeoutError", which says nothing more.
        const errorFields: Readonly<Record<string, unknown>> = Record.filter(
          Record.remove({...failedError}, "_tag"),
          (_fieldValue, fieldName) => !String.startsWith(TRACE_LOGGING.TYPE_MARKER_PREFIX)(fieldName)
        );
        const fieldsWithCause = Predicate.hasProperty(failedError, "cause")
          ? {...errorFields, cause: failedError.cause}
          : errorFields;
        const fieldTexts = Array.map(
          Record.toEntries(fieldsWithCause),
          ([fieldName, fieldValue]) => `${fieldName}=${formatTraceValue(fieldValue)}`
        );

        return Array.join([format(failedError._tag), ...fieldTexts], " ");
      };

      const formatFailureReason = (reason: Cause.Reason<unknown>) =>
        Match.valueTags(reason, {
          Die: (dieReason) => `defect ${formatTraceValue(dieReason.defect)}`,
          Fail: (failReason) => formatFailedError(failReason.error),
          Interrupt: () => "interrupted"
        });

      const formatSpanOutcome = (exit: Exit.Exit<unknown, unknown>) =>
        Exit.isSuccess(exit) ? "ok" : `failed: ${Array.join(Array.map(exit.cause.reasons, formatFailureReason), ", ")}`;

      const formatSpanAttributes = (span: Tracer.Span) =>
        Array.join(
          Array.map(
            [...span.attributes],
            ([attributeName, attributeValue]) => ` ${attributeName}=${formatTraceValue(attributeValue)}`
          ),
          ""
        );

      // With trace logging on, a line the channel would drop for its level goes out again at Info, unless the level is Off.
      const writeTraceLogLine = (logMethod: OutputChannelLogMethod, logLine: string) => {
        outputChannel[logMethod](logLine);
        if (!Ref.getUnsafe(isTraceLoggingOn) || outputChannel.logLevel <= logMethodLevels[logMethod]) return;

        outputChannel.info(TRACE_LOGGING.FORCED_LINE(logMethod, logLine));
      };

      const makeSpanLineTracer = Effect.fn("TraceLog.makeSpanLineTracer")(function* () {
        return Tracer.make({
          span(spanOptions) {
            const span = new Tracer.NativeSpan(spanOptions);
            const endNativeSpan = span.end.bind(span);

            span.end = (endTime, exit) => {
              endNativeSpan(endTime, exit);
              if (!span.sampled) return;

              const durationMilliseconds = (Number(endTime - span.startTime) / 1_000_000).toFixed(1);
              writeTraceLogLine(
                OUTPUT_CHANNEL_LOG_METHODS.Trace,
                `${formatSpanPath(span)} ${durationMilliseconds}ms ${formatSpanOutcome(exit)}${formatSpanAttributes(span)}`
              );
            };

            return span;
          }
        });
      });

      const makeOutputChannelLogger = Effect.fn("TraceLog.makeOutputChannelLogger")(function* () {
        return Logger.make((logCall) => {
          const messageParts: readonly unknown[] = Array.isArray(logCall.message) ? logCall.message : [logCall.message];
          const causeLines =
            logCall.cause.reasons.length > 0
              ? [Array.join(Array.map(logCall.cause.reasons, formatFailureReason), ", "), Cause.pretty(logCall.cause)]
              : [];
          const logLine = Array.join([format(...messageParts), ...causeLines], "\n");

          // "All" and "None" are thresholds for filtering, never the level of a log call.
          if (logCall.logLevel === "All" || logCall.logLevel === "None") return;

          writeTraceLogLine(OUTPUT_CHANNEL_LOG_METHODS[logCall.logLevel], logLine);
        });
      });

      const watchTraceLoggingSetting = Effect.fn("TraceLog.watchTraceLoggingSetting")(function* () {
        const configChanges = yield* vscodeUtils.streamVsCodeEvent(vsCodeApi.workspace.onDidChangeConfiguration);
        const traceLoggingChanges = Stream.filter(configChanges, (configChange) =>
          configChange.affectsConfiguration(TRACE_LOGGING_SETTING_ID)
        );

        yield* Stream.runForEach(traceLoggingChanges, () =>
          Effect.flatMap(readTraceLoggingSetting(), (isOn) => Ref.set(isTraceLoggingOn, isOn))
        );
      });

      const outputChannelLogger = yield* makeOutputChannelLogger();
      const spanLineTracer = yield* makeSpanLineTracer();
      yield* Effect.forkScoped(watchTraceLoggingSetting());

      return {outputChannelLogger, spanLineTracer};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(Layer.provide(VscodeUtils.layer));
}

export const TraceLogLayer = Layer.unwrap(
  TraceLog.useSync((traceLog) =>
    Layer.mergeAll(
      Logger.layer([traceLog.outputChannelLogger]),
      Layer.succeed(Tracer.Tracer, traceLog.spanLineTracer),
      Layer.succeed(References.MinimumLogLevel, "Trace")
    )
  )
).pipe(Layer.provide(TraceLog.layer));
