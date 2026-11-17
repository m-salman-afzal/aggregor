import {
  IMPORT_DATE_FORMAT,
  IMPORT_ROW_KEY
} from "@/modules/sessions/components/userInputDialog/components/importSessionsInput/components/importChecklist/importChecklist.constant.ts";

import type {AgentChecklistGroup} from "@/modules/sessions/components/userInputDialog/components/importSessionsInput/components/importChecklist/importChecklist.type.ts";
import type {ImportableSessionsDto, ImportedSessionDto} from "@dtos/sessionImport.dto.ts";

export const toAgentChecklistGroups = (importableSessions: ImportableSessionsDto): readonly AgentChecklistGroup[] =>
  importableSessions.agentGroups.map((agentGroup) => ({
    agentName: agentGroup.agentName,
    checklistRows: agentGroup.importableSessions.map((importableSession) => ({
      detail: new Date(importableSession.updatedAt).toLocaleString(undefined, IMPORT_DATE_FORMAT),
      isDisabled: false,
      label: importableSession.title,
      rowKey: IMPORT_ROW_KEY(agentGroup.agentId, importableSession.agentSessionId)
    }))
  }));

export const takeImportedSessions = (
  importableSessions: ImportableSessionsDto,
  tickedRowKeys: ReadonlySet<string>
): readonly ImportedSessionDto[] =>
  importableSessions.agentGroups.flatMap((agentGroup) =>
    agentGroup.importableSessions
      .filter((importableSession) =>
        tickedRowKeys.has(IMPORT_ROW_KEY(agentGroup.agentId, importableSession.agentSessionId))
      )
      .map((importableSession) => ({
        agentId: agentGroup.agentId,
        agentSessionId: importableSession.agentSessionId,
        title: importableSession.title
      }))
  );
