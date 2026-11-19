import {SESSION_DROPDOWN_LABELS} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/components/sessionDropdown/sessionDropdown.constant.ts";

// Only a shell shared with other sessions says so.
export const makeSharedShellNote = (sharingSessionCount: number) =>
  sharingSessionCount > 1 ? SESSION_DROPDOWN_LABELS.SHARED_SHELL(sharingSessionCount) : undefined;
