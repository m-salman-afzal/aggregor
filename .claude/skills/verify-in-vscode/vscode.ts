// Runs the aggregor extension in an isolated, headless VS Code for the verify-in-vscode skill (Linux only); SKILL.md
// lists the commands. Besides `stop`, hooks and a watchdog in the launch close it, so it never outlives its turn.
import {execFileSync, spawn, spawnSync} from "node:child_process";
import fileSystem from "node:fs";
import operatingSystem from "node:os";
import path from "node:path";

import {CDP_PORT, evaluate, findWorkbenchPage, listCdpTargets, screenshot} from "./cdp.ts";
import {findClaudeProcessId, findProcessTree, isClaudeProcess, readProcessFile, sendSignal} from "./processes.ts";

// What start leaves for the other commands and for the hooks: whose launch it is and where its trace log went.
interface VerifyState {
  readonly ownerProcessId: null | number;
  readonly startedAt: number;
  readonly traceLogPath?: string;
  readonly workspacePath: string;
}

const MAX_LIFETIME_SECONDS = 20 * 60;
const STATE_DIRECTORY = path.join(operatingSystem.homedir(), ".cache", "aggregor-verify");
const STATE_FILE = path.join(STATE_DIRECTORY, "state.json");
const VSCODE_DATA_DIRECTORY = path.join(STATE_DIRECTORY, "vscode-data");
const VSCODE_EXTENSIONS_DIRECTORY = path.join(STATE_DIRECTORY, "vscode-extensions");
const LAUNCH_LOG = path.join(STATE_DIRECTORY, "launch.log");
const MUTTER_LOG = path.join(STATE_DIRECTORY, "mutter.log");
const RUNTIME_DIRECTORY = path.join(STATE_DIRECTORY, "runtime");
const WAYLAND_DISPLAY_NAME = `aggregor-verify-${CDP_PORT}`;
// Every process the launch starts inherits this variable, so stop can find them. VS Code's own processes hide it
// (Chromium rewrites their process title over the environment), so stop finds those by their --user-data-dir instead.
const INSTANCE_VARIABLE = "AGGREGOR_VERIFY_INSTANCE";
const INSTANCE_MARKER = `${INSTANCE_VARIABLE}=${STATE_DIRECTORY}`;
const USER_DATA_DIRECTORY_ARGUMENTS = [
  `--user-data-dir=${VSCODE_DATA_DIRECTORY} `,
  `--user-data-dir ${VSCODE_DATA_DIRECTORY} `
];
const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "../../..");
const EXTENSION_DIRECTORY = path.join(REPOSITORY_ROOT, "apps", "extension");
const CONFIGURED_WORKSPACE = process.env.AGGREGOR_VERIFY_WORKSPACE;
const DEFAULT_WORKSPACE =
  CONFIGURED_WORKSPACE === undefined ? path.join(operatingSystem.homedir(), "side", "jsTester") : CONFIGURED_WORKSPACE;
// Variables of the session the agent runs in; see createLaunchEnvironment.
const INHERITED_SESSION_VARIABLE_PATTERN = /^(?:VSCODE_|ELECTRON_|CLAUDE|DISPLAY$|CHROME_DESKTOP$|TERM_PROGRAM)/u;
const POLL_INTERVAL_MILLISECONDS = 200;
const TRACE_LOG_RELATIVE_PATH = path.join("window1", "exthost", "SalmanAfzal.aggregor-app", "Aggregor App.log");

// Runs inside the private D-Bus session. Ends in a watchdog that closes everything once the Claude session that ran
// start is gone or the lifetime is up, so an interrupted or abandoned session leaves nothing behind.
const LAUNCH_SCRIPT = `
mutter --headless --no-x11 --wayland-display="$WAYLAND_DISPLAY" --virtual-monitor 1600x1000 > "$1" 2>&1 &
for _ in $(seq 1 50); do [ -S "$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY" ] && break; sleep 0.1; done
code --ozone-platform=wayland --password-store=basic --user-data-dir "$2" --extensions-dir "$3" \\
  --extensionDevelopmentPath="$4" --log SalmanAfzal.aggregor-app:trace --remote-debugging-port="$5" \\
  --disable-workspace-trust --skip-welcome --new-window "$6"
while [ "$SECONDS" -lt "$7" ] && { [ -z "$8" ] || kill -0 "$8" 2>/dev/null; }; do sleep 5; done
exec "\${10}" "$9" stop --watchdog
`;

const sleep = async (milliseconds: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const waitFor = async <A>(findValue: () => A | Promise<A | undefined> | undefined, timeoutMilliseconds: number) => {
  const value = await findValue();
  if (value !== undefined || timeoutMilliseconds <= 0) return value;
  await sleep(POLL_INTERVAL_MILLISECONDS);

  return waitFor(findValue, timeoutMilliseconds - POLL_INTERVAL_MILLISECONDS);
};

const isVerifyState = (value: unknown): value is VerifyState =>
  typeof value === "object" &&
  value !== null &&
  "startedAt" in value &&
  typeof value.startedAt === "number" &&
  "workspacePath" in value &&
  typeof value.workspacePath === "string";

const readState = () => {
  try {
    const state: unknown = JSON.parse(fileSystem.readFileSync(STATE_FILE, "utf8"));

    return isVerifyState(state) ? state : null;
  } catch {
    return null;
  }
};

const writeState = (state: VerifyState) => {
  fileSystem.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
};

const isInstanceProcess = (processId: number) => {
  const commandLine = ` ${readProcessFile(processId, "cmdline").replaceAll("\0", " ")} `;

  return (
    readProcessFile(processId, "environ").split("\0").includes(INSTANCE_MARKER) ||
    USER_DATA_DIRECTORY_ARGUMENTS.some((argument) => commandLine.includes(argument))
  );
};

const stopInstance = async () => {
  const instanceProcessIds = findProcessTree(isInstanceProcess);
  for (const processId of instanceProcessIds) sendSignal(processId, "SIGTERM");
  await waitFor(() => (findProcessTree(isInstanceProcess).length === 0 ? true : undefined), 5000);
  for (const processId of findProcessTree(isInstanceProcess)) sendSignal(processId, "SIGKILL");
  fileSystem.rmSync(STATE_FILE, {force: true});

  return instanceProcessIds.length;
};

// VS Code names each run's log folder after its start time, so the newest folder is this run's.
const findTraceLogPath = (startedAt: number) => {
  const logsDirectory = path.join(VSCODE_DATA_DIRECTORY, "logs");
  if (!fileSystem.existsSync(logsDirectory)) return undefined;

  const newestRunDirectory = fileSystem
    .readdirSync(logsDirectory)
    .map((runDirectoryName) => path.join(logsDirectory, runDirectoryName))
    .filter((runDirectory) => fileSystem.statSync(runDirectory).mtimeMs >= startedAt - 1000)
    .toSorted()
    .at(-1);
  if (newestRunDirectory === undefined) return undefined;

  const traceLogPath = path.join(newestRunDirectory, TRACE_LOG_RELATIVE_PATH);

  return fileSystem.existsSync(traceLogPath) ? traceLogPath : undefined;
};

// The test instance must not inherit the session it runs from: VSCODE_* would point `code` at the user's own window,
// CLAUDE* would make the Claude sessions in its terminals look nested, and DISPLAY could reach the real desktop.
const createLaunchEnvironment = () => ({
  ...Object.fromEntries(
    Object.entries(process.env).filter(([variableName]) => !INHERITED_SESSION_VARIABLE_PATTERN.test(variableName))
  ),
  [INSTANCE_VARIABLE]: STATE_DIRECTORY,
  WAYLAND_DISPLAY: WAYLAND_DISPLAY_NAME,
  // The private bus starts its own document portal at $XDG_RUNTIME_DIR/doc; sharing the real one unmounts the
  // desktop's, and every Flatpak launch then fails.
  XDG_RUNTIME_DIR: RUNTIME_DIRECTORY,
  XDG_SESSION_TYPE: "wayland"
});

const assertCanLaunch = (workspacePath: string) => {
  if (process.platform !== "linux") throw new Error("verify-in-vscode supports Linux only.");
  const missingCommand = ["mutter", "dbus-run-session", "code"].find(
    (requiredCommand) => spawnSync("which", [requiredCommand]).status !== 0
  );
  if (missingCommand !== undefined) throw new Error(`\`${missingCommand}\` is not installed.`);
  if (!fileSystem.existsSync(workspacePath)) {
    throw new Error(`Workspace ${workspacePath} does not exist; pass one or set AGGREGOR_VERIFY_WORKSPACE.`);
  }
};

const assertNotInUseByAnotherSession = (claudeProcessId: null | number) => {
  const previousState = readState();
  if (previousState === null) return;
  const previousOwnerProcessId = previousState.ownerProcessId;
  if (previousOwnerProcessId === null || previousOwnerProcessId === claudeProcessId) return;
  if (isClaudeProcess(previousOwnerProcessId)) {
    throw new Error(`Another Claude session (pid ${previousOwnerProcessId}) is using the headless VS Code.`);
  }
};

const launchVsCode = (workspacePath: string, claudeProcessId: null | number) => {
  const launchLog = fileSystem.openSync(LAUNCH_LOG, "w");
  const launchArguments = [
    MUTTER_LOG,
    VSCODE_DATA_DIRECTORY,
    VSCODE_EXTENSIONS_DIRECTORY,
    EXTENSION_DIRECTORY,
    String(CDP_PORT),
    workspacePath,
    String(MAX_LIFETIME_SECONDS),
    claudeProcessId === null ? "" : String(claudeProcessId),
    import.meta.filename,
    process.execPath
  ];
  spawn("dbus-run-session", ["--", "bash", "-c", LAUNCH_SCRIPT, "verify-in-vscode", ...launchArguments], {
    detached: true,
    env: createLaunchEnvironment(),
    stdio: ["ignore", launchLog, launchLog]
  }).unref();
};

const start = async (workspaceArgument: string | undefined) => {
  const workspacePath = path.resolve(workspaceArgument === undefined ? DEFAULT_WORKSPACE : workspaceArgument);
  assertCanLaunch(workspacePath);
  const claudeProcessId = findClaudeProcessId();
  assertNotInUseByAnotherSession(claudeProcessId);

  // A running instance never loads a new build: its extension host only restarts with the whole app.
  await stopInstance();
  if ((await listCdpTargets()).length > 0) throw new Error(`Port ${CDP_PORT} is held by something else.`);
  execFileSync("pnpm", ["exec", "vite", "build", "--mode", "development"], {
    cwd: EXTENSION_DIRECTORY,
    stdio: ["ignore", "ignore", "inherit"]
  });

  fileSystem.mkdirSync(RUNTIME_DIRECTORY, {mode: 0o700, recursive: true});
  const startedAt = Date.now();
  writeState({ownerProcessId: claudeProcessId, startedAt, workspacePath});
  launchVsCode(workspacePath, claudeProcessId);

  const workbenchPage = await waitFor(findWorkbenchPage, 30_000);
  const traceLogPath =
    workbenchPage === undefined ? undefined : await waitFor(() => findTraceLogPath(startedAt), 30_000);
  if (traceLogPath === undefined) {
    await stopInstance();
    throw new Error(`VS Code did not come up; see ${LAUNCH_LOG} and ${MUTTER_LOG}.`);
  }

  writeState({ownerProcessId: claudeProcessId, startedAt, traceLogPath, workspacePath});
  process.stdout.write(`Headless VS Code is up on ${workspacePath}.\nTrace log: ${traceLogPath}\n`);
};

const printTraceLogPath = () => {
  const state = readState();
  if (state === null || state.traceLogPath === undefined) {
    throw new Error("No headless VS Code is running; run `start` first.");
  }

  process.stdout.write(`${state.traceLogPath}\n`);
};

// Hooks close the instance of their own session, and any whose session is gone, never another live session's.
const stop = async (mode: string | undefined) => {
  const state = readState();
  if (mode === "--hook") {
    if (state === null) return;
    const {ownerProcessId} = state;
    const isOwnedByLiveOtherSession =
      ownerProcessId !== null && ownerProcessId !== findClaudeProcessId() && isClaudeProcess(ownerProcessId);
    if (isOwnedByLiveOtherSession) return;
  }

  const stoppedCount = await stopInstance();
  if (mode === undefined) process.stdout.write(`Stopped ${stoppedCount} processes.\n`);
};

const requireArgument = (command: (commandArgument: string) => Promise<void>) => async (commandArgument?: string) => {
  if (commandArgument === undefined) throw new Error("This command needs an argument.");
  await command(commandArgument);
};

const COMMANDS: Readonly<Record<string, (commandArgument?: string) => Promise<void> | void>> = {
  eval: requireArgument(evaluate),
  log: printTraceLogPath,
  screenshot: requireArgument(screenshot),
  start,
  stop
};

const [commandName = "", commandArgument] = process.argv.slice(2);
const command = COMMANDS[commandName];
if (command === undefined) {
  process.stderr.write(`Usage: vscode.ts ${Object.keys(COMMANDS).join(" | ")}\n`);
  process.exit(1);
}
try {
  await command(commandArgument);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  // A failing hook must never block Claude: it only reports.
  process.exit(commandArgument === "--hook" ? 0 : 1);
}
