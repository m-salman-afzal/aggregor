import type {SessionProcessDto} from "@/dtos/sessionProcess.dto.ts";

export interface ProcessTreeItem {
  readonly childItems: readonly ProcessTreeItem[];
  readonly sessionProcess: SessionProcessDto;
}
