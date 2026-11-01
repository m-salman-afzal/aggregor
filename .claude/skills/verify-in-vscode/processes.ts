// Reads the Linux process table under /proc, for vscode.ts.
import fileSystem from "node:fs";

const PROCESS_ID_PATTERN = /^\d+$/u;

interface ProcessParent {
  readonly parentProcessId: number;
  readonly processId: number;
}

export const readProcessFile = (processId: number, fileName: "cmdline" | "comm" | "environ" | "stat") => {
  try {
    return fileSystem.readFileSync(`/proc/${processId}/${fileName}`, "utf8");
  } catch {
    return "";
  }
};

// The command name sits in parentheses and may itself contain spaces, so the fields after it are split from the last ")".
const readParentProcessId = (processId: number) => {
  const statusLine = readProcessFile(processId, "stat");
  const [, parentProcessId] = statusLine.slice(statusLine.lastIndexOf(")") + 2).split(" ");

  return Number(parentProcessId);
};

// The process itself, then its parent and so on up to init; a process that has exited ends the chain.
const listAncestorProcessIds = (processId: number): readonly number[] =>
  processId > 1 ? [processId, ...listAncestorProcessIds(readParentProcessId(processId))] : [];

export const isClaudeProcess = (processId: number) => readProcessFile(processId, "comm").trim() === "claude";

// The Claude Code process this script runs under: the Bash tool exports CLAUDE_PID; hooks find it among their
// ancestors.
export const findClaudeProcessId = () => {
  const exportedProcessId = Number(process.env.CLAUDE_PID);
  if (exportedProcessId > 0 && isClaudeProcess(exportedProcessId)) return exportedProcessId;

  return listAncestorProcessIds(process.ppid).find(isClaudeProcess) ?? null;
};

const addDescendantProcessIds = (
  processIds: ReadonlySet<number>,
  processParents: readonly ProcessParent[]
): ReadonlySet<number> => {
  const descendants = processParents.filter(
    ({parentProcessId, processId}) => processIds.has(parentProcessId) && !processIds.has(processId)
  );
  if (descendants.length === 0) return processIds;

  return addDescendantProcessIds(
    new Set([...processIds, ...descendants.map(({processId}) => processId)]),
    processParents
  );
};

// The matching processes and everything below them; never this script or the processes it runs under.
export const findProcessTree = (isRootProcess: (processId: number) => boolean) => {
  const ownAncestorProcessIds = new Set(listAncestorProcessIds(process.pid));
  const processIds = fileSystem
    .readdirSync("/proc")
    .filter((entryName) => PROCESS_ID_PATTERN.test(entryName))
    .map(Number);
  const processParents = processIds.map((processId) => ({parentProcessId: readParentProcessId(processId), processId}));
  const treeProcessIds = addDescendantProcessIds(new Set(processIds.filter(isRootProcess)), processParents);

  return [...treeProcessIds].filter((processId) => !ownAncestorProcessIds.has(processId));
};

export const sendSignal = (processId: number, signal: NodeJS.Signals) => {
  try {
    process.kill(processId, signal);
  } catch {
    // Already gone.
  }
};
