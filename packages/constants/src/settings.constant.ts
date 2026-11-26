export const SETTINGS_COMMANDS = {
  UPDATE_SETTING: "aggregorApp.updateSetting"
} as const;

// The other Aggregor settings' keys sit with their features' constants.
export const SETTING_KEYS = {
  AUTO_COMMIT: "autoCommit",
  AUTO_PUSH: "autoPush",
  COMMIT_COMMAND: "commitCommand",
  NOTIFY_ON: "notifyOn",
  OPEN_PULL_REQUEST_IN: "openPullRequestIn",
  OPEN_SESSION_IN: "openSessionIn",
  PIN_SESSION_TABS: "pinSessionTabs",
  SESSION_MEMORY_LIMIT: "sessionMemoryLimit"
} as const;

export const SETTINGS_ERRORS = {
  SAVE_FAILED: (settingsSection: string, settingKey: string) =>
    `Could not save ${settingsSection}.${settingKey} in your user settings.`
} as const;
