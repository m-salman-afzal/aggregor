import {useEffect, useState} from "react";

import {getVsCodeState, postMessage, setVsCodeState} from "./api/vscode-api";
import {VSCodeButton, VSCodeCard, VSCodeSecondaryButton, VSCodeTextArea, VSCodeTextField} from "./components/vscode-ui";

interface AppState {
  format: string;
  notes: string;
  projectName: string;
}

type ExtensionMessage =
  | {
      payload: {
        message: string;
      };
      type: "fromExtension";
    }
  | {
      payload: {
        savedAt: string;
      };
      type: "settingsSaved";
    };

const defaultState: AppState = {
  format: "ipynb,py:percent",
  notes: "",
  projectName: "Jupytext Pair Helper"
};

function App() {
  const savedState = getVsCodeState<AppState>();

  const [projectName, setProjectName] = useState(savedState?.projectName ?? defaultState.projectName);
  const [format, setFormat] = useState(savedState?.format ?? defaultState.format);
  const [notes, setNotes] = useState(savedState?.notes ?? defaultState.notes);
  const [status, setStatus] = useState("Ready");

  useEffect(() => {
    setVsCodeState({format, notes, projectName});
  }, [projectName, format, notes]);

  useEffect(() => {
    function handleMessage(event: MessageEvent<ExtensionMessage>) {
      const message = event.data;

      switch (message.type) {
        case "fromExtension":
          setStatus(message.payload.message);
          break;
        case "settingsSaved":
          setStatus(`Settings saved at ${message.payload.savedAt}`);
          break;
      }
    }

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  function saveSettings() {
    postMessage({
      payload: {
        format,
        notes,
        projectName
      },
      type: "saveSettings"
    });
  }

  function showInfoMessage() {
    postMessage({
      payload: {
        message: `Current project: ${projectName}`
      },
      type: "showInfo"
    });
  }

  function resetSettings() {
    setProjectName(defaultState.projectName);
    setFormat(defaultState.format);
    setNotes(defaultState.notes);
    setStatus("Reset locally. Click Save settings to send the update to VS Code.");
  }

  return (
    <main className="min-h-screen p-5">
      <section className="mx-auto grid max-w-4xl gap-5">
        <VSCodeCard>
          <p className="text-xs uppercase tracking-wide text-[var(--vscode-descriptionForeground)]">
            VS Code Webview Tutorial
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--vscode-foreground)]">
            React + Vite + Tailwind + VS Code Message Passing
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--vscode-descriptionForeground)]">
            This webview uses React for state, Tailwind for layout, and VS Code message passing to communicate with the
            extension.
          </p>
        </VSCodeCard>

        <div className="grid gap-5 md:grid-cols-2">
          <VSCodeCard>
            <h2 className="text-lg font-medium">Settings</h2>
            <div className="mt-4 grid gap-4">
              <label className="grid gap-1 text-sm">
                <span className="text-[var(--vscode-descriptionForeground)]">Project name</span>
                <VSCodeTextField
                  onChange={(event) => {
                    setProjectName(event.target.value);
                  }}
                  value={projectName}
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="text-[var(--vscode-descriptionForeground)]">Pairing format</span>
                <select
                  className="w-full rounded border border-[var(--vscode-dropdown-border)] bg-[var(--vscode-dropdown-background)] px-3 py-2 text-sm text-[var(--vscode-dropdown-foreground)] focus:outline focus:outline-1 focus:outline-[var(--vscode-focusBorder)]"
                  onChange={(event) => {
                    setFormat(event.target.value);
                  }}
                  value={format}>
                  <option value="ipynb,py:percent">Python percent pair</option>
                  <option value="ipynb,md:myst">Markdown MyST pair</option>
                  <option value="ipynb,md,pct.py:percent">Notebook + Markdown + percent script</option>
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span className="text-[var(--vscode-descriptionForeground)]">Notes</span>
                <VSCodeTextArea
                  onChange={(event) => {
                    setNotes(event.target.value);
                  }}
                  placeholder="Notes about the selected pairing format..."
                  value={notes}
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <VSCodeButton onClick={saveSettings}>Save settings</VSCodeButton>
                <VSCodeButton onClick={showInfoMessage}>Show VS Code message</VSCodeButton>
                <VSCodeSecondaryButton onClick={resetSettings}>Reset</VSCodeSecondaryButton>
              </div>
            </div>
          </VSCodeCard>

          <VSCodeCard>
            <h2 className="text-lg font-medium">Preview</h2>
            <div className="mt-4 grid gap-4">
              <div className="rounded-lg border border-[var(--vscode-panel-border)] p-4">
                <p className="text-sm text-[var(--vscode-descriptionForeground)]">Project</p>
                <h3 className="mt-1 text-lg font-medium">{projectName}</h3>
              </div>

              <div className="rounded-lg border border-[var(--vscode-panel-border)] p-4">
                <p className="text-sm text-[var(--vscode-descriptionForeground)]">Selected Jupytext format</p>
                <code className="mt-2 block rounded bg-[var(--vscode-textCodeBlock-background)] p-3">{format}</code>
              </div>

              <div className="rounded-lg border border-[var(--vscode-panel-border)] p-4">
                <p className="text-sm text-[var(--vscode-descriptionForeground)]">Status</p>
                <p className="mt-1 text-sm">{status}</p>
              </div>
            </div>
          </VSCodeCard>
        </div>
      </section>
    </main>
  );
}

export default App;
