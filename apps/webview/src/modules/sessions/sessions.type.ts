import type {SESSION_LISTS, USER_INPUT_TAGS} from "@/modules/sessions/sessions.constant.ts";
import type {ProjectSettingsDto} from "@dtos/project.dto.ts";
import type {SESSIONS_WEBVIEW_COMMANDS} from "@pkg/constants/src/sessionsView.constant.ts";
import type {CommandRequest} from "@views/sessions/sessions.view.type.ts";
import type {LucideIcon} from "lucide-react";

export interface RowAction {
  readonly commandId: (typeof SESSIONS_WEBVIEW_COMMANDS)[number];
  readonly icon: LucideIcon;
  readonly isDestructive?: boolean;
  readonly label: string;
  readonly sharedRowLabel?: string;
}

export type SessionListId = (typeof SESSION_LISTS)[keyof typeof SESSION_LISTS];

// Each user input carries what its answer does; the dialog closes before running it, so an answer may open the next one.
export type UserInput =
  | {
      readonly _tag: typeof USER_INPUT_TAGS.NEW_SESSION;
      readonly chosenProjectPath?: string | undefined;
      readonly onStart: (newSessionRequest: CommandRequest) => void;
      readonly title: string;
    }
  | {
      readonly _tag: typeof USER_INPUT_TAGS.PROJECT_SETTINGS;
      readonly onSave: (settings: ProjectSettingsDto) => void;
      readonly settings: ProjectSettingsDto;
      readonly title: string;
    }
  | {
      readonly _tag: typeof USER_INPUT_TAGS.QUESTION;
      readonly answers: readonly UserInputAnswer[];
      readonly onConfirm: () => void;
      readonly title: string;
    }
  | {
      readonly _tag: typeof USER_INPUT_TAGS.TEXT;
      readonly onEnterText: (enteredText: string) => void;
      readonly title: string;
      readonly value: string;
    };

export interface UserInputAnswer {
  readonly answerId: string;
  readonly consequence: string;
  readonly isDestructive: boolean;
  readonly label: string;
}

export interface UserInputOption {
  readonly badge?: string;
  readonly description?: string;
  readonly iconUri?: string;
  readonly label: string;
  readonly optionId: string;
  readonly SecondaryActionIcon?: LucideIcon;
  readonly secondaryActionLabel?: string;
}
