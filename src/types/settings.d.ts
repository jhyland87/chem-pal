/**
 * Action types for the settings reducer used by SettingsPanel and SettingsPanelFull.
 */

import { ACTION_TYPE } from "@/constants/common";

export {};

declare global {
  type SettingAction =
    | { type: ACTION_TYPE.SWITCH_CHANGE; name: string; checked: boolean }
    | { type: ACTION_TYPE.INPUT_CHANGE; name: string; value: string }
    | { type: ACTION_TYPE.BUTTON_CLICK; name: string; value: string }
    | { type: ACTION_TYPE.RESTORE_DEFAULTS };
}
