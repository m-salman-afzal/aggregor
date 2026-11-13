import {
  APP_NAME,
  OUTPUT_CHANNEL_LOG_METHODS,
  SETTINGS_SECTION,
  TRACE_LOGGING,
  TRACE_LOGGING_SETTING_ID
} from "@pkg/constants/src/app.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {acquireScopedDisposable, streamVsCodeEvent} from "@pkg/vscode/src/vscode.utils.ts";
import {
  Array,
  Cause,
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
import {format, inspect} from "node:util";

import type {LogLevel, LogOutputChannel} from "vscode";

type OutputChannelLogMethod = (typeof OUTPUT_CHANNEL_LOG_METHODS)[keyof typeof OUTPUT_CHANNEL_LOG_METHODS];

interface TraceLogDependencies {
  readonly isTraceLoggingOn: Ref.Ref<boolean>;
  readonly logMethodLevels: Readonly<Record<OutputChannelLogMethod, LogLevel>>;
  readonly outputChannel: LogOutputChannel;
}

// The formatters run while a span ends, so they stay plain functions: a span of their own would end inside the tracer.

// "aggregorApp.openSession > SessionController.openChosenSession": the span's name after its ancestors'.
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

// One line for any value: an error's name and message, anything else as Node prints it.
// eslint-disable-next-line no-restricted-syntax -- runs while a span ends
const formatTraceValue = (traceValue: unknown) =>
  traceValue instanceof Error
    ? `${traceValue.name}: ${traceValue.message}`
    : String.replace(TRACE_LOGGING.LINE_BREAK_PATTERN, " ")(inspect(traceValue, {depth: TRACE_LOGGING.VALUE_DEPTH}));

// "SettingsFileNotSavedError settingsFilePath=…": each field, and the cause, which an error keeps out of its own keys.
// eslint-disable-next-line no-restricted-syntax -- runs while a span ends
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

// eslint-disable-next-line no-restricted-syntax -- runs while a span ends
const formatFailureReason = (reason: Cause.Reason<unknown>) =>
  Match.valueTags(reason, {
    Die: (dieReason) => `defect ${formatTraceValue(dieReason.defect)}`,
    Fail: (failReason) => formatFailedError(failReason.error),
    Interrupt: () => "interrupted"
  });

// eslint-disable-next-line no-restricted-syntax -- runs while a span ends
const formatSpanOutcome = (exit: Exit.Exit<unknown, unknown>) =>
  Exit.isSuccess(exit) ? "ok" : `failed: ${Array.join(Array.map(exit.cause.reasons, formatFailureReason), ", ")}`;

// What the span was annotated with, such as the project a switch brings in.
// eslint-disable-next-line no-restricted-syntax -- runs while a span ends
const formatSpanAttributes = (span: Tracer.Span) =>
  Array.join(
    Array.map(
      [...span.attributes],
      ([attributeName, attributeValue]) => ` ${attributeName}=${formatTraceValue(attributeValue)}`
    ),
    ""
  );

// With trace logging on, a line the channel would drop for its level goes out again at Info, unless the level is Off.
// eslint-disable-next-line no-restricted-syntax -- runs while a span ends
const writeTraceLogLine = (
  traceLogDependencies: TraceLogDependencies,
  logMethod: OutputChannelLogMethod,
  logLine: string
) => {
  traceLogDependencies.outputChannel[logMethod](logLine);
  if (
    !Ref.getUnsafe(traceLogDependencies.isTraceLoggingOn) ||
    traceLogDependencies.outputChannel.logLevel <= traceLogDependencies.logMethodLevels[logMethod]
  )
    return;

  traceLogDependencies.outputChannel.info(TRACE_LOGGING.FORCED_LINE(logMethod, logLine));
};

const makeSpanLineTracer = Effect.fn("TraceLog.makeSpanLineTracer")(function* (
  traceLogDependencies: TraceLogDependencies
) {
  return Tracer.make({
    span(spanOptions) {
      const span = new Tracer.NativeSpan(spanOptions);
      const endNativeSpan = span.end.bind(span);

      span.end = (endTime, exit) => {
        endNativeSpan(endTime, exit);
        if (!span.sampled) return;

        const durationMilliseconds = (Number(endTime - span.startTime) / 1_000_000).toFixed(1);
        writeTraceLogLine(
          traceLogDependencies,
          OUTPUT_CHANNEL_LOG_METHODS.Trace,
          `${formatSpanPath(span)} ${durationMilliseconds}ms ${formatSpanOutcome(exit)}${formatSpanAttributes(span)}`
        );
      };

      return span;
    }
  });
});

const makeOutputChannelLogger = Effect.fn("TraceLog.makeOutputChannelLogger")(function* (
  traceLogDependencies: TraceLogDependencies
) {
  return Logger.make((logCall) => {
    const messageParts: readonly unknown[] = Array.isArray(logCall.message) ? logCall.message : [logCall.message];
    const causeLines =
      logCall.cause.reasons.length > 0
        ? [Array.join(Array.map(logCall.cause.reasons, formatFailureReason), ", "), Cause.pretty(logCall.cause)]
        : [];
    const logLine = Array.join([format(...messageParts), ...causeLines], "\n");

    // "All" and "None" are thresholds for filtering, never the level of a log call.
    if (logCall.logLevel === "All" || logCall.logLevel === "None") return;

    writeTraceLogLine(traceLogDependencies, OUTPUT_CHANNEL_LOG_METHODS[logCall.logLevel], logLine);
  });
});

const readTraceLoggingSetting = Effect.fn("TraceLog.readTraceLoggingSetting")(function* (
  vsCodeApi: Pick<VsCodeApi["Service"], "getConfiguration">
) {
  const configuredSettings = yield* vsCodeApi.getConfiguration(SETTINGS_SECTION);

  return configuredSettings.get(TRACE_LOGGING.SETTING) === true;
});

const watchTraceLoggingSetting = Effect.fn("TraceLog.watchTraceLoggingSetting")(function* (
  vsCodeApi: Pick<VsCodeApi["Service"], "getConfiguration" | "workspace">,
  isTraceLoggingOn: Ref.Ref<boolean>
) {
  const configChanges = yield* streamVsCodeEvent(vsCodeApi.workspace.onDidChangeConfiguration);
  const traceLoggingChanges = Stream.filter(configChanges, (configChange) =>
    configChange.affectsConfiguration(TRACE_LOGGING_SETTING_ID)
  );

  yield* Stream.runForEach(traceLoggingChanges, () =>
    Effect.flatMap(readTraceLoggingSetting(vsCodeApi), (isOn) => Ref.set(isTraceLoggingOn, isOn))
  );
});

const makeTraceLog = Effect.fn("TraceLog.make")(function* () {
  const vsCodeApi = yield* VsCodeApi;
  const outputChannel = yield* acquireScopedDisposable(() =>
    vsCodeApi.window.createOutputChannel(APP_NAME, {log: true})
  );
  const isTraceLoggingOnAtStart = yield* readTraceLoggingSetting(vsCodeApi);
  const isTraceLoggingOn = yield* Ref.make(isTraceLoggingOnAtStart);
  const traceLogDependencies: TraceLogDependencies = {
    isTraceLoggingOn,
    logMethodLevels: {
      debug: vsCodeApi.LogLevel.Debug,
      error: vsCodeApi.LogLevel.Error,
      info: vsCodeApi.LogLevel.Info,
      trace: vsCodeApi.LogLevel.Trace,
      warn: vsCodeApi.LogLevel.Warning
    },
    outputChannel
  };
  const outputChannelLogger = yield* makeOutputChannelLogger(traceLogDependencies);
  const spanLineTracer = yield* makeSpanLineTracer(traceLogDependencies);
  yield* Effect.forkScoped(watchTraceLoggingSetting(vsCodeApi, isTraceLoggingOn));

  return Layer.mergeAll(
    Logger.layer([outputChannelLogger]),
    Layer.succeed(Tracer.Tracer, spanLineTracer),
    Layer.succeed(References.MinimumLogLevel, "Trace")
  );
});

export const TraceLogLayer = Layer.unwrap(makeTraceLog());
