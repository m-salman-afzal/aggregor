// A terminal runs tmux in place, so its process id is its tmux client's.
export interface TmuxClient {
  readonly clientName: string;
  readonly sessionName: string;
  readonly sessionPath: string;
  readonly terminalProcessId: number;
}
