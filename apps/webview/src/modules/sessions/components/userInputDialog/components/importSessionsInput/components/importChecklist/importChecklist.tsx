import {ImportButtons} from "@/modules/sessions/components/userInputDialog/components/importSessionsInput/components/importChecklist/components/importButtons.tsx";
import {ImportList} from "@/modules/sessions/components/userInputDialog/components/importSessionsInput/components/importChecklist/components/importList.tsx";
import {useImportChecklist} from "@/modules/sessions/components/userInputDialog/components/importSessionsInput/components/importChecklist/importChecklist.hook.ts";
import {SESSION_IMPORT_LABELS} from "@pkg/constants/src/agentHistory.constant.ts";
import {DialogDescription} from "@pkg/ui/src/components/base/dialog.tsx";

import type {ImportableSessionsDto} from "@dtos/sessionImport.dto.ts";

interface ImportChecklistProps {
  readonly importableSessions: ImportableSessionsDto;
  readonly onCancel: () => void;
}

export const ImportChecklist = (props: ImportChecklistProps) => {
  const importChecklistView = useImportChecklist(props);

  return (
    <>
      {importChecklistView.isEmpty ? (
        <DialogDescription className="text-foreground/80">{SESSION_IMPORT_LABELS.NONE}</DialogDescription>
      ) : (
        <ImportList
          agentChecklistGroups={importChecklistView.agentChecklistGroups}
          areAllTicked={importChecklistView.areAllTicked}
          onToggleAll={importChecklistView.toggleAll}
          onToggleRow={importChecklistView.toggleRow}
          tickedRowKeys={importChecklistView.tickedRowKeys}
        />
      )}
      <ImportButtons
        isImportShown={!importChecklistView.isEmpty}
        isNothingTicked={importChecklistView.isNothingTicked}
        onCancel={props.onCancel}
        onImport={importChecklistView.importTicked}
      />
    </>
  );
};
