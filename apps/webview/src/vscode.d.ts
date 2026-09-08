interface VSCodeApi {
  getState: <T = unknown>() => T | undefined;
  postMessage: (message: unknown) => void;
  setState: <T = unknown>(state: T) => void;
}

declare function acquireVsCodeApi(): VSCodeApi;
