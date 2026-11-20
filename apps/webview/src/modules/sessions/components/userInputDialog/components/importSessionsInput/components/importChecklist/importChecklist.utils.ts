import {
  IMPORT_DATE_FORMAT,
  IMPORT_ROW_KEY
} from "@/modules/sessions/components/userInputDialog/components/importSessionsInput/components/importChecklist/importChecklist.constant.ts";
import {SESSIONS_LABELS} from "@/modules/sessions/sessions.constant.ts";
import {SESSION_IMPORT_LABELS} from "@pkg/constants/src/agentHistory.constant.ts";

import type {ChecklistRowData} from "@/modules/sessions/components/userInputDialog/components/checklistSection/checklistSection.type.ts";
import type {ImportChecklistSection} from "@/modules/sessions/components/userInputDialog/components/importSessionsInput/components/importChecklist/importChecklist.type.ts";
import type {ImportableSessionDto, ImportableSessionsDto, ImportedSessionDto} from "@dtos/sessionImport.dto.ts";

const describeImportableSession = (importableSession: ImportableSessionDto) => {
  const updatedAtText = new Date(importableSession.updatedAt).toLocaleString(undefined, IMPORT_DATE_FORMAT);
  if (importableSession.worktree === undefined) return updatedAtText;
  const worktreePath = importableSession.worktree.worktreePath;

  return [worktreePath.slice(worktreePath.lastIndexOf("/") + 1), importableSession.worktree.branchName, updatedAtText]
    .filter((detailPart) => detailPart !== "")
    .join(SESSIONS_LABELS.DETAIL_SEPARATOR);
};

const makeImportChecklistRows = (
  agentId: string,
  importableSessions: readonly ImportableSessionDto[]
): readonly ChecklistRowData[] =>
  importableSessions.map((importableSession) => ({
    detail: describeImportableSession(importableSession),
    isDisabled: false,
    label: importableSession.title,
    rowKey: IMPORT_ROW_KEY(agentId, importableSession.agentSessionId)
  }));

const makeImportChecklistSections = (importableSessions: ImportableSessionsDto): readonly ImportChecklistSection[] =>
  importableSessions.agentGroups.flatMap((agentGroup) => [
    {
      checklistRows: makeImportChecklistRows(
        agentGroup.agentId,
        agentGroup.importableSessions.filter((importableSession) => importableSession.worktree === undefined)
      ),
      legend: SESSION_IMPORT_LABELS.MAIN_FOLDER_SECTION(agentGroup.agentName)
    },
    {
      checklistRows: makeImportChecklistRows(
        agentGroup.agentId,
        agentGroup.importableSessions.filter((importableSession) => importableSession.worktree !== undefined)
      ),
      legend: SESSION_IMPORT_LABELS.WORKTREES_SECTION(agentGroup.agentName)
    }
  ]);

export const findSearchedChecklistSections = (
  importableSessions: ImportableSessionsDto,
  searchText: string
): readonly ImportChecklistSection[] => {
  const searchedText = searchText.trim().toLowerCase();

  return makeImportChecklistSections(importableSessions)
    .map((importChecklistSection) => ({
      checklistRows: importChecklistSection.checklistRows.filter(
        (checklistRow) =>
          checklistRow.label.toLowerCase().includes(searchedText) ||
          checklistRow.detail.toLowerCase().includes(searchedText)
      ),
      legend: importChecklistSection.legend
    }))
    .filter((importChecklistSection) => importChecklistSection.checklistRows.length > 0);
};

const listRowKeys = (importChecklistSections: readonly ImportChecklistSection[]): readonly string[] =>
  importChecklistSections.flatMap((importChecklistSection) =>
    importChecklistSection.checklistRows.map((checklistRow) => checklistRow.rowKey)
  );

export const areAllRowsTicked = (
  importChecklistSections: readonly ImportChecklistSection[],
  tickedRowKeys: ReadonlySet<string>
) => listRowKeys(importChecklistSections).every((rowKey) => tickedRowKeys.has(rowKey));

export const toggleShownRowKeys = (
  tickedRowKeys: ReadonlySet<string>,
  shownChecklistSections: readonly ImportChecklistSection[]
): ReadonlySet<string> => {
  const shownRowKeys = listRowKeys(shownChecklistSections);
  if (areAllRowsTicked(shownChecklistSections, tickedRowKeys))
    return new Set([...tickedRowKeys].filter((rowKey) => !shownRowKeys.includes(rowKey)));

  return new Set([...tickedRowKeys, ...shownRowKeys]);
};

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
        title: importableSession.title,
        worktreePath: importableSession.worktree?.worktreePath
      }))
  );
