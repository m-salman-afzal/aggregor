// Talks to the headless VS Code window over the Chrome DevTools Protocol, for vscode.ts.
import fileSystem from "node:fs";
import path from "node:path";

interface CdpTarget {
  readonly title: string;
  readonly type: string;
  readonly webSocketDebuggerUrl: string;
}

export const CDP_PORT = 9447;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null;

const isCdpTarget = (value: unknown): value is CdpTarget =>
  isRecord(value) &&
  typeof value.title === "string" &&
  typeof value.type === "string" &&
  typeof value.webSocketDebuggerUrl === "string";

export const listCdpTargets = async (): Promise<readonly CdpTarget[]> => {
  try {
    const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const targets: unknown = await response.json();

    return Array.isArray(targets) ? targets.filter(isCdpTarget) : [];
  } catch {
    return [];
  }
};

// Only ever the VS Code window: another app on this port once turned out to be the user's own Chrome.
export const findWorkbenchPage = async () =>
  (await listCdpTargets()).find((target) => target.type === "page" && target.title.includes("Visual Studio Code"));

const sendCdpCommand = async (method: string, parameters: Readonly<Record<string, unknown>>) => {
  const workbenchPage = await findWorkbenchPage();
  if (workbenchPage === undefined) throw new Error("No headless VS Code is running; run `start` first.");

  const socket = new WebSocket(workbenchPage.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve);
    socket.addEventListener("error", reject);
  });
  const reply = await new Promise<unknown>((resolve) => {
    socket.addEventListener("message", (messageEvent) => {
      resolve(JSON.parse(String(messageEvent.data)));
    });
    socket.send(JSON.stringify({id: 1, method, params: parameters}));
  });
  socket.close();
  if (!isRecord(reply)) throw new Error(`${method} returned no reply.`);
  if (isRecord(reply.error)) throw new Error(`${method} failed: ${String(reply.error.message)}`);

  return isRecord(reply.result) ? reply.result : {};
};

export const evaluate = async (expression: string) => {
  const {exceptionDetails, result} = await sendCdpCommand("Runtime.evaluate", {
    awaitPromise: true,
    expression,
    returnByValue: true
  });
  if (isRecord(exceptionDetails)) {
    const exception = isRecord(exceptionDetails.exception) ? exceptionDetails.exception : {};
    throw new Error(String(exception.description === undefined ? exceptionDetails.text : exception.description));
  }

  process.stdout.write(`${JSON.stringify(isRecord(result) ? result.value : undefined)}\n`);
};

export const screenshot = async (screenshotPath: string) => {
  if (!path.isAbsolute(screenshotPath)) throw new Error("Pass an absolute path for the screenshot.");

  const {data} = await sendCdpCommand("Page.captureScreenshot", {format: "png"});
  if (typeof data !== "string") throw new Error("Page.captureScreenshot returned no image.");
  fileSystem.writeFileSync(screenshotPath, Buffer.from(data, "base64"));
  process.stdout.write(`${screenshotPath}\n`);
};
