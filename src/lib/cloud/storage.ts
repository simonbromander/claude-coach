import type { TrainingPlan } from "../../schema/training-plan.js";
import { buildSettingsFromPlan, type Settings } from "../settings-core.js";
import { emptyPlanChanges, isEmptyPlanChanges, type PlanChanges } from "../plan-changes.js";

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function loadSettingsForPlan(plan: TrainingPlan): Settings {
  const storageKey = `plan-${plan.meta.id}-settings`;
  const settings = buildSettingsFromPlan(plan);
  const saved = safeParse<Partial<Settings>>(localStorage.getItem(storageKey), {});

  if (saved.theme) settings.theme = saved.theme;
  if (saved.units) settings.units = { ...settings.units, ...saved.units };
  if (saved.firstDayOfWeek) settings.firstDayOfWeek = saved.firstDayOfWeek;
  if (saved.run) settings.run = { ...settings.run, ...saved.run };
  if (saved.bike) settings.bike = { ...settings.bike, ...saved.bike };
  if (saved.swim) settings.swim = { ...settings.swim, ...saved.swim };

  return settings;
}

export function saveSettingsForPlan(planId: string, settings: Settings): void {
  const storageKey = `plan-${planId}-settings`;
  localStorage.setItem(storageKey, JSON.stringify(settings));
}

export function loadChangesForPlan(planId: string, initial?: PlanChanges): PlanChanges {
  const storageKey = `plan-${planId}-changes`;
  if (initial && !isEmptyPlanChanges(initial)) {
    localStorage.setItem(storageKey, JSON.stringify(initial));
    return initial;
  }

  const saved = safeParse<PlanChanges>(localStorage.getItem(storageKey), emptyPlanChanges());
  return {
    moved: saved.moved || {},
    edited: saved.edited || {},
    deleted: saved.deleted || [],
    added: saved.added || {},
  };
}

export function saveChangesForPlan(planId: string, changes: PlanChanges): void {
  const storageKey = `plan-${planId}-changes`;
  localStorage.setItem(storageKey, JSON.stringify(changes));
}

export function loadCompletedForPlan(
  planId: string,
  initial?: Record<string, boolean>
): Record<string, boolean> {
  const storageKey = `plan-${planId}-completed`;
  if (initial && Object.keys(initial).length > 0) {
    localStorage.setItem(storageKey, JSON.stringify(initial));
    return initial;
  }
  return safeParse<Record<string, boolean>>(localStorage.getItem(storageKey), {});
}

export function saveCompletedForPlan(planId: string, completed: Record<string, boolean>): void {
  const storageKey = `plan-${planId}-completed`;
  localStorage.setItem(storageKey, JSON.stringify(completed));
}
