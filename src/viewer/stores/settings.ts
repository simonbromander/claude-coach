import { planData } from "./plan.js";
import {
  buildSettingsFromPlan,
  defaultSettings,
  paceToSeconds,
  recalculateHrZones,
  recalculatePowerZones,
  recalculateRunPaceZones,
  recalculateSwimPaceZones,
  secondsToPace,
  type HrZone,
  type PaceZone,
  type PowerZone,
  type Settings,
  type Theme,
} from "../../lib/settings-core.js";

const storageKey = `plan-${planData.meta.id}-settings`;

export function loadSettings(): Settings {
  const settings = buildSettingsFromPlan(planData);

  // Override with user's saved settings
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    const userSettings = JSON.parse(saved);
    if (userSettings.theme) settings.theme = userSettings.theme;
    if (userSettings.units) settings.units = { ...settings.units, ...userSettings.units };
    if (userSettings.firstDayOfWeek) settings.firstDayOfWeek = userSettings.firstDayOfWeek;
    if (userSettings.run) settings.run = { ...settings.run, ...userSettings.run };
    if (userSettings.bike) settings.bike = { ...settings.bike, ...userSettings.bike };
    if (userSettings.swim) settings.swim = { ...settings.swim, ...userSettings.swim };
  }

  return settings;
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(storageKey, JSON.stringify(settings));
}

export {
  defaultSettings,
  paceToSeconds,
  recalculateHrZones,
  recalculatePowerZones,
  recalculateRunPaceZones,
  recalculateSwimPaceZones,
  secondsToPace,
  type HrZone,
  type PaceZone,
  type PowerZone,
  type Settings,
  type Theme,
};
