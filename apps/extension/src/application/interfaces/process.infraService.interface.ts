import {Context} from "effect";

import type {Effect} from "effect";

// A root in a cgroup of its own brings in the whole cgroup; one in the host's cgroup, which holds all it runs, its tree.
export interface ProcessGroupRequest {
  readonly hostProcessId: number;
  readonly rootProcessIds: readonly number[];
}

export interface RunningProcess {
  readonly commandLine: string;
  readonly name: string;
  readonly parentProcessId: number;
  readonly processId: number;
}

export class IProcessInfraService extends Context.Service<
  IProcessInfraService,
  {
    readonly listGroupProcesses: (processGroupRequest: ProcessGroupRequest) => Effect.Effect<readonly RunningProcess[]>;
  }
>()("aggregor-app/application/interfaces/process.infraService.interface/IProcessInfraService") {}
