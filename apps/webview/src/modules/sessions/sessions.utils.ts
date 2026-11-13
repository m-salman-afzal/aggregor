import {APPEARANCE} from "@/modules/sessions/sessions.constant.ts";

export const getAccentName = (accentColor: string) =>
  accentColor.startsWith(APPEARANCE.CUSTOM_ACCENT_PREFIX) ? APPEARANCE.CUSTOM_ACCENT : accentColor;

export const makeAppearanceCss = (fontSize: number, accentColor: string) =>
  accentColor.startsWith(APPEARANCE.CUSTOM_ACCENT_PREFIX)
    ? `${APPEARANCE.FONT_SIZE_CSS(fontSize)}${APPEARANCE.ACCENT_CSS(accentColor)}`
    : APPEARANCE.FONT_SIZE_CSS(fontSize);
