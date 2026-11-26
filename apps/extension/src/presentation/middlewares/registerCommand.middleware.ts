import {Context, Effect, Layer, Array, JsonSchema, Ref, Schema} from "effect";

import {APP_ERRORS} from "@pkg/constants/src/app.constant.ts";
import {TaggedErrors} from "@pkg/errors/src/taggedErrors.utils.ts";
import {VsCodeApi} from "@pkg/vscode/src/vscode.api.ts";
import {VscodeUtils} from "@pkg/vscode/src/vscode.utils.ts";

import type {VscodeUtilsErrors} from "@pkg/vscode/src/vscode.utils.ts";

interface CommandErrorMessage {
  readonly commandToRun?: {readonly commandId: string; readonly label: string};
  readonly message: string;
  readonly pageToOpen?: {readonly label: string; readonly url: string};
  readonly settingToOpen?: string;
}

interface CommandRegistration<CommandRequest, CommandError, R> {
  readonly commandId: string;
  readonly controller: (
    commandRequest: CommandRequest
  ) => Effect.Effect<unknown, NoInfer<CommandError> | VscodeUtilsErrors["InvalidVsCodeArgumentError"], R>;
  readonly getCommandErrorMessage: (commandError: CommandError) => Effect.Effect<CommandErrorMessage>;
}

class RegisterCommandMiddlewareErrors extends TaggedErrors({
  CommandFailedError: {message: Schema.String},
  CommandNotRegisteredError: {commandId: Schema.String},
  InvalidCommandRequestError: {message: Schema.String}
}) {}

interface RegisteredCommand {
  readonly commandId: string;
  readonly requestJsonSchema: JsonSchema.JsonSchema | undefined;
  readonly runCommandWithoutNotification: (
    commandArgument: unknown
  ) => Effect.Effect<unknown, RegisterCommandMiddlewareErrors["CommandFailedError" | "InvalidCommandRequestError"]>;
}

export class RegisterCommandMiddleware extends Context.Service<RegisterCommandMiddleware>()(
  "aggregor-app/presentation/middlewares/registerCommand.middleware/RegisterCommandMiddleware",
  {
    make: Effect.fn("RegisterCommandMiddleware.make")(function* () {
      const vsCodeApi = yield* VsCodeApi;
      const vscodeUtils = yield* VscodeUtils;
      const registeredCommands = yield* Ref.make<ReadonlyMap<string, RegisteredCommand>>(new Map());

      const showCommandError = Effect.fn("RegisterCommandMiddleware.showCommandError")(function* <CommandError>(
        commandId: string,
        commandError: CommandError,
        getCommandErrorMessage: (commandError: CommandError) => Effect.Effect<CommandErrorMessage>
      ) {
        yield* Effect.logError(`Command ${commandId} failed`, commandError);
        const commandErrorMessage = yield* getCommandErrorMessage(commandError);
        yield* vscodeUtils.showErrorNotificationWithoutWaiting(commandErrorMessage.message, commandErrorMessage);
      });

      const showInvalidArguments = Effect.fn("RegisterCommandMiddleware.showInvalidArguments")(function* (
        commandId: string,
        invalidArgument: unknown
      ) {
        yield* Effect.logError(`Command ${commandId} got unexpected arguments`, invalidArgument);
        yield* vscodeUtils.showErrorNotificationWithoutWaiting(APP_ERRORS.INVALID_COMMAND_ARGUMENTS(commandId));
      });

      const failWithCommandErrorMessage = Effect.fn("RegisterCommandMiddleware.failWithCommandErrorMessage")(function* <
        CommandError
      >(
        commandError: CommandError,
        getCommandErrorMessage: (commandError: CommandError) => Effect.Effect<CommandErrorMessage>
      ) {
        const commandErrorMessage = yield* getCommandErrorMessage(commandError);

        return yield* RegisterCommandMiddlewareErrors.CommandFailedError.make({message: commandErrorMessage.message});
      });

      const makeRequestJsonSchema = Effect.fn("RegisterCommandMiddleware.makeRequestJsonSchema")(function* (
        requestSchema: Schema.Constraint
      ) {
        const requestJsonSchemaDocument = Schema.toJsonSchemaDocument(requestSchema);
        const requestJsonSchema: JsonSchema.JsonSchema = {
          $schema: JsonSchema.META_SCHEMA_URI_DRAFT_2020_12,
          ...requestJsonSchemaDocument.schema,
          $defs: requestJsonSchemaDocument.definitions
        };

        return requestJsonSchema;
      });

      const registerVsCodeCommand = Effect.fn("RegisterCommandMiddleware.registerVsCodeCommand")(function* <
        CommandError extends {readonly _tag: string},
        R
      >(commandRegistration: CommandRegistration<unknown, CommandError, R>) {
        const commandId = commandRegistration.commandId;
        const commandContext = yield* Effect.context<R>();
        const runPromise = Effect.runPromiseWith(commandContext);
        // oxlint-disable-next-line aggregor/span-name -- a command's root span is named by its command ID
        const runCommand = Effect.fn(commandId, {root: true})(
          function* (commandArgument: unknown) {
            return yield* commandRegistration.controller(commandArgument);
          },
          Effect.catchTag("InvalidVsCodeArgumentError", (invalidArgument) =>
            showInvalidArguments(commandId, invalidArgument)
          ),
          Effect.catch((commandError) =>
            showCommandError(commandId, commandError, commandRegistration.getCommandErrorMessage)
          ),
          Effect.tapCause((cause) => Effect.logError(`Command ${commandId} crashed`, cause))
        );

        yield* vscodeUtils.acquireScopedDisposable(() =>
          vsCodeApi.commands.registerCommand(commandId, (...commandArguments: unknown[]) =>
            runPromise(runCommand(commandArguments[0]))
          )
        );
      });

      // Runs the command as VS Code does, under its root span, but hands its failure back instead of notifying.
      const makeCommandRunWithoutNotification = Effect.fn(
        "RegisterCommandMiddleware.makeCommandRunWithoutNotification"
      )(function* <CommandError extends {readonly _tag: string; readonly message: string}, R>(
        commandRegistration: CommandRegistration<unknown, CommandError, R>
      ) {
        const commandContext = yield* Effect.context<R>();

        // oxlint-disable-next-line aggregor/span-name -- a command's root span is named by its command ID
        return Effect.fn(commandRegistration.commandId, {root: true})(
          function* (commandArgument: unknown) {
            return yield* commandRegistration.controller(commandArgument);
          },
          Effect.catchTag(
            "InvalidVsCodeArgumentError",
            (invalidArgument) =>
              Effect.fail(
                RegisterCommandMiddlewareErrors.InvalidCommandRequestError.make({message: invalidArgument.message})
              ),
            (commandError) => failWithCommandErrorMessage(commandError, commandRegistration.getCommandErrorMessage)
          ),
          Effect.tapDefect((defect) => Effect.logError(`Command ${commandRegistration.commandId} crashed`, defect)),
          Effect.provideContext(commandContext)
        );
      });

      const addCommand = Effect.fn("RegisterCommandMiddleware.addCommand")(function* <
        CommandError extends {readonly _tag: string; readonly message: string},
        R
      >(
        commandRegistration: CommandRegistration<unknown, CommandError, R>,
        requestJsonSchema: JsonSchema.JsonSchema | undefined
      ) {
        const commandId = commandRegistration.commandId;
        const runCommandWithoutNotification = yield* makeCommandRunWithoutNotification(commandRegistration);

        yield* Ref.update(registeredCommands, (commandsById) =>
          new Map(commandsById).set(commandId, {commandId, requestJsonSchema, runCommandWithoutNotification})
        );
        yield* registerVsCodeCommand(commandRegistration);
      });

      const registerCommand = Effect.fn("RegisterCommandMiddleware.registerCommand")(function* <
        RequestSchema extends Schema.ConstraintDecoder<unknown>,
        CommandError extends {readonly _tag: string; readonly message: string},
        R
      >(
        commandRegistration: {
          readonly requestSchema: RequestSchema;
        } & CommandRegistration<RequestSchema["Type"], CommandError, R>
      ) {
        const requestJsonSchema = yield* makeRequestJsonSchema(commandRegistration.requestSchema);

        yield* addCommand(
          {
            commandId: commandRegistration.commandId,
            controller: (commandArgument) =>
              Effect.flatMap(
                vscodeUtils.decodeVsCodeArgument(commandRegistration.requestSchema, commandArgument),
                commandRegistration.controller
              ),
            getCommandErrorMessage: commandRegistration.getCommandErrorMessage
          },
          requestJsonSchema
        );
      });

      // VS Code hands a title button's command the focused row, so a command that takes no request ignores it.
      const registerCommandWithoutRequest = Effect.fn("RegisterCommandMiddleware.registerCommandWithoutRequest")(
        function* <CommandError extends {readonly _tag: string; readonly message: string}, R>(
          commandRegistration: CommandRegistration<void, CommandError, R>
        ) {
          yield* addCommand(
            {
              commandId: commandRegistration.commandId,
              controller: () => commandRegistration.controller(),
              getCommandErrorMessage: commandRegistration.getCommandErrorMessage
            },
            undefined
          );
        }
      );

      const listRegisteredCommands = Effect.fn("RegisterCommandMiddleware.listRegisteredCommands")(function* () {
        const commandsById = yield* Ref.get(registeredCommands);

        return Array.map(Array.fromIterable(commandsById.values()), (registeredCommand) => ({
          commandId: registeredCommand.commandId,
          requestJsonSchema: registeredCommand.requestJsonSchema
        }));
      });

      const runCommandWithoutNotification = Effect.fn("RegisterCommandMiddleware.runCommandWithoutNotification")(
        function* (commandId: string, commandArgument: unknown) {
          const commandsById = yield* Ref.get(registeredCommands);
          const registeredCommand = commandsById.get(commandId);
          if (registeredCommand === undefined)
            return yield* RegisterCommandMiddlewareErrors.CommandNotRegisteredError.make({commandId});

          return yield* registeredCommand.runCommandWithoutNotification(commandArgument);
        }
      );

      return {
        listRegisteredCommands: listRegisteredCommands(),
        registerCommand,
        registerCommandWithoutRequest,
        runCommandWithoutNotification
      };
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make());
}
