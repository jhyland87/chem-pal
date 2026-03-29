/**
 * Action types for the settings reducer used by SettingsPanel and SettingsPanelFull.
 */

export {};

declare global {
  type SettingAction =
    | { type: "SWITCH_CHANGE"; name: string; checked: boolean }
    | { type: "INPUT_CHANGE"; name: string; value: string }
    | { type: "BUTTON_CLICK"; name: string; value: string }
    | { type: "RESTORE_DEFAULTS" };
}
