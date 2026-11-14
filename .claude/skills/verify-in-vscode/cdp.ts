import fileSystem from "node:fs";
import path from "node:path";

interface CdpTarget {
  readonly title: string;
  readonly type: string;
  readonly url: string;
  readonly webSocketDebuggerUrl: string;
}

export const CDP_PORT = 9447;

const WEBVIEW_STYLE_FILE = path.resolve(import.meta.dirname, "../../../apps/extension/dist/webview/webview.css");

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null;

const isCdpTarget = (value: unknown): value is CdpTarget =>
  isRecord(value) &&
  typeof value.title === "string" &&
  typeof value.type === "string" &&
  typeof value.url === "string" &&
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

// VS Code loads the Sessions view's webview frame only once the view has been in sight.
const findSessionsWebviewFrame = async () =>
  (await listCdpTargets()).find(
    (target) =>
      target.type === "iframe" &&
      target.url.startsWith("vscode-webview://") &&
      target.url.includes("extensionId=SalmanAfzal.aggregor-app")
  );

const sendCdpCommand = async (
  method: string,
  parameters: Readonly<Record<string, unknown>>,
  findTarget: () => Promise<CdpTarget | undefined> = findWorkbenchPage
) => {
  const cdpTarget = await findTarget();
  if (cdpTarget === undefined) {
    throw new Error(
      findTarget === findWorkbenchPage
        ? "No headless VS Code is running; run `start` first."
        : "The Sessions view's webview isn't loaded; open the Aggregor container first."
    );
  }

  const socket = new WebSocket(cdpTarget.webSocketDebuggerUrl);
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

const evaluateIn = async (expression: string, findTarget?: () => Promise<CdpTarget | undefined>) => {
  const evaluation = await sendCdpCommand(
    "Runtime.evaluate",
    {awaitPromise: true, expression, returnByValue: true},
    findTarget
  );
  if (isRecord(evaluation.exceptionDetails)) {
    const exceptionDetails = evaluation.exceptionDetails;
    const exception = isRecord(exceptionDetails.exception) ? exceptionDetails.exception : {};
    throw new Error(String(exception.description === undefined ? exceptionDetails.text : exception.description));
  }

  process.stdout.write(`${JSON.stringify(isRecord(evaluation.result) ? evaluation.result.value : undefined)}\n`);
};

export const evaluate = async (expression: string) => {
  await evaluateIn(expression);
};

export const evaluateInSessionsWebview = async (expression: string) => {
  const activeFrame = 'document.querySelector("iframe#active-frame")';
  await evaluateIn(
    `((document, window) => (${expression}))(${activeFrame}.contentDocument, ${activeFrame}.contentWindow)`,
    findSessionsWebviewFrame
  );
};

// The headless window has no pointer, so `(hover: hover)` is false there: the stylesheet is added again with it flipped.
export const hoverInSessionsWebview = async (point: string) => {
  const [pointX, pointY] = point.split(",").map(Number);
  if (pointX === undefined || pointY === undefined || Number.isNaN(pointX) || Number.isNaN(pointY))
    throw new Error("Pass the point to hover as x,y, in the window's CSS pixels.");
  const hoverStyleSheet = fileSystem
    .readFileSync(WEBVIEW_STYLE_FILE, "utf8")
    .replaceAll("@media (hover:hover)", "@media all")
    .replaceAll("@media (hover:none)", "@media not all");
  await evaluateInSessionsWebview(
    `(() => { const sheet = new window.CSSStyleSheet(); sheet.replaceSync(${JSON.stringify(hoverStyleSheet)}); ` +
      `document.adoptedStyleSheets = [sheet]; return "hover styles on"; })()`
  );
  await sendCdpCommand("Input.dispatchMouseEvent", {type: "mouseMoved", x: pointX - 1, y: pointY - 1});
  await sendCdpCommand("Input.dispatchMouseEvent", {type: "mouseMoved", x: pointX, y: pointY});
};

export const screenshot = async (screenshotPath: string) => {
  if (!path.isAbsolute(screenshotPath)) throw new Error("Pass an absolute path for the screenshot.");

  const capture = await sendCdpCommand("Page.captureScreenshot", {format: "png"});
  if (typeof capture.data !== "string") throw new Error("Page.captureScreenshot returned no image.");
  fileSystem.writeFileSync(screenshotPath, Buffer.from(capture.data, "base64"));
  process.stdout.write(`${screenshotPath}\n`);
};
