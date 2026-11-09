import {HarnessEntity} from "@entities/harness/harness.entity.ts";
import {HarnessNotFoundError, IHarnessRepository} from "@entities/harness/harness.repository.interface.ts";
import {SETTINGS_SECTION} from "@pkg/constants/src/app.constant.ts";
import {DEFAULT_HARNESS_CODICON, HARNESS_SETTINGS} from "@pkg/constants/src/harness.constant.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {streamVsCodeEvent} from "@pkg/vscode/src/vscode.utils.ts";
import {EnvironmentVariablesValueObjectSchema} from "@valueObjects/environmentVariables.valueObject.ts";
import {Array, Effect, Layer, Predicate, Record, Ref, Result, Schema, Stream, String} from "effect";
import {Path} from "effect/Path";

import type {HarnessIdValueObject} from "@valueObjects/harnessId.valueObject.ts";

// What the harnesses need from VS Code and the machine: the settings, and the extension's folder for relative icons.
interface HarnessSettingsSource {
  readonly extensionPath: string;
  readonly getConfiguration: VsCodeApi["Service"]["getConfiguration"];
  readonly path: Path;
  readonly workspace: VsCodeApi["Service"]["workspace"];
}

// One aggregorApp.harnesses entry as the user may write it: the command defaults to its key, the name too, resumeArgs
// to args, and the icon to a terminal.
const HarnessSettingSchema = Schema.Struct({
  args: Schema.optional(Schema.Array(Schema.String)),
  command: Schema.optional(Schema.NonEmptyString),
  env: Schema.optional(EnvironmentVariablesValueObjectSchema),
  icon: Schema.optional(Schema.NonEmptyString),
  name: Schema.optional(Schema.NonEmptyString),
  resumeArgs: Schema.optional(Schema.Array(Schema.String))
});

const IMAGE_FILE_EXTENSION = /\.(?:png|svg)$/iu;

// An icon naming a file (a folder or an image extension in it) is an image, relative to the extension's folder unless
// absolute; anything else is a codicon id.
const toHarnessIcon = Effect.fn("HarnessRepository.toHarnessIcon")(function* (
  {extensionPath, path}: HarnessSettingsSource,
  icon: string | undefined
) {
  if (icon === undefined) return {_tag: "CodiconIcon", codiconId: DEFAULT_HARNESS_CODICON} as const;
  const isImageFile = String.includes("/")(icon) || String.includes("\\")(icon) || IMAGE_FILE_EXTENSION.test(icon);
  if (!isImageFile) return {_tag: "CodiconIcon", codiconId: icon} as const;

  return {_tag: "FileIcon", filePath: path.isAbsolute(icon) ? icon : path.join(extensionPath, icon)} as const;
});

const toHarness = Effect.fn("HarnessRepository.toHarness")(
  function* (harnessSettingsSource: HarnessSettingsSource, [harnessKey, harnessSetting]: readonly [string, unknown]) {
    const {args, command, env, icon, name, resumeArgs} =
      yield* Schema.decodeUnknownEffect(HarnessSettingSchema)(harnessSetting);
    const harnessArguments = args === undefined ? [] : args;
    const harnessIcon = yield* toHarnessIcon(harnessSettingsSource, icon);

    return yield* Schema.decodeEffect(HarnessEntity)({
      args: harnessArguments,
      command: command === undefined ? harnessKey : command,
      environmentVariables: env === undefined ? {} : env,
      icon: harnessIcon,
      id: harnessKey,
      name: name === undefined ? harnessKey : name,
      resumeArgs: resumeArgs === undefined ? harnessArguments : resumeArgs
    });
  },
  (effect, _harnessSettingsSource, [harnessKey]) =>
    Effect.tapError(effect, (invalidSetting) =>
      Effect.logWarning(`The aggregorApp.harnesses entry "${harnessKey}" is invalid and left out`, invalidSetting)
    )
);

// The built-ins are the setting's default, which VS Code merges with the user's entries key by key; null hides an entry,
// and one that doesn't decode is left out with a warning.
const readHarnesses = Effect.fn("HarnessRepository.readHarnesses")(function* (
  harnessSettingsSource: HarnessSettingsSource
) {
  const config = yield* harnessSettingsSource.getConfiguration(SETTINGS_SECTION);
  const harnessSettings: unknown = config.get(HARNESS_SETTINGS.HARNESSES);
  const harnessEntries = Predicate.isObject(harnessSettings) ? Record.toEntries(harnessSettings) : [];
  const shownHarnessEntries = Array.filter(harnessEntries, ([, harnessSetting]) => harnessSetting !== null);
  const harnessResults = yield* Effect.forEach(shownHarnessEntries, (harnessEntry) =>
    Effect.result(toHarness(harnessSettingsSource, harnessEntry))
  );

  return Array.getSuccesses(harnessResults);
});

// Read once and again on each change of the setting, so an invalid entry is warned about once, not on every read.
const watchHarnessSettings = Effect.fn("HarnessRepository.watchHarnessSettings")(function* (
  harnessSettingsSource: HarnessSettingsSource,
  harnesses: Ref.Ref<readonly HarnessEntity[]>
) {
  const settingsChanges = yield* streamVsCodeEvent(harnessSettingsSource.workspace.onDidChangeConfiguration);
  const harnessSettingChanges = Stream.filter(settingsChanges, (settingsChange) =>
    settingsChange.affectsConfiguration(`${SETTINGS_SECTION}.${HARNESS_SETTINGS.HARNESSES}`)
  );

  yield* Stream.runForEach(harnessSettingChanges, () =>
    Effect.flatMap(readHarnesses(harnessSettingsSource), (changedHarnesses) => Ref.set(harnesses, changedHarnesses))
  );
});

const findHarnessById = Effect.fn("HarnessRepository.findHarnessById")(function* (
  harnesses: Ref.Ref<readonly HarnessEntity[]>,
  harnessId: HarnessIdValueObject
) {
  const currentHarnesses = yield* Ref.get(harnesses);

  return yield* Effect.fromResult(
    Result.fromOption(
      Array.findFirst(currentHarnesses, (harness) => harness.id === harnessId),
      () => HarnessNotFoundError.make({harnessId})
    )
  );
});

const makeHarnessRepository = Effect.fn("HarnessRepository.make")(function* () {
  const {extensionUri, getConfiguration, workspace} = yield* VsCodeApi;
  const harnessSettingsSource: HarnessSettingsSource = {
    extensionPath: extensionUri.fsPath,
    getConfiguration,
    path: yield* Path,
    workspace
  };
  const initialHarnesses = yield* readHarnesses(harnessSettingsSource);
  const harnesses = yield* Ref.make<readonly HarnessEntity[]>(initialHarnesses);
  yield* Effect.forkScoped(watchHarnessSettings(harnessSettingsSource, harnesses));

  return {
    findAll: Ref.get(harnesses),
    findById: (harnessId: HarnessIdValueObject) => findHarnessById(harnesses, harnessId)
  };
});

export const HarnessRepository = Layer.effect(IHarnessRepository, makeHarnessRepository());
