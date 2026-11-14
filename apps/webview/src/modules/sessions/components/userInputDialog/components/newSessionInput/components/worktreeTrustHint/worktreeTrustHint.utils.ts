import {runCommandOnHost} from "@/modules/sessions/sessions.service.ts";
import {VS_CODE_COMMANDS} from "@pkg/constants/src/vscode.constant.ts";

// No VS Code command trusts a given folder, so its Add Folder picker gets the path; the copy fails once the page loses focus.
export const copyPathThenManageTrust = (folderPath: string, setPathCopied: (isPathCopied: boolean) => void) => {
  navigator.clipboard
    .writeText(folderPath)
    .then(
      () => {
        setPathCopied(true);
      },
      () => {
        setPathCopied(false);
      }
    )
    .finally(() => {
      runCommandOnHost(VS_CODE_COMMANDS.MANAGE_WORKSPACE_TRUST);
    });
};
