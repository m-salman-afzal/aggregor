import {Context} from "effect";

import type {Effect} from "effect";

export class IShellCommandInfraService extends Context.Service<
  IShellCommandInfraService,
  {
    // Searched afresh each time, so a CLI installed since shows up.
    readonly listInstalledCommands: (commands: readonly string[]) => Effect.Effect<ReadonlySet<string>>;
  }
>()("aggregor-app/application/interfaces/shellCommand.infraService.interface/IShellCommandInfraService") {}
