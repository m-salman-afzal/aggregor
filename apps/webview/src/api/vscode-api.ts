export type WebviewMessage =
  | {
      payload: {
        format: string;
        notes: string;
        projectName: string;
      };
      type: "saveSettings";
    }
  | {
      payload: {
        message: string;
      };
      type: "showInfo";
    };

let vscodeApi: undefined | VSCodeApi;

export function getVsCodeState<T>() {
  const vscode = getVsCodeApi();

  return vscode?.getState<T>();
}

export function postMessage(message: WebviewMessage) {
  const vscode = getVsCodeApi();

  if (!vscode) {
    console.log("VS Code API is not available. Message was not sent:", message);

    return;
  }

  vscode.postMessage(message);
}

export function setVsCodeState<T>(state: T) {
  const vscode = getVsCodeApi();
  vscode?.setState(state);
}

function getVsCodeApi() {
  if (vscodeApi) {
    return vscodeApi;
  }

  if (typeof acquireVsCodeApi === "function") {
    vscodeApi = acquireVsCodeApi();

    return vscodeApi;
  }

  return undefined;
}
