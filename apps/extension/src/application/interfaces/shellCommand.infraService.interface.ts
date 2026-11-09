import {Context} from "effect";

import type {Effect} from "effect";

// The commands this machine can run, as the extension host's PATH finds them.
export class IShellCommandInfraService extends Context.Service<
  IShellCommandInfraService,
  {
    // The ones among these commands that PATH finds, searched afresh each time, so a CLI installed since shows up.
    readonly listInstalledCommands: (commands: readonly string[]) => Effect.Effect<ReadonlySet<string>>;
  }
>()("aggregor-app/application/interfaces/shellCommand.infraService.interface/IShellCommandInfraService") {}
